import { describe, expect, test, afterAll } from 'bun:test'
import { serverOptions } from '../src/index.ts'
import { isHealthResponse } from '@vite-crx/shared'

describe('HTTP health endpoint', () => {
  const server = Bun.serve({
    ...serverOptions,
    port: 0
  })

  afterAll(() => {
    server.stop()
  })

  test('GET /api/health returns 200 with valid HealthResponse', async () => {
    const response = await fetch(
      `http://${server.hostname}:${server.port}/api/health`
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')

    const body = (await response.json()) as any
    expect(isHealthResponse(body)).toBe(true)
    expect(body.status).toBe('ok')
    expect(typeof body.timestamp).toBe('string')

    const timestamp = new Date(body.timestamp)
    expect(timestamp.getTime()).not.toBeNaN()
  })

  test('GET /api/health returns different timestamps', async () => {
    const response1 = await fetch(
      `http://${server.hostname}:${server.port}/api/health`
    )
    const body1 = (await response1.json()) as any

    await new Promise((resolve) => setTimeout(resolve, 10))

    const response2 = await fetch(
      `http://${server.hostname}:${server.port}/api/health`
    )
    const body2 = (await response2.json()) as any

    expect(body1.timestamp).not.toBe(body2.timestamp)
  })
})
