import {
  WS_CONNECT_TIMEOUT_MS,
  WS_REQUEST_TIMEOUT_MS as WS_ECHO_TIMEOUT_MS,
  WS_URL,
  parseServerMessage,
  serializeMessage
} from '@vite-crx/shared'
import type {
  NetworkResult,
  SerializableNetworkError,
  WebSocketConnectionState,
  WebSocketStatusResponse
} from '~/shared/message'

type TimerId = number | object

export interface WebSocketLike {
  readonly readyState: number
  onopen: ((event: Event) => void) | null
  onclose: ((event: CloseEvent) => void) | null
  onerror: ((event: Event) => void) | null
  onmessage: ((event: MessageEvent) => void) | null
  send(data: string): void
  close(code?: number, reason?: string): void
}

export interface WebSocketClientDeps {
  createWebSocket?: (url: string) => WebSocketLike
  setTimeout?: (callback: () => void, ms: number) => TimerId
  clearTimeout?: (id: TimerId) => void
  createId?: () => string
}

type PendingEcho = {
  resolve: (value: { text: string }) => void
  reject: (reason: SerializableNetworkError) => void
  timerId: TimerId
}

const OPEN = 1

/** A single, Background-only connection to the fixed local server WebSocket. */
export class WebSocketClient {
  private readonly createWebSocket: (url: string) => WebSocketLike
  private readonly setTimeout: (callback: () => void, ms: number) => TimerId
  private readonly clearTimeout: (id: TimerId) => void
  private readonly createId: () => string
  private socket: WebSocketLike | null = null
  private state: WebSocketConnectionState = 'disconnected'
  private connectPromise: Promise<void> | null = null
  private connectTimer: TimerId | null = null
  private pendingEchoes = new Map<string, PendingEcho>()
  private generation = 0
  private lastError: SerializableNetworkError | null = null

