import { access, readFile, rename, rm } from 'node:fs/promises'
import { join } from 'node:path'
import {
  compareVersions,
  normalizeUpdateConfig,
  parseCommitFromVersionName,
  UPDATE_CHECK_INTERVAL_MAX_MIN,
  type UpdateBlockReason,
  type UpdateConfig,
  type UpdateEventKind,
  type UpdateJob,
  type UpdateStatus,
  type UpdateStep,
  type UpdateTrigger
} from '@vite-crx/shared'
import { CommandError, lastLines, runOrThrow, type Runner } from './exec.ts'
import { Git } from './git.ts'
import { loadConfig, saveConfig } from './config.ts'

const MANIFEST_PATH = 'apps/extension/src/manifest.json'
const LOG_TAIL_LINES = 40
const BUILD_TIMEOUT_MS = 10 * 60_000
const INSTALL_TIMEOUT_MS = 10 * 60_000
const FIRST_CHECK_DELAY_MS = 30_000
const MINUTE = 60_000
/** 构建产物里必须存在的文件 */
const REQUIRED_FILES = [
  'manifest.json',
  'background/index.js',
  'contentScript/index.js',
  'popup/index.html'
]

type TimerHandle = ReturnType<typeof setTimeout>

export interface UpdateServiceOptions {
  repoRoot: string
  configFile: string
  run: Runner
  /** 仅本次运行生效的检查间隔（`server:start --interval`），不写回配置文件 */
  intervalOverride?: number
  now?: () => Date
  createId?: () => string
  setTimeout?: (cb: () => void, ms: number) => TimerHandle
  clearTimeout?: (handle: TimerHandle) => void
  firstCheckDelayMs?: number
}

interface RemoteState {
  branch: string | null
  blockedBy: UpdateBlockReason | null
  dirtyFiles: string[]
  behind: number
  remoteVersion: string | null
  remoteCommit: string | null
}

class StepError extends Error {
  constructor(
    readonly step: UpdateStep,
    message: string,
    readonly logTail: string[] = []
  ) {
    super(message)
  }
}

const shortSha = (sha: string | null) => (sha ? sha.slice(0, 7) : null)

/**
 * 负责：定时检查远端版本、拉代码、构建到 staging、校验、原子替换 extension/。
 * 同一时间只跑一个检查或更新（busy 锁），状态变化通过 onEvent 推给 WebSocket 客户端。
 */
export class UpdateService {
  private readonly git: Git
  private readonly now: () => Date
  private readonly createId: () => string
  private readonly setTimer: (cb: () => void, ms: number) => TimerHandle
  private readonly clearTimer: (handle: TimerHandle) => void
  private readonly listeners = new Set<
    (kind: UpdateEventKind, status: UpdateStatus) => void
  >()

  private config: UpdateConfig = normalizeUpdateConfig(null)
  private remote: RemoteState = {
    branch: null,
    blockedBy: null,
    dirtyFiles: [],
    behind: 0,
    remoteVersion: null,
    remoteCommit: null
  }
  private installedVersion: string | null = null
  private installedCommit: string | null = null
  private job: UpdateJob | null = null
  private busy = false
  private lastCheckAt: string | null = null
  private lastCheckError: string | null = null
  private nextCheckAt: string | null = null
  private timer: TimerHandle | null = null
  private failureCount = 0
  /** 自动更新构建失败的远端 commit，远端出现新提交前不再自动重试 */
  private lastFailedRemoteCommit: string | null = null

  constructor(private readonly options: UpdateServiceOptions) {
    this.git = new Git(options.run, options.repoRoot)
    this.now = options.now ?? (() => new Date())
    this.createId = options.createId ?? (() => crypto.randomUUID())
    this.setTimer = options.setTimeout ?? setTimeout
    this.clearTimer = options.clearTimeout ?? clearTimeout
  }

  get extensionDir() {
    return join(this.options.repoRoot, 'extension')
  }
  get stagingDir() {
    return join(this.options.repoRoot, 'extension.staging')
  }
  get prevDir() {
    return join(this.options.repoRoot, 'extension.prev')
  }

