import { afterEach, describe, it, expect, vi } from 'vitest'
import { fetchHealth } from './httpClient'
import type { NetworkResult, NetworkErrorCode } from '~/shared/message'
import type { HealthResponse } from '@vite-crx/shared'

const validHealth = { status: 'ok', timestamp: '2026-09-03T00:00:00.000Z' }

function okJson(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 })
}

function assertError(result: NetworkResult<HealthResponse>): asserts result is {
  ok: false
  error: { code: NetworkErrorCode; message: string }
} {
  expect(result.ok).toBe(false)
}

describe('fetchHealth', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('calls default worker timers with the global receiver', async () => {
    const timer = {}
    vi.stubGlobal('setTimeout', function (this: unknown) {
      if (this !== globalThis) throw new TypeError('Illegal invocation')
      return timer
    })
    vi.stubGlobal('clearTimeout', function (this: unknown) {
      if (this !== globalThis) throw new TypeError('Illegal invocation')
    })
    vi.stubGlobal('fetch', function (this: unknown) {
      if (this !== globalThis) throw new TypeError('Illegal invocation')
      return Promise.resolve(okJson(validHealth))
    })

    const result = await fetchHealth()

    expect(result).toEqual({ ok: true, data: validHealth })
  })

  it('returns ok with data on valid 200 response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson(validHealth))
    const result = await fetchHealth({ fetch: fetchMock as any })

    expect(result).toEqual({ ok: true, data: validHealth })
  })

  it('uses fixed URL and GET method', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson(validHealth))
    await fetchHealth({ fetch: fetchMock as any })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:8787/api/health')
    expect(init.method).toBe('GET')
  })

  it('does not expose URL parameter to callers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson(validHealth))
    await fetchHealth({ fetch: fetchMock as any })

    const [url] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:8787/api/health')
  })

  it('maps AbortError to TIMEOUT', async () => {
    const abortError = new DOMException('Aborted', 'AbortError')
    const fetchMock = vi.fn().mockRejectedValue(abortError)
    const result = await fetchHealth({ fetch: fetchMock as any })

    expect(result).toEqual({
      ok: false,
      error: { code: 'TIMEOUT', message: 'Request timed out' }
    })
  })

  it('aborts after timeout duration', async () => {
    let abortSignal: AbortSignal | undefined
    let timeoutCb: (() => void) | undefined
    const setTimeoutMock = vi.fn().mockImplementation((cb: () => void) => {
      timeoutCb = cb
      return 999
    })
    const clearTimeoutMock = vi.fn()
    const fetchMock = vi
      .fn()
      .mockImplementation((_url: string, init: RequestInit) => {
        abortSignal = init.signal
        return new Promise((_, reject) => {
          abortSignal!.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        })
      })

    const promise = fetchHealth({
      fetch: fetchMock as any,
      setTimeout: setTimeoutMock as any,
      clearTimeout: clearTimeoutMock as any
    })

    expect(abortSignal?.aborted).toBe(false)
    timeoutCb!()
    expect(abortSignal?.aborted).toBe(true)

    const result = await promise
    assertError(result)
    expect(result.error.code).toBe('TIMEOUT')
  })

  it('maps TypeError to SERVICE_UNAVAILABLE', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new TypeError('Failed to fetch'))
    const result = await fetchHealth({ fetch: fetchMock as any })

    expect(result).toEqual({
      ok: false,
      error: { code: 'SERVICE_UNAVAILABLE', message: 'Failed to fetch' }
    })
  })

  it('maps connection refused TypeError to SERVICE_UNAVAILABLE', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new TypeError('Connection refused'))
    const result = await fetchHealth({ fetch: fetchMock as any })

    assertError(result)
    expect(result.error.code).toBe('SERVICE_UNAVAILABLE')
  })

  it('maps non-2xx to PROTOCOL_ERROR', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('error', { status: 500 }))
    const result = await fetchHealth({ fetch: fetchMock as any })

    expect(result).toEqual({
      ok: false,
      error: { code: 'PROTOCOL_ERROR', message: 'HTTP 500' }
    })
  })

  it('maps 404 to PROTOCOL_ERROR', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('not found', { status: 404 }))
    const result = await fetchHealth({ fetch: fetchMock as any })

    assertError(result)
    expect(result.error.code).toBe('PROTOCOL_ERROR')
  })

  it('maps invalid JSON to PROTOCOL_ERROR', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('not json', { status: 200 }))
    const result = await fetchHealth({ fetch: fetchMock as any })

    expect(result).toEqual({
      ok: false,
      error: { code: 'PROTOCOL_ERROR', message: 'Invalid JSON' }
    })
  })

  it('maps invalid fields to PROTOCOL_ERROR', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        okJson({ status: 'error', timestamp: '2026-09-03T00:00:00.000Z' })
      )
    const result = await fetchHealth({ fetch: fetchMock as any })

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'PROTOCOL_ERROR',
        message: 'Invalid HealthResponse fields'
      }
    })
  })

  it('maps missing timestamp to PROTOCOL_ERROR', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson({ status: 'ok' }))
    const result = await fetchHealth({ fetch: fetchMock as any })

    assertError(result)
    expect(result.error.code).toBe('PROTOCOL_ERROR')
  })

  it('maps invalid timestamp date to PROTOCOL_ERROR', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(okJson({ status: 'ok', timestamp: 'not-a-date' }))
    const result = await fetchHealth({ fetch: fetchMock as any })

    assertError(result)
    expect(result.error.code).toBe('PROTOCOL_ERROR')
  })

  it('clears timer on success', async () => {
    const clearTimeoutMock = vi.fn()
    const setTimeoutMock = vi.fn().mockReturnValue(123)
    const fetchMock = vi.fn().mockResolvedValue(okJson(validHealth))

    await fetchHealth({
      fetch: fetchMock as any,
      setTimeout: setTimeoutMock as any,
      clearTimeout: clearTimeoutMock as any
    })

    expect(clearTimeoutMock).toHaveBeenCalledWith(123)
  })

  it('clears timer on error', async () => {
    const clearTimeoutMock = vi.fn()
    const setTimeoutMock = vi.fn().mockReturnValue(456)
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('fail'))

    await fetchHealth({
      fetch: fetchMock as any,
      setTimeout: setTimeoutMock as any,
      clearTimeout: clearTimeoutMock as any
    })

    expect(clearTimeoutMock).toHaveBeenCalledWith(456)
  })

  it('clears timer on timeout', async () => {
    const clearTimeoutMock = vi.fn()
    let timeoutCb: (() => void) | undefined
    const setTimeoutMock = vi.fn().mockImplementation((cb: () => void) => {
      timeoutCb = cb
      return 789
    })
    const fetchMock = vi
      .fn()
      .mockImplementation((_url: string, init: RequestInit) => {
        return new Promise((_, reject) => {
          init.signal.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        })
      })

    const promise = fetchHealth({
      fetch: fetchMock as any,
      setTimeout: setTimeoutMock as any,
      clearTimeout: clearTimeoutMock as any
    })

    timeoutCb!()

    await promise
    expect(clearTimeoutMock).toHaveBeenCalledWith(789)
  })

  it('does not accept arbitrary URL from caller', () => {
    const fn = fetchHealth
    expect(fn.length).toBeLessThanOrEqual(1)
  })
})
