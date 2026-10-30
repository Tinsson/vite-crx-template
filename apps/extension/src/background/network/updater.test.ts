import { describe, expect, it, vi } from 'vitest'
import type { UpdateStatus } from '@vite-crx/shared'
import { shouldReload } from './updater'
import { WebSocketClient, type WebSocketLike } from './webSocketClient'

const status = (patch: Partial<UpdateStatus> = {}): UpdateStatus => ({
  enabled: true,
  branch: 'master',
  installedVersion: '0.0.2',
  installedCommit: 'bbbbbbb',
  remoteVersion: '0.0.2',
  remoteCommit: 'bbbbbbb',
  updateAvailable: false,
  blockedBy: null,
  dirtyFiles: [],
  job: null,
  lastCheckAt: null,
  nextCheckAt: null,
  lastCheckError: null,
  config: { autoUpdate: true, checkIntervalMinutes: 60 },
  ...patch
})

describe('shouldReload', () => {
  it('reloads when disk commit differs from the loaded one', () => {
    expect(shouldReload(status(), 'aaaaaaa', undefined)).toBe(true)
    // 手动 pnpm build 的产物没有 commit，也要能切到 daemon 的产物
    expect(shouldReload(status(), null, undefined)).toBe(true)
  })

  it('does not reload when commits match', () => {
    expect(shouldReload(status(), 'bbbbbbb', undefined)).toBe(false)
  })

  it('does not reload while a job is running or updater is disabled', () => {
    const running = status({
      job: { state: 'running' } as UpdateStatus['job']
    })
    expect(shouldReload(running, 'aaaaaaa', undefined)).toBe(false)
    expect(shouldReload(status({ enabled: false }), 'aaaaaaa', undefined)).toBe(
      false
    )
    expect(
      shouldReload(status({ installedCommit: null }), 'aaaaaaa', undefined)
    ).toBe(false)
  })

  it('only tries once per commit to avoid reload loops', () => {
    expect(shouldReload(status(), 'aaaaaaa', 'bbbbbbb')).toBe(false)
  })
})

describe('WebSocketClient update events', () => {
  it('forwards update-event to onUpdateEvent', async () => {
    let socket: any
    const onUpdateEvent = vi.fn()
    const client = new WebSocketClient({
      createWebSocket: () => {
        socket = {
          readyState: 0,
          onopen: null,
          onclose: null,
          onerror: null,
          onmessage: null,
          send: vi.fn(),
          close: vi.fn()
        } satisfies WebSocketLike
        return socket
      },
      setTimeout: () => ({}),
      clearTimeout: () => undefined,
      onUpdateEvent
    })
    const connected = client.ensureConnected()
    socket.readyState = 1
    socket.onopen(new Event('open'))
    await connected
    socket.onmessage({
      data: JSON.stringify({
        type: 'update-event',
        id: '1',
        data: { kind: 'ready', status: status() }
      })
    })
    expect(onUpdateEvent).toHaveBeenCalledWith({
      kind: 'ready',
      status: status()
    })
    expect(client.getStatus().state).toBe('connected')
  })
})
