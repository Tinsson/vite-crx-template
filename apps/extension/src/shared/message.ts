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
import type { HealthResponse } from '@vite-crx/shared'

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
