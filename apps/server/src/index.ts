import { app, handleWebSocketMessage } from './app.ts'
import { SERVER_HOST, SERVER_PORT } from './constants.ts'
import { Heartbeat, type HeartbeatOptions } from './heartbeat.ts'

const fetchHandler = (request: Request, server: Bun.Server<undefined>) => {
  return app.fetch(request, { server })
}

export function createServerOptions(heartbeatOptions?: HeartbeatOptions) {
  const heartbeats = new WeakMap<Bun.ServerWebSocket, Heartbeat>()

  return {
    hostname: SERVER_HOST,
    port: SERVER_PORT,
    fetch: fetchHandler,
    websocket: {
      open(ws: Bun.ServerWebSocket) {
        console.log('[server:ws] connected')
        const heartbeat = new Heartbeat(ws, heartbeatOptions)
        heartbeats.set(ws, heartbeat)
        heartbeat.start()
      },
      message(ws: Bun.ServerWebSocket, message: string | Buffer) {
        if (typeof message === 'string') {
          handleWebSocketMessage(ws, message, (id) =>
            heartbeats.get(ws)?.handlePong(id)
          )
        } else {
          handleWebSocketMessage(ws, message.toString('utf-8'), (id) =>
            heartbeats.get(ws)?.handlePong(id)
          )
        }
      },
      close(ws: Bun.ServerWebSocket, code: number, reason: string) {
        console.log(`[server:ws] closed: ${code} ${reason}`)
        heartbeats.get(ws)?.stop()
        heartbeats.delete(ws)
      },
      error(ws: Bun.ServerWebSocket, error: Error) {
        console.error('[server:ws] error:', error)
        heartbeats.get(ws)?.stop()
        heartbeats.delete(ws)
      }
    }
  }
}

export const serverOptions = createServerOptions()

export default serverOptions
