import {
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TIMEOUT_MS,
  serializeMessage,
  type PingMessage
} from '@vite-crx/shared'
import { WS_CLOSE_CODE_HEARTBEAT_TIMEOUT } from './constants.ts'

type TimerHandle = ReturnType<typeof setTimeout>

export interface HeartbeatSocket {
  send(message: string): unknown
  close(code?: number, reason?: string): unknown
}

export interface HeartbeatTimers {
  setInterval(callback: () => void, delay: number): TimerHandle
  clearInterval(handle: TimerHandle): void
  setTimeout(callback: () => void, delay: number): TimerHandle
  clearTimeout(handle: TimerHandle): void
}

export interface HeartbeatOptions {
  intervalMs?: number
  timeoutMs?: number
  createId?: () => string
  now?: () => Date
  timers?: HeartbeatTimers
}

const defaultTimers: HeartbeatTimers = {
  setInterval,
  clearInterval,
  setTimeout,
  clearTimeout
}

/** Manages the server-initiated heartbeat for one WebSocket connection. */
export class Heartbeat {
  private readonly intervalMs: number
  private readonly timeoutMs: number
  private readonly createId: () => string
  private readonly now: () => Date
  private readonly timers: HeartbeatTimers
  private intervalId: TimerHandle | null = null
  private timeoutId: TimerHandle | null = null
  private pendingPingId: string | null = null

  constructor(
    private readonly socket: HeartbeatSocket,
    options: HeartbeatOptions = {}
  ) {
    this.intervalMs = options.intervalMs ?? HEARTBEAT_INTERVAL_MS
    this.timeoutMs = options.timeoutMs ?? HEARTBEAT_TIMEOUT_MS
    this.createId = options.createId ?? (() => crypto.randomUUID())
    this.now = options.now ?? (() => new Date())
    this.timers = options.timers ?? defaultTimers
  }

  start(): void {
    if (this.intervalId !== null) return

    this.intervalId = this.timers.setInterval(
      () => this.sendPing(),
      this.intervalMs
    )
  }

  handlePong(id: string): void {
    if (id !== this.pendingPingId) return

    this.pendingPingId = null
    this.clearTimeout()
  }

  stop(): void {
    if (this.intervalId !== null) {
      this.timers.clearInterval(this.intervalId)
      this.intervalId = null
    }

    this.clearTimeout()
    this.pendingPingId = null
  }

  private sendPing(): void {
    if (this.pendingPingId !== null) return

    const id = this.createId()
    const ping: PingMessage = {
      type: 'ping',
      id,
      data: { timestamp: this.now().toISOString() }
    }

    this.pendingPingId = id
    this.socket.send(serializeMessage(ping))
    this.timeoutId = this.timers.setTimeout(() => {
      if (this.pendingPingId !== id) return

      console.warn('[server:ws] heartbeat timeout')
      this.stop()
      this.socket.close(WS_CLOSE_CODE_HEARTBEAT_TIMEOUT, 'heartbeat timeout')
    }, this.timeoutMs)
  }

  private clearTimeout(): void {
    if (this.timeoutId !== null) {
      this.timers.clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
  }
}
