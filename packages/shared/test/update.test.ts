import { describe, expect, it } from 'vitest'
import {
  clampInterval,
  compareVersions,
  formatVersionName,
  normalizeUpdateConfig,
  parseCommitFromVersionName,
  DEFAULT_UPDATE_CONFIG
} from '../src/update.ts'
import {
  DAEMON_PORT,
  DAEMON_HTTP_BASE_URL,
  SERVER_PORT
} from '../src/config.ts'
import { parseServerMessage, ProtocolError } from '../src/websocket.ts'

describe('daemon port', () => {
  it('does not clash with dev server or hot reload ports', () => {
    expect(DAEMON_PORT).toBe(8788)
    expect(DAEMON_PORT).not.toBe(SERVER_PORT)
    expect(DAEMON_PORT).not.toBe(8801)
    expect(DAEMON_HTTP_BASE_URL).toBe('http://localhost:8788')
  })
})

describe('compareVersions', () => {
  it('compares segment by segment', () => {
    expect(compareVersions('0.0.2', '0.0.1')).toBeGreaterThan(0)
    expect(compareVersions('0.1', '0.0.9')).toBeGreaterThan(0)
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0)
    expect(compareVersions('1.0', '1.0.0.0')).toBe(0)
    expect(compareVersions('1.2.10', '1.2.9')).toBeGreaterThan(0)
    expect(compareVersions('0.0.1', '0.0.2')).toBeLessThan(0)
  })
})

describe('clampInterval', () => {
  it('defaults to 60 for invalid input', () => {
    expect(clampInterval('abc')).toBe(60)
    expect(clampInterval(undefined)).toBe(60)
  })
  it('clamps to 5 ~ 1440 minutes', () => {
    expect(clampInterval(1)).toBe(5)
    expect(clampInterval(99999)).toBe(1440)
    expect(clampInterval('30')).toBe(30)
  })
})

describe('normalizeUpdateConfig', () => {
  it('fills defaults and keeps base for missing fields', () => {
    expect(normalizeUpdateConfig(null)).toEqual(DEFAULT_UPDATE_CONFIG)
    expect(
      normalizeUpdateConfig(
        { checkIntervalMinutes: 2 },
        { autoUpdate: false, checkIntervalMinutes: 60 }
      )
    ).toEqual({ autoUpdate: false, checkIntervalMinutes: 5 })
  })
})

describe('version name', () => {
  it('round-trips commit', () => {
    const name = formatVersionName('0.0.1', 'abc1234')
    expect(name).toBe('0.0.1 (abc1234)')
    expect(parseCommitFromVersionName(name)).toBe('abc1234')
  })
  it('returns null without commit', () => {
    expect(parseCommitFromVersionName('0.0.1')).toBeNull()
    expect(parseCommitFromVersionName(undefined)).toBeNull()
  })
})

describe('update-event message', () => {
  it('parses a valid update-event', () => {
    const msg = parseServerMessage({
      type: 'update-event',
      id: '1',
      data: { kind: 'ready', status: { enabled: true } }
    })
    expect(msg.type).toBe('update-event')
    if (msg.type === 'update-event') {
      expect(msg.data.kind).toBe('ready')
    }
  })
  it('rejects unknown kind', () => {
    expect(() =>
      parseServerMessage({
        type: 'update-event',
        id: '1',
        data: { kind: 'nope', status: {} }
      })
    ).toThrow(ProtocolError)
  })
})
