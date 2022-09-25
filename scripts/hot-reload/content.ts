import type { Plugin, ResolvedConfig } from 'vite'
import { WebSocketServer } from 'ws'
import http from 'http'
import child_process from 'child_process'
import { contentUpdatePort, initServerPort } from '../../const'

// 打开网页，判断平台
const openURL = (url) => {
  switch (process.platform) {
    case 'darwin':
      child_process.spawn('open', [url])
      break;
    case 'win32':
      child_process.spawn('start', [url])
      break;
    default:
      child_process.spawn('xdg-open', [url])
  }
};

const isDev = true

const hotReloadContent = (): Plugin => {
  let wss: any = null
  let hasOpenTriggerInit = false

  // 初始化websocket链接用于监听
  const initSocket = () => {
    wss = new WebSocketServer({ port: contentUpdatePort });
  }

  // 用于初始化的服务器
  const initServer = () => {
    const router = (req, res) => {
      res.end(`this page url = ${req.url}`);
    }
    const server = http.createServer(router)
    server.listen(initServerPort, function() {
      console.log(`the server is started at port ${initServerPort} for init refresh`)
    })
  }

  return {
    name: 'hot-reload-content',
    enforce: 'pre',
    configResolved(config: ResolvedConfig) {
      // 启动 websocket服务
      if (isDev) {
        initSocket()
        initServer()
      }
    },
    writeBundle() {
      // 通过socket触发reload
      if (wss) {
        wss.clients.forEach((ws) => {
          ws.send('updateCode')
        })
      }
      if (!hasOpenTriggerInit) {
        hasOpenTriggerInit = true
        openURL(`http://127.0.0.1:${initServerPort}`)
      }
    }
  }
}

export default hotReloadContent
