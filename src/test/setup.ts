import { vi } from 'vitest'
import {
  indexedDB,
  IDBKeyRange,
  IDBRequest,
  IDBOpenDBRequest,
  IDBCursor,
  IDBCursorWithValue,
  IDBDatabase,
  IDBObjectStore,
  IDBTransaction,
  IDBIndex
} from 'fake-indexeddb'

// IndexedDB polyfill（db.ts 依赖 idb，运行时引用这些全局）
Object.assign(globalThis, {
  indexedDB,
  IDBKeyRange,
  IDBRequest,
  IDBOpenDBRequest,
  IDBCursor,
  IDBCursorWithValue,
  IDBDatabase,
  IDBObjectStore,
  IDBTransaction,
  IDBIndex
})

type Listener = (
  message: any,
  sender: any,
  sendResponse: (response?: any) => void
) => any

const listeners: Listener[] = []

/**
 * 模拟 chrome.runtime.onMessage 派发（与真实 Chrome 一致）：
 *  - 同步回调：sendResponse 被同步调用 → 直接返回
 *  - 异步回调：监听器返回 true 保持通道 → 等待 sendResponse 异步调用
 *  - 监听器返回 Promise（新版 onMessage 写法）→ await 其结果
 * 无人响应时抛错（与真实 Chrome 行为一致）。
 */
const dispatch = async (message: any): Promise<any> => {
  for (const cb of listeners) {
    let settleResponse: ((response?: any) => void) | null = null
    const settlePromise = new Promise<any>((resolve) => {
      settleResponse = resolve
    })

    let syncCalled = false
    let syncValue: any
    const sendResponse = (res?: any) => {
      if (!syncCalled) {
        syncCalled = true
        syncValue = res
      }
      settleResponse?.(res)
    }

    let result: any
    try {
      result = cb(message, undefined, sendResponse)
    } catch {
      settleResponse?.(undefined)
      continue
    }

    if (syncCalled) {
      return syncValue
    }
    if (result === true) {
      return await settlePromise
    }
    if (result && typeof result.then === 'function') {
      try {
        return await result
      } catch {
        return undefined
      }
    }
  }
  throw new Error('The message port closed before a response was received.')
}

const chromeMock = {
  _listeners: listeners,
  runtime: {
    onMessage: {
      addListener(cb: Listener) {
        listeners.push(cb)
      }
    },
    sendMessage: vi.fn(dispatch)
  },
  tabs: {
    sendMessage: vi.fn((_tabId: number, message: any) => dispatch(message))
  }
}

;(globalThis as any).chrome = chromeMock

export { chromeMock, dispatch }
