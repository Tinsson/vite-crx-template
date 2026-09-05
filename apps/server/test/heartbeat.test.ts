import { describe, expect, test } from 'bun:test'
import { parseServerMessage } from '@vite-crx/shared'
import { Heartbeat, type HeartbeatTimers } from '../src/heartbeat.ts'
import { createServerOptions } from '../src/index.ts'

type TimerCallback = () => void

class FakeTimers {
  private nextId = 1
  readonly intervals = new Map<number, TimerCallback>()
  readonly timeouts = new Map<number, TimerCallback>()
  readonly intervalDelays: number[] = []
  readonly timeoutDelays: number[] = []
  readonly clearedIntervals: number[] = []
  readonly clearedTimeouts: number[] = []

  readonly timers: HeartbeatTimers = {
    setInterval: (callback, delay) => {
      const id = this.nextId++
      this.intervals.set(id, callback)
      this.intervalDelays.push(delay)
      return id as unknown as ReturnType<typeof setTimeout>
    },
    clearInterval: (id) => {
      const timerId = id as unknown as number
      this.clearedIntervals.push(timerId)
      this.intervals.delete(timerId)
    },
    setTimeout: (callback, delay) => {
      const id = this.nextId++
      this.timeouts.set(id, callback)
      this.timeoutDelays.push(delay)
      return id as unknown as ReturnType<typeof setTimeout>
    },
    clearTimeout: (id) => {
      const timerId = id as unknown as number
      this.clearedTimeouts.push(timerId)
      this.timeouts.delete(timerId)
    }
  }

  runInterval(): void {
    for (const callback of this.intervals.values()) callback()
  }

  runTimeout(): void {
    const [id, callback] = this.timeouts.entries().next().value ?? []
    if (id === undefined || callback === undefined) {
      throw new Error('No pending timeout')
    }
    this.timeouts.delete(id)
    callback()
  }
}

function createSocket() {
  const sent: string[] = []
  const closes: Array<{ code?: number; reason?: string }> = []
  return {
    sent,
    closes,
    send(message: string) {
      sent.push(message)
    },
    close(code?: number, reason?: string) {
      closes.push({ code, reason })
    }
  }
}

function createHeartbeat(timers: FakeTimers) {
  let id = 0
  const socket = createSocket()
  const heartbeat = new Heartbeat(socket, {
    timers: timers.timers,
    createId: () => `ping-${++id}`,
    now: () => new Date('2026-09-03T00:00:00.000Z')
  })
  return { socket, heartbeat }
}

describe('server heartbeat', () => {
  test('sends protocol pings using the shared production durations by default', () => {
    const timers = new FakeTimers()
    const { socket, heartbeat } = createHeartbeat(timers)

    heartbeat.start()
    timers.runInterval()

    expect(timers.intervalDelays).toEqual([20_000])
    expect(timers.timeoutDelays).toEqual([30_000])
    expect(parseServerMessage(socket.sent[0])).toEqual({
      type: 'ping',
      id: 'ping-1',
      data: { timestamp: '2026-09-03T00:00:00.000Z' }
    })
  })

  test('a matching pong clears its timeout and permits the next ping', () => {
    const timers = new FakeTimers()
    const { socket, heartbeat } = createHeartbeat(timers)

    heartbeat.start()
    timers.runInterval()
    heartbeat.handlePong('ping-1')
    timers.runInterval()

    expect(timers.clearedTimeouts).toEqual([2])
    expect(socket.sent).toHaveLength(2)
    expect(parseServerMessage(socket.sent[1]).id).toBe('ping-2')
  })

  test('an incorrect pong does not clear the pending heartbeat and it times out', () => {
    const timers = new FakeTimers()
    const { socket, heartbeat } = createHeartbeat(timers)

    heartbeat.start()
    timers.runInterval()
    heartbeat.handlePong('wrong-id')

    expect(timers.timeouts).toHaveLength(1)
    expect(timers.clearedTimeouts).toEqual([])

    timers.runTimeout()

    expect(socket.closes).toEqual([{ code: 4000, reason: 'heartbeat timeout' }])
  })

  test('a client that never sends pong is closed when the heartbeat timeout fires', () => {
    const timers = new FakeTimers()
    const { socket, heartbeat } = createHeartbeat(timers)

    heartbeat.start()
    timers.runInterval()
    timers.runTimeout()

    expect(socket.closes).toEqual([{ code: 4000, reason: 'heartbeat timeout' }])
  })

  test('does not replace an existing pending ping on later intervals', () => {
    const timers = new FakeTimers()
    const { socket, heartbeat } = createHeartbeat(timers)

    heartbeat.start()
    timers.runInterval()
    timers.runInterval()

    expect(socket.sent).toHaveLength(1)
    expect(timers.timeouts).toHaveLength(1)
  })

  test('connection close clears the interval and pending timeout', () => {
    const timers = new FakeTimers()
    const socket = createSocket()
    const options = createServerOptions({ timers: timers.timers })
    const ws = socket as unknown as Bun.ServerWebSocket

    options.websocket.open(ws)
    timers.runInterval()
    options.websocket.close(ws, 1000, 'client close')

    expect(timers.intervals).toHaveLength(0)
    expect(timers.timeouts).toHaveLength(0)
    expect(timers.clearedIntervals).toEqual([1])
    expect(timers.clearedTimeouts).toEqual([2])
  })

  test('connection error clears the interval and pending timeout', () => {
    const timers = new FakeTimers()
    const socket = createSocket()
    const options = createServerOptions({ timers: timers.timers })
    const ws = socket as unknown as Bun.ServerWebSocket

    options.websocket.open(ws)
    timers.runInterval()
    options.websocket.error(ws, new Error('connection error'))

    expect(timers.intervals).toHaveLength(0)
    expect(timers.timeouts).toHaveLength(0)
    expect(timers.clearedIntervals).toEqual([1])
    expect(timers.clearedTimeouts).toEqual([2])
  })
})
