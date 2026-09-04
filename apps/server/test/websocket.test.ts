import { describe, expect, test, afterAll } from 'bun:test'
import { createServerOptions, serverOptions } from '../src/index.ts'
import {
  parseServerMessage,
  serializeMessage,
  type EchoRequest,
  type EchoResponse,
  type PongMessage
} from '@vite-crx/shared'

describe('WebSocket echo', () => {
  const server = Bun.serve({
    ...serverOptions,
    port: 0
  })

  afterAll(() => {
    server.stop()
  })

  test('echo-request returns echo-response with same id and text', async () => {
    const wsUrl = `ws://${server.hostname}:${server.port}/ws`

    const result = await new Promise<{ id: string; text: string }>(
      (resolve, reject) => {
        const ws = new WebSocket(wsUrl)
        const requestId = 'test-id-123'
        const requestText = 'Hello, World!'

        ws.onopen = () => {
          const echoRequest: EchoRequest = {
            type: 'echo-request',
            id: requestId,
            data: { text: requestText }
          }
          ws.send(serializeMessage(echoRequest))
        }

        ws.onmessage = (event) => {
          try {
            const response: EchoResponse = JSON.parse(event.data)
            ws.close()
            resolve({ id: response.id, text: response.data.text })
          } catch (error) {
            ws.close()
            reject(error)
          }
        }

        ws.onerror = (error) => {
          ws.close()
          reject(error)
        }

        setTimeout(() => {
          ws.close()
          reject(new Error('Timeout waiting for echo response'))
        }, 5000)
      }
    )

    expect(result.id).toBe('test-id-123')
    expect(result.text).toBe('Hello, World!')
  })

  test('invalid JSON closes connection with code 1003', async () => {
    const wsUrl = `ws://${server.hostname}:${server.port}/ws`

    const result = await new Promise<number>((resolve, reject) => {
      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        ws.send('not valid json')
      }

      ws.onclose = (event) => {
        resolve(event.code)
      }

      ws.onerror = (error) => {
        ws.close()
        reject(error)
      }

      setTimeout(() => {
        ws.close()
        reject(new Error('Timeout waiting for close'))
      }, 5000)
    })

    expect(result).toBe(1003)
  })

  test('unknown message type closes connection with code 1003', async () => {
    const wsUrl = `ws://${server.hostname}:${server.port}/ws`

    const result = await new Promise<number>((resolve, reject) => {
      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'unknown-type', id: '123', data: {} }))
      }

      ws.onclose = (event) => {
        resolve(event.code)
      }

      ws.onerror = (error) => {
        ws.close()
        reject(error)
      }

      setTimeout(() => {
        ws.close()
        reject(new Error('Timeout waiting for close'))
      }, 5000)
    })

    expect(result).toBe(1003)
  })

  test('wrong direction message closes connection with code 1003', async () => {
    const wsUrl = `ws://${server.hostname}:${server.port}/ws`

    const result = await new Promise<number>((resolve, reject) => {
      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        const echoResponse: EchoResponse = {
          type: 'echo-response',
          id: '123',
          data: { text: 'test' }
        }
        ws.send(serializeMessage(echoResponse))
      }

      ws.onclose = (event) => {
        resolve(event.code)
      }

      ws.onerror = (error) => {
        ws.close()
        reject(error)
      }

      setTimeout(() => {
        ws.close()
        reject(new Error('Timeout waiting for close'))
      }, 5000)
    })

    expect(result).toBe(1003)
  })

  test('missing required fields closes connection with code 1003', async () => {
    const wsUrl = `ws://${server.hostname}:${server.port}/ws`

    const result = await new Promise<number>((resolve, reject) => {
      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'echo-request', id: '123' }))
      }

      ws.onclose = (event) => {
        resolve(event.code)
      }

      ws.onerror = (error) => {
        ws.close()
        reject(error)
      }

      setTimeout(() => {
        ws.close()
        reject(new Error('Timeout waiting for close'))
      }, 5000)
    })

    expect(result).toBe(1003)
  })
})

test('Bun WebSocket server initiates a protocol ping', async () => {
  const server = Bun.serve({
    ...createServerOptions({ intervalMs: 10, timeoutMs: 100 }),
    port: 0
  })

  try {
    const ping = await new Promise<{ id: string; timestamp: string }>(
      (resolve, reject) => {
        const ws = new WebSocket(`ws://${server.hostname}:${server.port}/ws`)
        const timeout = setTimeout(() => {
          ws.close()
          reject(new Error('Timeout waiting for server ping'))
        }, 1_000)

        ws.onmessage = (event) => {
          try {
            const message = parseServerMessage(event.data)
            expect(message.type).toBe('ping')
            if (message.type !== 'ping') return

            const pong: PongMessage = {
              type: 'pong',
              id: message.id,
              data: message.data
            }
            ws.send(serializeMessage(pong))
            clearTimeout(timeout)
            ws.close()
            resolve({ id: message.id, timestamp: message.data.timestamp })
          } catch (error) {
            clearTimeout(timeout)
            ws.close()
            reject(error)
          }
        }

        ws.onerror = (error) => {
          clearTimeout(timeout)
          reject(error)
        }
      }
    )

    expect(typeof ping.id).toBe('string')
    expect(new Date(ping.timestamp).getTime()).not.toBeNaN()
  } finally {
    server.stop()
  }
})
