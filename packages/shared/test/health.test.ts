import { describe, expect, it } from 'vitest'
import { isHealthResponse, parseHealthResponse } from '../src/health.ts'

describe('isHealthResponse', () => {
  it('accepts valid health response', () => {
    expect(
      isHealthResponse({ status: 'ok', timestamp: '2026-09-03T00:00:00.000Z' })
    ).toBe(true)
  })

  it('rejects null', () => {
    expect(isHealthResponse(null)).toBe(false)
  })

  it('rejects undefined', () => {
    expect(isHealthResponse(undefined)).toBe(false)
  })

  it('rejects array', () => {
    expect(isHealthResponse([1, 2])).toBe(false)
  })

  it('rejects string', () => {
    expect(isHealthResponse('hello')).toBe(false)
  })

  it('rejects number', () => {
    expect(isHealthResponse(42)).toBe(false)
  })

  it('rejects wrong status', () => {
    expect(
      isHealthResponse({
        status: 'error',
        timestamp: '2026-09-03T00:00:00.000Z'
      })
    ).toBe(false)
  })

  it('rejects missing status', () => {
    expect(isHealthResponse({ timestamp: '2026-09-03T00:00:00.000Z' })).toBe(
      false
    )
  })

  it('rejects missing timestamp', () => {
    expect(isHealthResponse({ status: 'ok' })).toBe(false)
  })

  it('rejects non-string timestamp', () => {
    expect(isHealthResponse({ status: 'ok', timestamp: 123 })).toBe(false)
  })

  it('rejects unparseable date string', () => {
    expect(isHealthResponse({ status: 'ok', timestamp: 'not-a-date' })).toBe(
      false
    )
  })

  it('accepts extra fields', () => {
    expect(
      isHealthResponse({
        status: 'ok',
        timestamp: '2026-09-03T00:00:00.000Z',
        extra: true
      })
    ).toBe(true)
  })
})

describe('parseHealthResponse', () => {
  it('returns valid response', () => {
    const input = {
      status: 'ok' as const,
      timestamp: '2026-09-03T00:00:00.000Z'
    }
    expect(parseHealthResponse(input)).toEqual(input)
  })

  it('throws on invalid input', () => {
    expect(() => parseHealthResponse(null)).toThrow(TypeError)
  })

  it('throws on wrong status', () => {
    expect(() =>
      parseHealthResponse({
        status: 'error',
        timestamp: '2026-09-03T00:00:00.000Z'
      })
    ).toThrow(TypeError)
  })
})
