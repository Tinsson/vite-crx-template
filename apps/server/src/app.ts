import { Hono } from 'hono'
import type { Context } from 'hono'
import {
  parseClientMessage,
  serializeMessage,
  ProtocolError,
  type HealthResponse,
  type EchoRequest,
  type EchoResponse
} from '@vite-crx/shared'
import { WS_CLOSE_CODE_PROTOCOL_ERROR } from './constants.ts'

export const app = new Hono()

app.get('/api/health', (c: Context) => {
  const response: HealthResponse = {
    status: 'ok',
    timestamp: new Date().toISOString()
  }
  return c.json(response)
})

app.get('/ws', (c: Context) => {
  const upgradeHeader = c.req.header('upgrade')
  if (upgradeHeader !== 'websocket') {
    return c.text('Expected WebSocket upgrade', 400)
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
