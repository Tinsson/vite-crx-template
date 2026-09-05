import { describe, expect, it, vi } from 'vitest'
import hotReloadContent from './content.ts'

type SocketEvent = 'open' | 'error' | 'close'

class FakeWebSocket {
  private listeners = new Map<SocketEvent, Array<() => void>>()
  readonly send = vi.fn()

  on(event: SocketEvent, listener: () => void) {
    const listeners = this.listeners.get(event) ?? []
    listeners.push(listener)
    this.listeners.set(event, listeners)
  }

  emit(event: SocketEvent) {
    for (const listener of this.listeners.get(event) ?? []) listener()
  }
}

describe('hotReloadContent', () => {
  it('retries after the websocket server starts later', () => {
    const sockets: FakeWebSocket[] = []
    const retries: Array<() => void> = []
    const plugin = hotReloadContent({
      isDev: true,
      createWebSocket: () => {
        const socket = new FakeWebSocket()
        sockets.push(socket)
        return socket
      },
      setTimeout: (callback) => {
        retries.push(callback)
        return 1
      }
    })

    if (typeof plugin.configResolved !== 'function') {
      throw new Error('configResolved hook is required')
    }
    plugin.configResolved.call({} as never, {} as never)

    expect(sockets).toHaveLength(1)
    sockets[0].emit('error')
    expect(retries).toHaveLength(1)

    retries[0]()
    expect(sockets).toHaveLength(2)
    sockets[1].emit('open')

    if (typeof plugin.writeBundle !== 'function') {
      throw new Error('writeBundle hook is required')
    }
    plugin.writeBundle.call({} as never, {} as never, {} as never)

    expect(sockets[1].send).toHaveBeenCalledWith('UPDATE_CONTENT_SCRIPT')
  })
})