  constructor(deps: WebSocketClientDeps = {}) {
    this.createWebSocket = deps.createWebSocket ?? ((url) => new WebSocket(url))
    this.setTimeout =
      deps.setTimeout ?? ((callback, ms) => globalThis.setTimeout(callback, ms))
    this.clearTimeout =
      deps.clearTimeout ??
      ((id) =>
        globalThis.clearTimeout(id as ReturnType<typeof globalThis.setTimeout>))
    this.createId =
      deps.createId ??
      (() =>
        globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`)
  }

  getStatus(): WebSocketStatusResponse {
    return { state: this.state, error: this.lastError }
  }

  ensureConnected(): Promise<void> {
    if (this.socket?.readyState === OPEN && this.state === 'connected') {
      return Promise.resolve()
    }
    if (this.connectPromise) return this.connectPromise

    const generation = ++this.generation
    this.state = 'connecting'
    this.lastError = null

    let resolveConnect: () => void
    let rejectConnect: (reason: SerializableNetworkError) => void
    const promise = new Promise<void>((resolve, reject) => {
      resolveConnect = resolve
      rejectConnect = reject
    })
    this.connectPromise = promise

    let socket: WebSocketLike
    try {
      socket = this.createWebSocket(WS_URL)
    } catch (error) {
      this.failConnection(
        generation,
        this.serviceUnavailableError(error),
        rejectConnect!
      )
      return promise
    }
    this.socket = socket
    this.connectTimer = this.setTimeout(() => {
      this.failConnection(
        generation,
        { code: 'TIMEOUT', message: 'WebSocket connection timed out' },
        rejectConnect!,
        true
      )
    }, WS_CONNECT_TIMEOUT_MS)

    socket.onopen = () => {
      if (!this.isCurrent(generation, socket)) return
      this.clearConnectTimer()
      this.state = 'connected'
      this.connectPromise = null
      resolveConnect!()
    }
    socket.onerror = () => {
      if (!this.isCurrent(generation, socket)) return
      const error = {
        code: 'SERVICE_UNAVAILABLE' as const,
        message: 'WebSocket connection error'
      }
      this.rejectAllPending(error)
      this.failConnection(generation, error, rejectConnect!, true)
    }
    socket.onclose = () => {
      if (!this.isCurrent(generation, socket)) return
      this.clearConnectTimer()
      this.socket = null
      this.connectPromise = null
      const error: SerializableNetworkError = {
        code: 'CONNECTION_CLOSED',
        message: 'WebSocket connection closed'
      }
      this.rejectAllPending(error)
      if (this.state === 'connecting') {
        this.state = 'error'
        this.lastError = error
        rejectConnect!(error)
      } else if (this.state !== 'error') {
        this.state = 'disconnected'
        this.lastError = null
      }
    }
    socket.onmessage = (event) => {
      if (!this.isCurrent(generation, socket)) return
      this.handleMessage(socket, event.data)
    }

    return promise
  }

  async echo(text: string): Promise<NetworkResult<{ text: string }>> {
    try {
      await this.ensureConnected()
      const socket = this.socket
      if (!socket || socket.readyState !== OPEN) {
        throw {
          code: 'CONNECTION_CLOSED',
          message: 'WebSocket is not connected'
        }
      }

      const id = this.createId()
      const result = await new Promise<{ text: string }>((resolve, reject) => {
        const timerId = this.setTimeout(() => {
          const pending = this.pendingEchoes.get(id)
          if (!pending) return
          this.pendingEchoes.delete(id)
          pending.reject({
            code: 'TIMEOUT',
            message: 'WebSocket echo timed out'
          })
        }, WS_ECHO_TIMEOUT_MS)
        this.pendingEchoes.set(id, { resolve, reject, timerId })
        try {
          socket.send(
            serializeMessage({ type: 'echo-request', id, data: { text } })
          )
        } catch (error) {
          this.rejectPending(id, this.serviceUnavailableError(error))
        }
      })
      return { ok: true, data: result }
    } catch (error) {
      return { ok: false, error: this.toSerializableError(error) }
    }
  }

  private handleMessage(socket: WebSocketLike, raw: unknown): void {
    try {
      const message = parseServerMessage(raw)
      if (message.type === 'ping') {
        socket.send(
          serializeMessage({ type: 'pong', id: message.id, data: message.data })
        )
        return
      }
      const pending = this.pendingEchoes.get(message.id)
      if (!pending) return
      this.pendingEchoes.delete(message.id)
      this.clearTimeout(pending.timerId)
      pending.resolve({ text: message.data.text })
    } catch {
      const error: SerializableNetworkError = {
        code: 'PROTOCOL_ERROR',
        message: 'Invalid WebSocket server message'
      }
      this.lastError = error
      this.state = 'error'
      this.rejectAllPending(error)
      socket.close(1003, 'Protocol error')
    }
  }

  private failConnection(
    generation: number,
    error: SerializableNetworkError,
    reject: (reason: SerializableNetworkError) => void,
    close = false
  ): void {
    if (generation !== this.generation) return
    this.clearConnectTimer()
    this.state = 'error'
    this.lastError = error
    this.connectPromise = null
    reject(error)
    if (close) {
      const socket = this.socket
      this.socket = null
      socket?.close()
    }
  }

  private isCurrent(generation: number, socket: WebSocketLike): boolean {
    return generation === this.generation && this.socket === socket
  }

  private clearConnectTimer(): void {
    if (this.connectTimer !== null) {
      this.clearTimeout(this.connectTimer)
      this.connectTimer = null
    }
  }

  private rejectPending(id: string, error: SerializableNetworkError): void {
    const pending = this.pendingEchoes.get(id)
    if (!pending) return
    this.pendingEchoes.delete(id)
    this.clearTimeout(pending.timerId)
    pending.reject(error)
  }

  private rejectAllPending(error: SerializableNetworkError): void {
    for (const id of this.pendingEchoes.keys()) this.rejectPending(id, error)
  }

  private serviceUnavailableError(error: unknown): SerializableNetworkError {
    return {
      code: 'SERVICE_UNAVAILABLE',
      message:
        error instanceof Error ? error.message : 'WebSocket connection error'
    }
  }

  private toSerializableError(error: unknown): SerializableNetworkError {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      'message' in error
    ) {
      return error as SerializableNetworkError
    }
    return this.serviceUnavailableError(error)
  }
}
