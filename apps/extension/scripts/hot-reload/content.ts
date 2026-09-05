import type { Plugin } from 'vite'
import WebSocket from 'ws'
import { bgUpdatePort, __DEV__ } from '../../const.ts'

interface HotReloadSocket {
  on(event: 'open' | 'error' | 'close', listener: () => void): void
  send(data: string): void
}

interface HotReloadContentOptions {
  isDev?: boolean
  createWebSocket?: (url: string) => HotReloadSocket
  setTimeout?: (callback: () => void, delay: number) => unknown
}

const hotReloadContent = (options: HotReloadContentOptions = {}): Plugin => {
  const isDev = options.isDev ?? __DEV__
  const createWebSocket =
    options.createWebSocket ?? ((url: string) => new WebSocket(url))
  const scheduleTimeout =
    options.setTimeout ??
    ((callback: () => void, delay: number) => setTimeout(callback, delay))
  let wsClient: HotReloadSocket | null = null
  let isReady = false
  let retryTimer: unknown = null

  const retryConnection = () => {
    if (retryTimer !== null) return
    retryTimer = scheduleTimeout(() => {
      retryTimer = null
      connectWs()
    }, 1000)
  }

  const connectWs = () => {
    try {
      if (wsClient === null) {
        const socket = createWebSocket(`ws://127.0.0.1:${bgUpdatePort}/`)
        wsClient = socket
        socket.on('open', () => {
          if (wsClient !== socket) return
          isReady = true
        })
        const handleDisconnect = () => {
          if (wsClient !== socket) return
          wsClient = null
          isReady = false
          retryConnection()
        }
        socket.on('error', handleDisconnect)
        socket.on('close', handleDisconnect)
      }
    } catch {
      wsClient = null
      isReady = false
      retryConnection()
    }
  }

  return {
    name: 'hot-reload-content',
    enforce: 'pre',
    configResolved() {
      if (isDev) {
        connectWs()
      }
    },
    writeBundle() {
      // 通过socket触发reload
      if (wsClient && isReady) {
        wsClient.send('UPDATE_CONTENT_SCRIPT')
      }
    }
  }
}

export default hotReloadContent