  /** 实际生效的间隔：启动参数优先于配置文件 */
  get intervalMinutes(): number {
    return this.options.intervalOverride !== undefined
      ? normalizeUpdateConfig({
          checkIntervalMinutes: this.options.intervalOverride
        }).checkIntervalMinutes
      : this.config.checkIntervalMinutes
  }

  onEvent(listener: (kind: UpdateEventKind, status: UpdateStatus) => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async init(): Promise<void> {
    this.config = await loadConfig(this.options.configFile)
    await this.readInstalled()
  }

  getStatus(): UpdateStatus {
    const { remoteVersion, remoteCommit } = this.remote
    const updateAvailable =
      remoteVersion !== null &&
      (this.installedVersion === null ||
        compareVersions(remoteVersion, this.installedVersion) > 0)
    return {
      enabled: true,
      branch: this.remote.branch,
      installedVersion: this.installedVersion,
      installedCommit: this.installedCommit,
      remoteVersion,
      remoteCommit: shortSha(remoteCommit),
      updateAvailable,
      blockedBy: this.remote.blockedBy,
      dirtyFiles: this.remote.dirtyFiles,
      job: this.job ? { ...this.job, logTail: [...this.job.logTail] } : null,
      lastCheckAt: this.lastCheckAt,
      nextCheckAt: this.nextCheckAt,
      lastCheckError: this.lastCheckError,
      config: {
        autoUpdate: this.config.autoUpdate,
        checkIntervalMinutes: this.intervalMinutes
      }
    }
  }

  async setConfig(patch: unknown): Promise<UpdateStatus> {
    this.config = normalizeUpdateConfig(patch, this.config)
    await saveConfig(this.options.configFile, this.config)
    // 改了间隔或开关后立即重新计时
    if (this.timer !== null || this.nextCheckAt !== null) this.reschedule()
    this.emit('checked')
    return this.getStatus()
  }

  // ---------- 定时任务 ----------

  /** 启动约 30 秒后先查一次，之后按间隔执行 */
  startScheduler(): void {
    this.schedule(this.options.firstCheckDelayMs ?? FIRST_CHECK_DELAY_MS)
  }

  stopScheduler(): void {
    if (this.timer !== null) this.clearTimer(this.timer)
    this.timer = null
    this.nextCheckAt = null
  }

  reschedule(): void {
    this.failureCount = 0
    this.schedule(this.intervalMinutes * MINUTE)
  }

  private schedule(delayMs: number): void {
    if (this.timer !== null) this.clearTimer(this.timer)
    if (!this.config.autoUpdate) {
      this.timer = null
      this.nextCheckAt = null
      return
    }
    this.nextCheckAt = new Date(this.now().getTime() + delayMs).toISOString()
    this.timer = this.setTimer(() => {
      this.timer = null
      void this.tick()
    }, delayMs)
  }

  /** 一次定时检查；失败时按 2 倍、4 倍……退避，最长 24 小时 */
  async tick(): Promise<void> {
    try {
      const ok = await this.checkAndMaybeUpdate()
      this.failureCount = ok ? 0 : this.failureCount + 1
    } catch {
      this.failureCount++
    }
    const factor = 2 ** this.failureCount
    const delayMin = Math.min(
      this.intervalMinutes * factor,
      Math.max(UPDATE_CHECK_INTERVAL_MAX_MIN, this.intervalMinutes)
    )
    this.schedule(delayMin * MINUTE)
  }

  /** 返回本次检查（fetch）是否成功 */
  async checkAndMaybeUpdate(): Promise<boolean> {
    if (this.busy) return true
    const checked = await this.check()
    if (!checked) return false
    const status = this.getStatus()
    if (
      this.config.autoUpdate &&
      status.updateAvailable &&
      status.blockedBy === null &&
      this.remote.remoteCommit !== this.lastFailedRemoteCommit
    ) {
      await this.update('auto')
    }
    return true
  }

  // ---------- 检查 ----------

  /** fetch 并刷新远端/本地状态。正在更新时直接返回 */
  async check(): Promise<boolean> {
    if (this.busy) return true
    this.busy = true
    try {
      await this.refreshRemote()
      this.lastCheckError = null
      return true
    } catch (error) {
      this.lastCheckError = errorMessage(error)
      return false
    } finally {
      this.lastCheckAt = this.now().toISOString()
      this.busy = false
      this.emit('checked')
    }
  }

  private async refreshRemote(fetch = true): Promise<void> {
    await this.readInstalled()
    const branch = await this.git.currentBranch()
    const state: RemoteState = {
      branch,
      blockedBy: null,
      dirtyFiles: [],
      behind: 0,
      remoteVersion: null,
      remoteCommit: null
    }
    if (branch === null) {
      this.remote = { ...state, blockedBy: 'detached' }
      return
    }
    const upstream = await this.git.upstream()
    if (upstream === null) {
      this.remote = { ...state, blockedBy: 'no-upstream' }
      return
    }
    if (fetch) await this.git.fetch(branch)

    state.remoteCommit = await this.git.head('@{u}')
    const manifest = await this.git.showFile('@{u}', MANIFEST_PATH)
    state.remoteVersion = manifest ? readVersion(manifest) : null

    const { ahead, behind } = await this.git.aheadBehind()
    state.behind = behind
    state.dirtyFiles = await this.git.dirtyFiles()
    if (behind > 0 && ahead > 0) state.blockedBy = 'diverged'
    else if (behind > 0 && state.dirtyFiles.length > 0)
      state.blockedBy = 'dirty'
    this.remote = state
  }

  private async readInstalled(): Promise<void> {
    try {
      const raw = await readFile(
        join(this.extensionDir, 'manifest.json'),
        'utf-8'
      )
      const manifest = JSON.parse(raw)
      this.installedVersion =
        typeof manifest.version === 'string' ? manifest.version : null
      this.installedCommit = parseCommitFromVersionName(manifest.version_name)
    } catch {
      this.installedVersion = null
      this.installedCommit = null
    }
  }

  // ---------- 更新流水线 ----------

  /**
   * 拉取并构建。manual：不看版本号，总是重新构建；auto：由 checkAndMaybeUpdate 决定是否调用。
   * 已有任务在跑时直接返回该任务。
   */
  async update(trigger: UpdateTrigger): Promise<UpdateJob> {
    if (this.busy && this.job?.state === 'running') return this.job
    if (this.busy) {
      // 正在做检查，等它结束再开始
      await this.waitIdle()
    }
    this.busy = true
    const job: UpdateJob = {
      id: this.createId(),
      trigger,
      state: 'running',
      step: 'fetch',
      startedAt: this.now().toISOString(),
      finishedAt: null,
      message: null,
      logTail: [],
      version: null,
      commit: null,
      serverRestart: false
    }
    this.job = job

    try {
      this.setStep('fetch')
      try {
        await this.refreshRemote(true)
      } catch (error) {
        throw new StepError('fetch', errorMessage(error), tailOf(error))
      }
      this.lastCheckAt = this.now().toISOString()
      this.lastCheckError = null

      const { blockedBy, behind, dirtyFiles } = this.remote
      if (blockedBy === 'diverged') {
        throw new StepError(
          'pull',
          '本地和远端已分叉，无法 fast-forward，请手动处理'
        )
      }
      if (blockedBy === 'dirty') {
        throw new StepError(
          'pull',
          `工作区有未提交的改动，已跳过拉取：${dirtyFiles.slice(0, 5).join('、')}`
        )
      }

      let changed: string[] = []
      if (behind > 0) {
        this.setStep('pull')
        const before = await this.git.head()
        try {
          await this.git.fastForward()
        } catch (error) {
          throw new StepError('pull', errorMessage(error), tailOf(error))
        }
        changed = await this.git.changedFiles(before, await this.git.head())
      }

      if (changed.includes('pnpm-lock.yaml')) {
        this.setStep('install')
        await this.runStep(
          'install',
          ['pnpm', 'install', '--frozen-lockfile'],
          {
            timeoutMs: INSTALL_TIMEOUT_MS
          }
        )
      }

      const commit = shortSha(await this.git.head())!
      this.setStep('build')
      await rm(this.stagingDir, { recursive: true, force: true })
      await this.runStep(
        'build',
        ['pnpm', '--filter', '@vite-crx/extension', 'build'],
        {
          timeoutMs: BUILD_TIMEOUT_MS,
          env: {
            CRX_ENV: 'production',
            CRX_OUT_DIR: this.stagingDir,
            CRX_BUILD_COMMIT: commit
          }
        }
      )

      this.setStep('verify')
      const version = await this.verifyStaging()

      this.setStep('swap')
      await rm(this.prevDir, { recursive: true, force: true })
      if (await exists(this.extensionDir)) {
        await rename(this.extensionDir, this.prevDir)
      }
      await rename(this.stagingDir, this.extensionDir)

      await this.readInstalled()
      job.state = 'success'
      job.version = version
      job.commit = commit
      job.serverRestart = changed.some(
        (file) =>
          file.startsWith('apps/server/') || file.startsWith('packages/shared/')
      )
      job.message = job.serverRestart
        ? `已更新到 ${version}（${commit}），服务端代码有变化，请重启 daemon`
        : `已更新到 ${version}（${commit}）`
      this.lastFailedRemoteCommit = null
    } catch (error) {
      const stepError =
        error instanceof StepError
          ? error
          : new StepError(job.step, errorMessage(error), tailOf(error))
      job.state = 'failed'
      job.step = stepError.step
      job.message = stepError.message
      job.logTail = stepError.logTail
      if (trigger === 'auto')
        this.lastFailedRemoteCommit = this.remote.remoteCommit
      await rm(this.stagingDir, { recursive: true, force: true }).catch(
        () => undefined
      )
    } finally {
      job.finishedAt = this.now().toISOString()
      this.busy = false
    }

    this.emit(job.state === 'success' ? 'ready' : 'failed')
    return job
  }

  private setStep(step: UpdateStep): void {
    if (!this.job) return
    this.job.step = step
    this.emit('progress')
  }

  private async runStep(
    step: UpdateStep,
    cmd: string[],
    options: { timeoutMs: number; env?: Record<string, string> }
  ): Promise<void> {
    try {
      await runOrThrow(this.options.run, cmd, {
        cwd: this.options.repoRoot,
        ...options
      })
    } catch (error) {
      throw new StepError(step, errorMessage(error), tailOf(error))
    }
  }

  private async verifyStaging(): Promise<string> {
    for (const file of REQUIRED_FILES) {
      if (!(await exists(join(this.stagingDir, file)))) {
        throw new StepError('verify', `构建产物缺少 ${file}`)
      }
    }
    let manifest: any
    try {
      manifest = JSON.parse(
        await readFile(join(this.stagingDir, 'manifest.json'), 'utf-8')
      )
    } catch {
      throw new StepError('verify', 'manifest.json 不是合法的 JSON')
    }
    if (
      typeof manifest.version !== 'string' ||
      manifest.manifest_version !== 3
    ) {
      throw new StepError('verify', 'manifest.json 缺少 version 或不是 MV3')
    }
    return manifest.version
  }

  private async waitIdle(): Promise<void> {
    while (this.busy) await new Promise((r) => setTimeout(r, 50))
  }

  private emit(kind: UpdateEventKind): void {
    const status = this.getStatus()
    for (const listener of this.listeners) {
      try {
        listener(kind, status)
      } catch (error) {
        console.error('[server:update] listener error:', error)
      }
    }
  }
}

function readVersion(manifestText: string): string | null {
  try {
    const version = JSON.parse(manifestText).version
    return typeof version === 'string' ? version : null
  } catch {
    return null
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function tailOf(error: unknown): string[] {
  if (error instanceof CommandError) {
    return lastLines(
      `${error.result.stdout}\n${error.result.stderr}`,
      LOG_TAIL_LINES
    )
  }
  return []
}
