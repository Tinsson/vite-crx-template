import { afterEach, describe, expect, it, vi } from 'vitest'
import { WebSocketClient, type WebSocketLike } from './webSocketClient'

class FakeWebSocket implements WebSocketLike {
  readyState = 0
  onopen: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  send = vi.fn()
  close = vi.fn(() => {
    this.readyState = 3
    this.onclose?.(new Event('close') as CloseEvent)
  })

  open(): void {
    this.readyState = 1
    this.onopen?.(new Event('open'))
  }

  receive(message: unknown): void {
    this.onmessage?.({ data: message } as MessageEvent)
  }

  fail(): void {
    this.onerror?.(new Event('error'))
  }
}

type Timer = { callback: () => void; ms: number; cleared: boolean }

function createClient() {
  const sockets: FakeWebSocket[] = []
  const timers: Timer[] = []
  let nextId = 0
  const client = new WebSocketClient({
    createWebSocket: vi.fn(() => {
      const socket = new FakeWebSocket()
      sockets.push(socket)
      return socket
    }),
    setTimeout: vi.fn((callback, ms) => {
      const timer = { callback, ms, cleared: false }
      timers.push(timer)
      return timer
    }),
    clearTimeout: vi.fn((timer: Timer) => {
      timer.cleared = true
    }),
    createId: () => `echo-${++nextId}`
  })
  return { client, sockets, timers }
}

describe('WebSocketClient', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('calls default worker timers with the global receiver', async () => {
    const socket = new FakeWebSocket()
    const timer = {}
    vi.stubGlobal('setTimeout', function (this: unknown) {
      if (this !== globalThis) throw new TypeError('Illegal invocation')
      return timer
    })
    vi.stubGlobal('clearTimeout', function (this: unknown) {
      if (this !== globalThis) throw new TypeError('Illegal invocation')
    })
    const client = new WebSocketClient({
      createWebSocket: () => socket,
      createId: () => 'id'
    })

    const connecting = client.ensureConnected()
    socket.open()

    await expect(connecting).resolves.toBeUndefined()
  })

  it('connects to the fixed shared URL', async () => {
    const { client, sockets, timers } = createClient()
    const promise = client.ensureConnected()

    expect(timers[0].ms).toBe(5_000)
    sockets[0].open()
    await expect(promise).resolves.toBeUndefined()
    expect(client.getStatus()).toEqual({ state: 'connected', error: null })
  })

  it('deduplicates concurrent connection attempts', async () => {
    const { client, sockets } = createClient()
    const first = client.ensureConnected()
    const second = client.ensureConnected()

    expect(first).toBe(second)
    expect(sockets).toHaveLength(1)
    sockets[0].open()
    await expect(first).resolves.toBeUndefined()
  })

  it('times out a connection without waiting five seconds', async () => {
    const { client, sockets, timers } = createClient()
    const promise = client.ensureConnected()
    timers[0].callback()

    await expect(promise).rejects.toMatchObject({ code: 'TIMEOUT' })
    expect(sockets[0].close).toHaveBeenCalled()
    expect(client.getStatus().state).toBe('error')
  })

  it('sends echo-request and resolves only its matching response', async () => {
    const { client, sockets, timers } = createClient()
    const connecting = client.ensureConnected()
    sockets[0].open()
    await connecting

    const echo = client.echo('hello')
    await Promise.resolve()
    expect(timers[1].ms).toBe(5_000)
    expect(sockets[0].send).toHaveBeenCalledWith(
      JSON.stringify({
        type: 'echo-request',
        id: 'echo-1',
        data: { text: 'hello' }
      })
    )
    sockets[0].receive(
      JSON.stringify({
        type: 'echo-response',
        id: 'other',
        data: { text: 'ignored' }
      })
    )
    sockets[0].receive(
      JSON.stringify({
        type: 'echo-response',
        id: 'echo-1',
        data: { text: 'hello' }
      })
    )
    await expect(echo).resolves.toEqual({ ok: true, data: { text: 'hello' } })
    expect(timers[1].cleared).toBe(true)
  })

  it('maps echo timeout and removes its pending timer', async () => {
    const { client, sockets, timers } = createClient()
    const connecting = client.ensureConnected()
    sockets[0].open()
    await connecting

    const echo = client.echo('slow')
    await Promise.resolve()
    timers[1].callback()
    await expect(echo).resolves.toMatchObject({
      ok: false,
      error: { code: 'TIMEOUT' }
    })
  })

  it('answers a server ping with the same id and timestamp', async () => {
    const { client, sockets } = createClient()
    const connecting = client.ensureConnected()
    sockets[0].open()
    await connecting

    sockets[0].receive(
      JSON.stringify({
        type: 'ping',
        id: 'ping-1',
        data: { timestamp: '2026-09-03T00:00:00.000Z' }
      })
    )
    expect(sockets[0].send).toHaveBeenCalledWith(
      JSON.stringify({
        type: 'pong',
        id: 'ping-1',
        data: { timestamp: '2026-09-03T00:00:00.000Z' }
      })
    )
  })

  it('maps a protocol error, rejects pending echoes, and closes with 1003', async () => {
    const { client, sockets } = createClient()
    const connecting = client.ensureConnected()
    sockets[0].open()
    await connecting

    const echo = client.echo('bad')
    await Promise.resolve()
    sockets[0].receive('not json')
    await expect(echo).resolves.toMatchObject({
      ok: false,
      error: { code: 'PROTOCOL_ERROR' }
    })
    expect(sockets[0].close).toHaveBeenCalledWith(1003, 'Protocol error')
    expect(client.getStatus().state).toBe('error')
  })

  it('rejects pending echoes on socket error and close', async () => {
    const { client, sockets } = createClient()
    const connecting = client.ensureConnected()
    sockets[0].open()
    await connecting

    const echo = client.echo('fail')
    await Promise.resolve()
    sockets[0].fail()
    await expect(echo).resolves.toMatchObject({
      ok: false,
      error: { code: 'SERVICE_UNAVAILABLE' }
    })

    const reconnecting = client.ensureConnected()
    sockets[1].open()
    await reconnecting
    const closingEcho = client.echo('close')
    await Promise.resolve()
    sockets[1].close()
    await expect(closingEcho).resolves.toMatchObject({
      ok: false,
      error: { code: 'CONNECTION_CLOSED' }
    })
  })

  it('ignores events from an old socket generation', async () => {
    const { client, sockets, timers } = createClient()
    const first = client.ensureConnected()
    timers[0].callback()
    await expect(first).rejects.toMatchObject({ code: 'TIMEOUT' })

    const second = client.ensureConnected()
    sockets[1].open()
    await second
    sockets[0].open()
    sockets[0].receive('not json')

    expect(client.getStatus()).toEqual({ state: 'connected', error: null })
  })
})
