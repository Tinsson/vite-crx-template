import type { Plugin, ResolvedConfig } from 'vite'
import { WebSocketServer } from 'ws'
import { bgUpdatePort } from '../../const'

const isDev = true

const hotReloadBackground = (): Plugin => {
  let wss: any = null

  // 初始化websocket链接用于监听
  const initSocket = () => {
    wss = new WebSocketServer({ port: bgUpdatePort });
    wss.on('connection', function connection(ws) {
      // 启动心跳监听，便于重连
      ws.send('heartbeatMonitor')
      const interval = setInterval(() => {
        ws.send('heartbeat')
      }, 3000);

      ws.on('close', () => {
        clearInterval(interval);
      })
    })
  }

  return {
    name: 'hot-reload-background',
    enforce: 'pre',
    configResolved(config: ResolvedConfig) {
      // 启动 websocket服务
      if (isDev) {
        initSocket()
      }
    },
    writeBundle() {
      // 通过socket触发reload
      if (wss) {
        wss.clients.forEach((ws) => {
          ws.send('updateCode')
        })
      }
    }
  }
}

export default hotReloadBackground
