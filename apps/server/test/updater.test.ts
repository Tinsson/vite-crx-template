import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { bunRunner, type Runner } from '../src/updater/exec.ts'
import { UpdateService } from '../src/updater/service.ts'

const GIT_ENV = {
  GIT_AUTHOR_NAME: 'test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'test',
  GIT_COMMITTER_EMAIL: 'test@example.com'
}

async function sh(cwd: string, ...cmd: string[]) {
  const result = await bunRunner(cmd, { cwd, env: GIT_ENV })
  if (result.code !== 0) throw new Error(`${cmd.join(' ')}: ${result.stderr}`)
  return result.stdout.trim()
}

const manifest = (version: string) =>
  JSON.stringify({ manifest_version: 3, name: 't', version }, null, 2)

let root: string
let upstreamWork: string // 模拟别人推代码的工作副本
let repo: string // daemon 所在的“当前仓库”
let pnpmCalls: string[][]
let failBuild: boolean

/** git 走真实命令；pnpm 换成假的：build 时按 CRX_OUT_DIR 写出最小产物 */
const runner: Runner = async (cmd, options = {}) => {
  if (cmd[0] !== 'pnpm') {
    return bunRunner(cmd, { ...options, env: { ...GIT_ENV, ...options.env } })
  }
  pnpmCalls.push(cmd)
  if (cmd.includes('build')) {
    if (failBuild) {
      return { code: 1, stdout: 'building...', stderr: 'boom: build failed' }
    }
    const out = options.env!.CRX_OUT_DIR!
    const src = JSON.parse(
      await readFile(
        join(options.cwd!, 'apps/extension/src/manifest.json'),
        'utf-8'
      )
    )
    src.version_name = `${src.version} (${options.env!.CRX_BUILD_COMMIT})`
    for (const dir of ['background', 'contentScript', 'popup']) {
      await mkdir(join(out, dir), { recursive: true })
    }
    await writeFile(join(out, 'manifest.json'), JSON.stringify(src))
    await writeFile(join(out, 'background/index.js'), '')
    await writeFile(join(out, 'contentScript/index.js'), '')
    await writeFile(join(out, 'popup/index.html'), '')
  }
  return { code: 0, stdout: '', stderr: '' }
}

async function pushVersion(version: string, extraFile?: string) {
  await writeFile(
    join(upstreamWork, 'apps/extension/src/manifest.json'),
    manifest(version)
  )
  if (extraFile) {
    await mkdir(dirname(join(upstreamWork, extraFile)), { recursive: true })
    await writeFile(join(upstreamWork, extraFile), `${version}\n`)
  }
  await sh(upstreamWork, 'git', 'add', '-A')
  await sh(upstreamWork, 'git', 'commit', '-qm', `v${version}`)
  await sh(upstreamWork, 'git', 'push', '-q', 'origin', 'HEAD:main')
}

function createService(
  extra: Partial<ConstructorParameters<typeof UpdateService>[0]> = {}
) {
  return new UpdateService({
    repoRoot: repo,
    configFile: join(root, 'home/config.json'),
    run: runner,
    ...extra
  })
}

