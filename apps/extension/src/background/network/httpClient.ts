import {
  HTTP_BASE_URL,
  HTTP_TIMEOUT_MS,
  isHealthResponse
} from '@vite-crx/shared'
import type { HealthResponse } from '@vite-crx/shared'
import type { NetworkResult, SerializableNetworkError } from '~/shared/message'

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>
type TimerId = number | object

export interface HttpClientDeps {
  fetch?: FetchFn
  setTimeout?: (cb: () => void, ms: number) => TimerId
  clearTimeout?: (id: TimerId) => void
}

const HEALTH_URL = `${HTTP_BASE_URL}/api/health` as const

export async function fetchHealth(
  deps: HttpClientDeps = {}
): Promise<NetworkResult<HealthResponse>> {
  const fetchImpl =
    deps.fetch ?? ((input, init) => globalThis.fetch(input, init))
  const setTimeoutImpl =
    deps.setTimeout ?? ((callback, ms) => globalThis.setTimeout(callback, ms))
  const clearTimeoutImpl =
    deps.clearTimeout ??
    ((id) =>
      globalThis.clearTimeout(id as ReturnType<typeof globalThis.setTimeout>))

  const controller = new AbortController()
  let timerId: TimerId | undefined

  try {
    timerId = setTimeoutImpl(() => controller.abort(), HTTP_TIMEOUT_MS)

    const response = await fetchImpl(HEALTH_URL, {
      method: 'GET',
      signal: controller.signal
    })

    if (!response.ok) {
      return {
        ok: false,
        error: {
          code: 'PROTOCOL_ERROR',
          message: `HTTP ${response.status}`
        } satisfies SerializableNetworkError
      }
    }

    let json: unknown
    try {
      json = await response.json()
    } catch {
      return {
        ok: false,
        error: {
          code: 'PROTOCOL_ERROR',
          message: 'Invalid JSON'
        } satisfies SerializableNetworkError
      }
    }

    if (!isHealthResponse(json)) {
      return {
        ok: false,
        error: {
          code: 'PROTOCOL_ERROR',
          message: 'Invalid HealthResponse fields'
        } satisfies SerializableNetworkError
      }
    }

    return { ok: true, data: json }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return {
        ok: false,
        error: { code: 'TIMEOUT', message: 'Request timed out' }
      }
    }
    if (err instanceof TypeError) {
      return {
        ok: false,
        error: { code: 'SERVICE_UNAVAILABLE', message: err.message }
      }
    }
    return {
      ok: false,
      error: { code: 'SERVICE_UNAVAILABLE', message: 'Network error' }
    }
  } finally {
    if (timerId !== undefined) {
      clearTimeoutImpl(timerId)
    }
  }
}
