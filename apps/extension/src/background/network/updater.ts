import {
  HTTP_TIMEOUT_MS,
  UPDATE_API,
  parseCommitFromVersionName,
  type UpdateConfig,
  type UpdateStatus
} from '@vite-crx/shared'
import { SERVER_HTTP_BASE } from '~/shared/serverUrl'
import type { LocalVersionInfo, NetworkResult } from '~/shared/message'

const STORAGE_KEY = 'viteCrxUpdate'
export const UPDATE_POLL_ALARM = 'vite-crx-update-poll'

interface StoredUpdateState {
  /** 已经为这个 commit 重载过一次；重载后仍不一致就不再重试，避免死循环 */
  reloadAttemptFor?: string
  /** 重载前写入，新 background 启动后据此确认更新成功 */
  pending?: { version: string; commit: string; at: number }
  lastUpdate?: { version: string; commit: string; at: number }
}

/**
 * daemon 刚把 extension/ 换成了新产物（磁盘上的 commit 和当前加载的不一致）时需要重载。
 * 只要任务还在跑，或已为这个 commit 重载过，就不重载。
 */
export function shouldReload(
  status: UpdateStatus,
  loadedCommit: string | null,
  reloadAttemptFor: string | undefined
): boolean {
  if (!status.enabled) return false
  if (status.job?.state === 'running') return false
  const diskCommit = status.installedCommit
  if (!diskCommit || diskCommit === loadedCommit) return false
  return reloadAttemptFor !== diskCommit
}

export function loadedCommit(): string | null {
  return parseCommitFromVersionName(chrome.runtime.getManifest().version_name)
}

async function readState(): Promise<StoredUpdateState> {
  const data = await chrome.storage.local.get(STORAGE_KEY)
  return (data[STORAGE_KEY] as StoredUpdateState) ?? {}
}

async function writeState(state: StoredUpdateState): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: state })
}

/** 调用 daemon 的更新接口 */
export async function updateApi(
  path: string,
  init: RequestInit = {}
): Promise<NetworkResult<UpdateStatus>> {
  try {
    const res = await fetch(`${SERVER_HTTP_BASE}${path}`, {
      ...init,
      // check 要等 git fetch，给长一点
      signal: AbortSignal.timeout(
        path === UPDATE_API.check ? 90_000 : HTTP_TIMEOUT_MS
      ),
      headers: init.body ? { 'content-type': 'application/json' } : undefined
    })
    if (!res.ok) {
      return {
        ok: false,
        error: { code: 'PROTOCOL_ERROR', message: `HTTP ${res.status}` }
      }
    }
    const status = (await res.json()) as UpdateStatus
    void handleUpdateStatus(status)
    return { ok: true, data: status }
  } catch (error) {
    const timeout =
      error instanceof DOMException && error.name === 'TimeoutError'
    return {
      ok: false,
      error: {
        code: timeout ? 'TIMEOUT' : 'SERVICE_UNAVAILABLE',
        message: error instanceof Error ? error.message : '无法连接本地服务'
      }
    }
  }
}

export const fetchUpdateStatus = () => updateApi(UPDATE_API.status)
export const runUpdateCheck = () =>
  updateApi(UPDATE_API.check, { method: 'POST' })
export const runUpdate = () => updateApi(UPDATE_API.run, { method: 'POST' })
export const setUpdateConfig = (config: Partial<UpdateConfig>) =>
  updateApi(UPDATE_API.config, { method: 'PUT', body: JSON.stringify(config) })

/** 收到最新状态（WebSocket 推送或接口返回）：更新 badge、通知页面、必要时重载 */
export async function handleUpdateStatus(status: UpdateStatus): Promise<void> {
  updateBadge(status)
  chrome.runtime
    .sendMessage({ taskId: 'update-changed', params: status })
    .catch(() => undefined) // popup / options 没打开时没人接收

  const state = await readState()
  if (!shouldReload(status, loadedCommit(), state.reloadAttemptFor)) return

  const commit = status.installedCommit!
  await writeState({
    ...state,
    reloadAttemptFor: commit,
    pending: { version: status.installedVersion ?? '', commit, at: Date.now() }
  })
  console.log(`[bg:update] 检测到新产物 ${commit}，重载扩展`)
  // 稍等一下，让广播和 storage 写入完成
  setTimeout(() => chrome.runtime.reload(), 300)
}

function updateBadge(status: UpdateStatus): void {
  if (!status.enabled) return
  let text = ''
  let color = '#409eff'
  if (status.job?.state === 'running') {
    text = '…'
  } else if (status.job?.state === 'failed') {
    text = '!'
    color = '#f56c6c'
  } else if (status.updateAvailable && status.blockedBy) {
    text = '!'
    color = '#e6a23c'
  }
  void chrome.action.setBadgeText({ text })
  if (text) void chrome.action.setBadgeBackgroundColor({ color })
}

/** 重载后已打开页面里的旧 content script 和扩展断开了，重新注入一次 */
async function reinjectContentScripts(): Promise<void> {
  const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] })
  await Promise.all(
    tabs.map((tab) =>
      tab.id === undefined
        ? undefined
        : chrome.scripting
            .executeScript({
              target: { tabId: tab.id },
              files: ['contentScript/index.js']
            })
            .catch(() => undefined)
    )
  )
}

/** background 启动时调用：确认上一次自动重载是否成功 */
export async function finishPendingUpdate(): Promise<void> {
  const state = await readState()
  if (!state.pending) return
  const mine = loadedCommit()
  if (mine === state.pending.commit) {
    console.log(`[bg:update] 已更新到 ${state.pending.version}（${mine}）`)
    await writeState({
      ...state,
      pending: undefined,
      lastUpdate: state.pending
    })
    await reinjectContentScripts()
  } else {
    await writeState({ ...state, pending: undefined })
  }
}

export async function getLocalVersionInfo(): Promise<LocalVersionInfo> {
  const manifest = chrome.runtime.getManifest()
  const state = await readState()
  return {
    version: manifest.version,
    versionName: manifest.version_name ?? manifest.version,
    commit: loadedCommit(),
    lastUpdate: state.lastUpdate ?? null
  }
}