beforeEach(async () => {
  pnpmCalls = []
  failBuild = false
  root = await mkdtemp(join(tmpdir(), 'vite-crx-updater-'))
  const remote = join(root, 'remote.git')
  upstreamWork = join(root, 'upstream')
  repo = join(root, 'repo')
  await sh(root, 'git', 'init', '-q', '--bare', '-b', 'main', remote)
  await sh(root, 'git', 'clone', '-q', remote, upstreamWork)
  await sh(upstreamWork, 'git', 'checkout', '-q', '-b', 'main')
  await mkdir(join(upstreamWork, 'apps/extension/src'), { recursive: true })
  await pushVersion('0.0.1')
  await sh(root, 'git', 'clone', '-q', remote, repo)
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('UpdateService check', () => {
  test('reports update available when nothing is installed', async () => {
    const service = createService()
    await service.init()
    expect(await service.check()).toBe(true)
    const status = service.getStatus()
    expect(status.branch).toBe('main')
    expect(status.remoteVersion).toBe('0.0.1')
    expect(status.installedVersion).toBeNull()
    expect(status.updateAvailable).toBe(true)
    expect(status.blockedBy).toBeNull()
  })

  test('blocks when tracked files are dirty and remote is ahead', async () => {
    const service = createService()
    await service.init()
    await service.update('manual')
    await pushVersion('0.0.2')
    await writeFile(
      join(repo, 'apps/extension/src/manifest.json'),
      manifest('9.9.9')
    )
    await service.checkAndMaybeUpdate()
    const status = service.getStatus()
    expect(status.blockedBy).toBe('dirty')
    expect(status.dirtyFiles).toContain('apps/extension/src/manifest.json')
    expect(status.installedVersion).toBe('0.0.1')
  })

  test('detached HEAD is reported as blocked', async () => {
    await sh(repo, 'git', 'checkout', '-q', '--detach')
    const service = createService()
    await service.init()
    await service.check()
    expect(service.getStatus().blockedBy).toBe('detached')
  })
})

describe('UpdateService update pipeline', () => {
  test('auto update pulls, builds into staging and swaps extension/', async () => {
    const service = createService()
    await service.init()
    const events: string[] = []
    service.onEvent((kind) => events.push(kind))

    await service.checkAndMaybeUpdate()
    let status = service.getStatus()
    expect(status.installedVersion).toBe('0.0.1')
    expect(status.job?.state).toBe('success')

    await pushVersion('0.0.2')
    await service.checkAndMaybeUpdate()
    status = service.getStatus()
    expect(status.installedVersion).toBe('0.0.2')
    expect(status.installedCommit).toBe(status.remoteCommit)
    expect(status.updateAvailable).toBe(false)
    expect(status.job?.trigger).toBe('auto')
    expect(existsSync(join(repo, 'extension.prev/manifest.json'))).toBe(true)
    expect(existsSync(join(repo, 'extension.staging'))).toBe(false)
    expect(events).toContain('ready')
    expect(events).toContain('progress')
  })

  test('does not rebuild when remote version is not higher', async () => {
    const service = createService()
    await service.init()
    await service.checkAndMaybeUpdate()
    pnpmCalls = []
    // 远端有新提交，但版本号没变
    await pushVersion('0.0.1', 'README.md')
    await service.checkAndMaybeUpdate()
    expect(pnpmCalls).toEqual([])
  })

  test('failed build keeps extension/ and is not retried for the same commit', async () => {
    const service = createService()
    await service.init()
    await service.checkAndMaybeUpdate()
    await pushVersion('0.0.2')
    failBuild = true
    await service.checkAndMaybeUpdate()
    let status = service.getStatus()
    expect(status.job?.state).toBe('failed')
    expect(status.job?.step).toBe('build')
    expect(status.job?.logTail.join('\n')).toContain('boom')
    expect(status.installedVersion).toBe('0.0.1')

    pnpmCalls = []
    await service.checkAndMaybeUpdate()
    expect(pnpmCalls).toEqual([])

    // 手动更新不受限制
    failBuild = false
    await service.update('manual')
    status = service.getStatus()
    expect(status.installedVersion).toBe('0.0.2')
  })

  test('runs pnpm install when lockfile changed and flags server restart', async () => {
    const service = createService()
    await service.init()
    await service.checkAndMaybeUpdate()
    await pushVersion('0.0.2', 'pnpm-lock.yaml')
    await pushVersion('0.0.3', 'apps/server/src/x.ts')
    pnpmCalls = []
    await service.checkAndMaybeUpdate()
    expect(pnpmCalls[0]).toEqual(['pnpm', 'install', '--frozen-lockfile'])
    expect(service.getStatus().job?.serverRestart).toBe(true)
  })
})

describe('UpdateService config and scheduling', () => {
  test('setConfig clamps interval, persists and reschedules', async () => {
    const timers: number[] = []
    const now = new Date('2026-01-01T00:00:00Z')
    const service = createService({
      now: () => now,
      setTimeout: ((_cb: () => void, ms: number) => {
        timers.push(ms)
        return 0 as any
      }) as any,
      clearTimeout: () => undefined
    })
    await service.init()
    expect(service.getStatus().config.checkIntervalMinutes).toBe(60)
    service.startScheduler()
    expect(timers[0]).toBe(30_000)

    const status = await service.setConfig({ checkIntervalMinutes: 1 })
    expect(status.config.checkIntervalMinutes).toBe(5)
    expect(timers.at(-1)).toBe(5 * 60_000)
    expect(status.nextCheckAt).toBe('2026-01-01T00:05:00.000Z')
    const saved = JSON.parse(
      await readFile(join(root, 'home/config.json'), 'utf-8')
    )
    expect(saved).toEqual({ autoUpdate: true, checkIntervalMinutes: 5 })

    const off = await service.setConfig({ autoUpdate: false })
    expect(off.nextCheckAt).toBeNull()
  })

  test('interval override wins over config file', async () => {
    const service = createService({ intervalOverride: 30 })
    await service.init()
    expect(service.intervalMinutes).toBe(30)
  })
})
