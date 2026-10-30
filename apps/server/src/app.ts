import { Hono } from 'hono'
import type { Context } from 'hono'
import {
  parseClientMessage,
  serializeMessage,
  ProtocolError,
  type HealthResponse,
  type EchoRequest,
  type EchoResponse,
  type UpdateStatus,
  UPDATE_API,
  DEFAULT_UPDATE_CONFIG
} from '@vite-crx/shared'
import type { UpdateService } from './updater/service.ts'
import { WS_CLOSE_CODE_PROTOCOL_ERROR } from './constants.ts'

export const app = new Hono()

/** 只有 daemon 模式会注入；dev 服务端没有更新功能 */
let updateService: UpdateService | null = null
let serverMode: 'dev' | 'daemon' = 'dev'

export function configureApp(options: {
  mode: 'dev' | 'daemon'
  updateService?: UpdateService | null
}): void {
  serverMode = options.mode
  updateService = options.updateService ?? null
}

/**
 * 只接受来自扩展的写操作：浏览器里的网页无法伪造 Origin，
 * 这样任意网页都不能通过 localhost 触发 git pull + 构建。
 * 设置 VITE_CRX_EXTENSION_ID 时进一步限定为该扩展。
 */
export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin || !origin.startsWith('chrome-extension://')) return false
  const pinned = process.env.VITE_CRX_EXTENSION_ID
  return !pinned || origin === `chrome-extension://${pinned}`
}

const disabledStatus = (): UpdateStatus => ({
  enabled: false,
  branch: null,
  installedVersion: null,
  installedCommit: null,
  remoteVersion: null,
  remoteCommit: null,
  updateAvailable: false,
  blockedBy: null,
  dirtyFiles: [],
  job: null,
  lastCheckAt: null,
  nextCheckAt: null,
  lastCheckError: null,
  config: { ...DEFAULT_UPDATE_CONFIG }
})

app.get('/api/health', (c: Context) => {
  const response: HealthResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    mode: serverMode
  }
  return c.json(response)
})

app.get(UPDATE_API.status, (c: Context) => {
  return c.json(updateService ? updateService.getStatus() : disabledStatus())
})

const guardWrite = (c: Context): Response | null => {
  if (!isAllowedOrigin(c.req.header('origin'))) {
    return c.json({ error: 'FORBIDDEN_ORIGIN' }, 403)
  }
  if (!updateService) {
    return c.json({ error: 'UPDATE_DISABLED' }, 503)
  }
  return null
}

app.post(UPDATE_API.check, async (c: Context) => {
  const denied = guardWrite(c)
  if (denied) return denied
  await updateService!.check()
  return c.json(updateService!.getStatus())
})

app.post(UPDATE_API.run, (c: Context) => {
  const denied = guardWrite(c)
  if (denied) return denied
  // 不等构建结束：进度通过 WebSocket 推送，也可以轮询 status
  void updateService!.update('manual')
  return c.json(updateService!.getStatus(), 202)
})

app.put(UPDATE_API.config, async (c: Context) => {
  const denied = guardWrite(c)
  if (denied) return denied
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'INVALID_JSON' }, 400)
  }
  return c.json(await updateService!.setConfig(body))
})

app.get('/ws', (c: Context) => {
  const upgradeHeader = c.req.header('upgrade')
  if (upgradeHeader !== 'websocket') {
    return c.text('Expected WebSocket upgrade', 400)
  }

  // daemon 模式下 WebSocket 会推送更新状态，同样只允许扩展连接
  if (serverMode === 'daemon' && !isAllowedOrigin(c.req.header('origin'))) {
    return c.text('Forbidden origin', 403)
  }

  const server = (c.env as any)?.server
  if (!server) {
    return c.text('Server not available', 500)
  }

  const upgraded = server.upgrade(c.req.raw)
  if (!upgraded) {
    return c.text('Upgrade failed', 500)
  }

  return new Response(null)
})

export function handleWebSocketMessage(
  ws: any,
  message: string,
  handlePong: (id: string) => void
): void {
  try {
    const clientMessage = parseClientMessage(message)

    if (clientMessage.type === 'echo-request') {
      const echoRequest = clientMessage as EchoRequest
      const echoResponse: EchoResponse = {
        type: 'echo-response',
        id: echoRequest.id,
        data: { text: echoRequest.data.text }
      }
      ws.send(serializeMessage(echoResponse))
    } else {
      handlePong(clientMessage.id)
    }
  } catch (error) {
    if (error instanceof ProtocolError) {
      console.warn(
        `[server:ws] protocol error: ${error.code} - ${error.message}`
      )
      ws.close(WS_CLOSE_CODE_PROTOCOL_ERROR, 'Protocol error')
    } else {
      console.error('[server:ws] unexpected error:', error)
      ws.close(WS_CLOSE_CODE_PROTOCOL_ERROR, 'Internal error')
    }
  }
}
