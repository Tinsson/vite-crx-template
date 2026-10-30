import {
  UPDATE_CHECK_INTERVAL_DEFAULT_MIN,
  UPDATE_CHECK_INTERVAL_MAX_MIN,
  UPDATE_CHECK_INTERVAL_MIN_MIN
} from './config.ts'

export type UpdateStep =
  'fetch' | 'pull' | 'install' | 'build' | 'verify' | 'swap'

export type UpdateTrigger = 'auto' | 'manual'

export type UpdateJobState = 'running' | 'success' | 'failed'

/** 有新版本但不能自动更新的原因 */
export type UpdateBlockReason =
  | 'dirty' // 工作区有未提交的改动
  | 'diverged' // 本地和远端分叉，无法 fast-forward
  | 'no-upstream' // 当前分支没有 upstream
  | 'detached' // 处于 detached HEAD

export interface UpdateConfig {
  autoUpdate: boolean
  checkIntervalMinutes: number
}

export interface UpdateJob {
  id: string
  trigger: UpdateTrigger
  state: UpdateJobState
  step: UpdateStep
  startedAt: string
  finishedAt: string | null
  message: string | null
  /** 失败时最后若干行输出 */
  logTail: string[]
  /** 成功时：新产物的版本号和 commit */
  version: string | null
  commit: string | null
  /** 本次更新改到了服务端代码，daemon 需要重启才能生效 */
  serverRestart: boolean
}

export interface UpdateStatus {
  /** 只有 daemon 模式才开启更新功能；dev 服务端为 false */
  enabled: boolean
  branch: string | null
  installedVersion: string | null
  installedCommit: string | null
  remoteVersion: string | null
  remoteCommit: string | null
  updateAvailable: boolean
  blockedBy: UpdateBlockReason | null
  dirtyFiles: string[]
  job: UpdateJob | null
  lastCheckAt: string | null
  nextCheckAt: string | null
  lastCheckError: string | null
  config: UpdateConfig
}

export type UpdateEventKind = 'checked' | 'progress' | 'ready' | 'failed'

export const DEFAULT_UPDATE_CONFIG: UpdateConfig = {
  autoUpdate: true,
  checkIntervalMinutes: UPDATE_CHECK_INTERVAL_DEFAULT_MIN
}

/** 把间隔截断到允许范围；非法值回落到默认值 */
export function clampInterval(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return UPDATE_CHECK_INTERVAL_DEFAULT_MIN
  return Math.min(
    UPDATE_CHECK_INTERVAL_MAX_MIN,
    Math.max(UPDATE_CHECK_INTERVAL_MIN_MIN, Math.round(n))
  )
}

/** 合并部分配置，并保证结果合法 */
export function normalizeUpdateConfig(
  input: unknown,
  base: UpdateConfig = DEFAULT_UPDATE_CONFIG
): UpdateConfig {
  const obj =
    typeof input === 'object' && input !== null && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {}
  return {
    autoUpdate:
      typeof obj.autoUpdate === 'boolean' ? obj.autoUpdate : base.autoUpdate,
    checkIntervalMinutes:
      'checkIntervalMinutes' in obj
        ? clampInterval(obj.checkIntervalMinutes)
        : base.checkIntervalMinutes
  }
}

/**
 * 比较 Chrome 扩展版本号（1~4 段，点分整数）。
 * a > b 返回正数，相等返回 0，a < b 返回负数；缺少的段按 0 处理。
 */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((s) => Number.parseInt(s, 10) || 0)
  const pb = b.split('.').map((s) => Number.parseInt(s, 10) || 0)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

/** 构建时写入的 version_name 形如 `0.0.1 (abc1234)` */
export function formatVersionName(version: string, commit: string): string {
  return `${version} (${commit})`
}

export function parseCommitFromVersionName(
  versionName: string | undefined | null
): string | null {
  if (!versionName) return null
  const match = /\(([0-9a-f]{7,40})\)\s*$/.exec(versionName)
  return match ? match[1] : null
}

/** 更新相关 HTTP 接口路径 */
export const UPDATE_API = {
  status: '/api/update/status',
  check: '/api/update/check',
  run: '/api/update',
  config: '/api/update/config'
} as const
