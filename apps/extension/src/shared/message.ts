/**
 * 类型化消息层：所有 taskId 的入参/出参契约集中定义在这里，
 * 供 background / contentScript / popup / options 共享。
 *
 * 单向扩展 taskId 即可获得全链路类型推导：
 *   'xxx': { params: <入参类型>, response: <出参类型> }
 *
 * 方向：
 *   - contentScript / popup / options -> background：sendMessage
 *   - background -> contentScript：sendMessageToTab（配合 tabs.sendMessage）
 */
import type {
  HealthResponse,
  UpdateConfig,
  UpdateStatus
} from '@vite-crx/shared'

export type NetworkErrorCode =
  'SERVICE_UNAVAILABLE' | 'TIMEOUT' | 'PROTOCOL_ERROR' | 'CONNECTION_CLOSED'

export interface SerializableNetworkError {
  code: NetworkErrorCode
  message: string
}

export type NetworkResult<T> =
  { ok: true; data: T } | { ok: false; error: SerializableNetworkError }

export type WebSocketConnectionState =
  'connecting' | 'connected' | 'disconnected' | 'error'

export interface WebSocketStatusResponse {
  state: WebSocketConnectionState
  error: SerializableNetworkError | null
}

/** 当前加载的扩展自身的版本信息 */
export interface LocalVersionInfo {
  version: string
  versionName: string
  commit: string | null
  /** 最近一次由 daemon 触发的自动重载 */
  lastUpdate: { version: string; commit: string; at: number } | null
}

export interface TaskMap {
  /** contentScript 通过 background 读写 IndexedDB 缓存 */
  'get-value-bg': { params: { keyName: string }; response: { result: any } }
  'set-value-bg': {
    params: { keyName: string; value: any }
    response: { result: any }
  }
  'del-value-bg': { params: { keyName: string }; response: { result: any } }
  /** popup / options 通过 background 读写 chrome.storage.sync 设置 */
  'get-setting': { params: { key: string }; response: { result: any } }
  'set-setting': {
    params: { key: string; value: any }
    response: { result: any }
  }
  /** background 通过 contextMenus 点击向当前标签页的 contentScript 推送消息 */
  'ping-content': {
    params: void
    response: { url: string; title: string; injectedAt: number }
  }
  /** Background HTTP health check against the local server */
  'server-health': {
    params: void
    response: NetworkResult<HealthResponse>
  }
  /** Background-owned local-server WebSocket connection status */
  'server-ws-status': {
    params: void
    response: WebSocketStatusResponse
  }
  /** Background-owned local-server WebSocket echo */
  'server-ws-echo': {
    params: { text: string }
    response: NetworkResult<{ text: string }>
  }
  /** daemon 更新状态（经 background 访问本地服务） */
  'update-status': { params: void; response: NetworkResult<UpdateStatus> }
  /** 立即执行一次 git fetch + 版本检查 */
  'update-check': { params: void; response: NetworkResult<UpdateStatus> }
  /** 手动拉取并重新构建，不看版本号 */
  'update-run': { params: void; response: NetworkResult<UpdateStatus> }
  /** 修改自动更新开关 / 检查间隔 */
  'update-set-config': {
    params: Partial<UpdateConfig>
    response: NetworkResult<UpdateStatus>
  }
  'update-local-info': { params: void; response: LocalVersionInfo }
  /** background -> popup / options：更新状态变化广播 */
  'update-changed': { params: UpdateStatus; response: void }
}

export type TaskId = keyof TaskMap

export interface MessageRequest<T extends TaskId = TaskId> {
  taskId: T
  params: TaskMap[T]['params']
}

/** 各页面 -> background */
export const sendMessage = <T extends TaskId>(
  taskId: T,
  params: TaskMap[T]['params']
): Promise<TaskMap[T]['response']> => {
  return chrome.runtime.sendMessage({ taskId, params } as MessageRequest<T>)
}

/** background -> contentScript（指定标签页） */
export const sendMessageToTab = <T extends TaskId>(
  tabId: number,
  taskId: T,
  params: TaskMap[T]['params']
): Promise<TaskMap[T]['response']> => {
  return chrome.tabs.sendMessage(tabId, { taskId, params } as MessageRequest<T>)
}

/** 注册 taskId 处理器；callback 返回 Promise 时保持通道开启（异步 sendResponse） */
export const onMessage = <T extends TaskId>(
  taskId: T,
  callback: (params: TaskMap[T]['params']) => any
) => {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.taskId !== taskId) return
    const result = callback(request.params)
    if (result && typeof result.then === 'function') {
      result.then(
        (data) => sendResponse(data),
        () => sendResponse(undefined)
      )
      return true
    }
    sendResponse(result)
  })
}
