import { describe, expect, it } from 'vitest'
import {
  SERVER_HOST,
  SERVER_PORT,
  HTTP_BASE_URL,
  WS_URL,
  HTTP_TIMEOUT_MS,
  WS_CONNECT_TIMEOUT_MS,
  WS_REQUEST_TIMEOUT_MS,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TIMEOUT_MS
} from '../src/config.ts'

describe('config constants', () => {
  it('SERVER_HOST is localhost', () => {
    expect(SERVER_HOST).toBe('localhost')
  })

  it('SERVER_PORT is 8787', () => {
    expect(SERVER_PORT).toBe(8787)
  })

  it('HTTP_BASE_URL derives from host and port', () => {
    expect(HTTP_BASE_URL).toBe('http://localhost:8787')
  })

  it('WS_URL derives from host and port with /ws path', () => {
    expect(WS_URL).toBe('ws://localhost:8787/ws')
  })

  it('HTTP_TIMEOUT_MS is 5000', () => {
    expect(HTTP_TIMEOUT_MS).toBe(5_000)
  })

  it('WS_CONNECT_TIMEOUT_MS is 5000', () => {
    expect(WS_CONNECT_TIMEOUT_MS).toBe(5_000)
  })

  it('WS_REQUEST_TIMEOUT_MS is 5000', () => {
    expect(WS_REQUEST_TIMEOUT_MS).toBe(5_000)
  })

  it('HEARTBEAT_INTERVAL_MS is 20000', () => {
    expect(HEARTBEAT_INTERVAL_MS).toBe(20_000)
  })

  it('HEARTBEAT_TIMEOUT_MS is 30000', () => {
    expect(HEARTBEAT_TIMEOUT_MS).toBe(30_000)
  })
})
