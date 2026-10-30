import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { DAEMON_PORT, serializeMessage } from '@vite-crx/shared'
import { app, configureApp, handleWebSocketMessage } from './app.ts'
import { SERVER_HOST, SERVER_PORT } from './constants.ts'
import { Heartbeat, type HeartbeatOptions } from './heartbeat.ts'
import { bunRunner } from './updater/exec.ts'
import { UpdateService } from './updater/service.ts'

/** `VITE_CRX_MODE=daemon` 时为常驻模式：端口 8788，开启自动更新 */
export const isDaemon = process.env.VITE_CRX_MODE === 'daemon'

const fetchHandler = (request: Request, server: Bun.Server<undefined>) => {
  return app.fetch(request, { server })
}

export function createServerOptions(heartbeatOptions?: HeartbeatOptions) {
  const heartbeats = new WeakMap<Bun.ServerWebSocket, Heartbeat>()
  const clients = new Set<Bun.ServerWebSocket>()

  const broadcast = (message: string) => {
    for (const ws of clients) ws.send(message)
  }

  return {
    hostname: SERVER_HOST,
    port: isDaemon ? DAEMON_PORT : SERVER_PORT,
    fetch: fetchHandler,
    broadcast,
    websocket: {
      open(ws: Bun.ServerWebSocket) {
        console.log('[server:ws] connected')
        clients.add(ws)
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
        clients.delete(ws)
        heartbeats.get(ws)?.stop()
        heartbeats.delete(ws)
      },
      error(ws: Bun.ServerWebSocket, error: Error) {
        console.error('[server:ws] error:', error)
        clients.delete(ws)
        heartbeats.get(ws)?.stop()
        heartbeats.delete(ws)
      }
    }
  }
}

export const serverOptions = createServerOptions()

async function startDaemon(): Promise<void> {
  const home = process.env.VITE_CRX_HOME ?? join(homedir(), '.vite-crx')
  const repoRoot = process.env.VITE_CRX_REPO
    ? resolve(process.env.VITE_CRX_REPO)
    : resolve(import.meta.dir, '../../..')
  const interval = process.env.VITE_CRX_INTERVAL
    ? Number(process.env.VITE_CRX_INTERVAL)
    : undefined

  const service = new UpdateService({
    repoRoot,
    configFile: join(home, 'config.json'),
    run: bunRunner,
    intervalOverride: Number.isFinite(interval) ? interval : undefined
  })
  await service.init()
  service.onEvent((kind, status) => {
    if (kind !== 'progress') {
      console.log(
        `[server:update] ${kind} ${status.job?.state ?? ''} ${status.job?.message ?? ''}`.trim()
      )
    }
    serverOptions.broadcast(
      serializeMessage({
        type: 'update-event',
        id: crypto.randomUUID(),
        data: { kind, status }
      })
    )
  })
  configureApp({ mode: 'daemon', updateService: service })
  service.startScheduler()
  console.log(
    `[server] daemon 已启动：http://${SERVER_HOST}:${DAEMON_PORT}，仓库 ${repoRoot}，检查间隔 ${service.intervalMinutes} 分钟`
  )
}

// 只有作为入口运行时才启动 daemon，测试里 import 不会触发
if (isDaemon && import.meta.main) {
  await startDaemon()
}

export default serverOptions
