import type { Plugin, ResolvedConfig } from 'vite'
import { WebSocketServer } from 'ws'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { bgUpdatePort, __DEV__ } from '../../const'

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

      ws.on('message', (message) => {
        const info = `${message}`
        // 监听contentScript代码变化，复用一个ws连接
        if (info === 'UPDATE_CONTENT_SCRIPT') {
          wss.clients.forEach((ws) => {
            ws.send('UPDATE_CONTENT_SCRIPT')
          })
        }
      })

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
      if (__DEV__) {
        initSocket()
      }
    },
    transform(code, id) {
      if (id.indexOf('background/index.ts') > 0 && __DEV__) {
        let injectDevCode = `\nconst UP_PORT = ${bgUpdatePort}\n`
        injectDevCode += readFileSync(resolve(__dirname, 'injectCode.js'), 'utf-8')
        return code + injectDevCode
      }
    },
    writeBundle() {
      // 通过socket触发reload
      if (wss !== null) {
        wss.clients.forEach((ws) => {
          ws.send('UPDATE_BG')
        })
      }
    }
  }
}

export default hotReloadBackground
