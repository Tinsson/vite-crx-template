import { describe, expect, it } from 'vitest'
import {
  ProtocolError,
  parseClientMessage,
  parseServerMessage,
  serializeMessage
} from '../src/websocket.ts'
import type {
  ClientMessage,
  ServerMessage,
  WebSocketMessage
} from '../src/websocket.ts'

function expectProtocolError(fn: () => void, code: string): void {
  try {
    fn()
  } catch (err) {
    expect(err).toBeInstanceOf(ProtocolError)
    expect((err as ProtocolError).code).toBe(code)
    return
  }
  throw new Error(`Expected ProtocolError(${code}) but no error was thrown`)
}

describe('ProtocolError', () => {
  it('has name, code, and message', () => {
    const err = new ProtocolError('TEST_CODE', 'test message')
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('ProtocolError')
    expect(err.code).toBe('TEST_CODE')
    expect(err.message).toBe('test message')
  })
})

describe('parseServerMessage', () => {
  it('parses valid ping from object', () => {
    const msg = parseServerMessage({
      type: 'ping',
      id: 'abc',
      data: { timestamp: '2026-09-03T00:00:00.000Z' }
    })
    expect(msg).toEqual({
      type: 'ping',
      id: 'abc',
      data: { timestamp: '2026-09-03T00:00:00.000Z' }
    })
  })

  it('parses valid echo-response from JSON string', () => {
    const json = JSON.stringify({
      type: 'echo-response',
      id: 'req-1',
      data: { text: 'hello' }
    })
    const msg = parseServerMessage(json)
    expect(msg).toEqual({
      type: 'echo-response',
      id: 'req-1',
      data: { text: 'hello' }
    })
  })

  it('throws INVALID_JSON for bad JSON string', () => {
    expectProtocolError(() => parseServerMessage('{bad json'), 'INVALID_JSON')
  })

  it('throws INVALID_SHAPE for null', () => {
    expectProtocolError(() => parseServerMessage(null), 'INVALID_SHAPE')
  })

  it('throws INVALID_SHAPE for number', () => {
    expectProtocolError(() => parseServerMessage(42), 'INVALID_SHAPE')
  })

  it('throws INVALID_SHAPE for array', () => {
    expectProtocolError(() => parseServerMessage([1, 2]), 'INVALID_SHAPE')
  })

  it('throws INVALID_SHAPE for string (non-JSON)', () => {
    expectProtocolError(
      () => parseServerMessage('just a string'),
      'INVALID_JSON'
    )
  })

  it('throws MISSING_FIELD when type is absent', () => {
    expectProtocolError(
      () => parseServerMessage({ id: '1', data: {} }),
      'MISSING_FIELD'
    )
  })

  it('throws INVALID_FIELD_TYPE when type is not a string', () => {
    expectProtocolError(
      () => parseServerMessage({ type: 123, id: '1', data: {} }),
      'INVALID_FIELD_TYPE'
    )
  })

  it('throws MISSING_FIELD when id is absent', () => {
    expectProtocolError(
      () =>
        parseServerMessage({
          type: 'ping',
          data: { timestamp: '2026-09-03T00:00:00.000Z' }
        }),
      'MISSING_FIELD'
    )
  })

  it('throws INVALID_FIELD_TYPE when id is not a string', () => {
    expectProtocolError(
      () =>
        parseServerMessage({
          type: 'ping',
          id: 42,
          data: { timestamp: '2026-09-03T00:00:00.000Z' }
        }),
      'INVALID_FIELD_TYPE'
    )
  })

  it('throws MISSING_FIELD when data is absent', () => {
    expectProtocolError(
      () => parseServerMessage({ type: 'ping', id: '1' }),
      'MISSING_FIELD'
    )
  })

  it('throws INVALID_FIELD_TYPE when data is not an object', () => {
    expectProtocolError(
      () => parseServerMessage({ type: 'ping', id: '1', data: 'bad' }),
      'INVALID_FIELD_TYPE'
    )
  })

  it('throws INVALID_FIELD_TYPE when data is an array', () => {
    expectProtocolError(
      () => parseServerMessage({ type: 'ping', id: '1', data: [] }),
      'INVALID_FIELD_TYPE'
    )
  })

  it('throws INVALID_FIELD_TYPE when data is null', () => {
    expectProtocolError(
      () => parseServerMessage({ type: 'ping', id: '1', data: null }),
      'INVALID_FIELD_TYPE'
    )
  })

  it('throws WRONG_DIRECTION for pong', () => {
    expectProtocolError(
      () =>
        parseServerMessage({
          type: 'pong',
          id: '1',
          data: { timestamp: '2026-09-03T00:00:00.000Z' }
        }),
      'WRONG_DIRECTION'
    )
  })

  it('throws WRONG_DIRECTION for echo-request', () => {
    expectProtocolError(
      () =>
        parseServerMessage({
          type: 'echo-request',
          id: '1',
          data: { text: 'hi' }
        }),
      'WRONG_DIRECTION'
    )
  })

  it('throws UNKNOWN_TYPE for unrecognized type', () => {
    expectProtocolError(
      () => parseServerMessage({ type: 'foobar', id: '1', data: {} }),
      'UNKNOWN_TYPE'
    )
  })

  it('throws MISSING_FIELD when ping data.timestamp is absent', () => {
    expectProtocolError(
      () => parseServerMessage({ type: 'ping', id: '1', data: {} }),
      'MISSING_FIELD'
    )
  })

  it('throws INVALID_FIELD_TYPE when ping data.timestamp is not a string', () => {
    expectProtocolError(
      () =>
        parseServerMessage({ type: 'ping', id: '1', data: { timestamp: 123 } }),
      'INVALID_FIELD_TYPE'
    )
  })

  it('throws MISSING_FIELD when echo-response data.text is absent', () => {
    expectProtocolError(
      () => parseServerMessage({ type: 'echo-response', id: '1', data: {} }),
      'MISSING_FIELD'
    )
  })

  it('throws INVALID_FIELD_TYPE when echo-response data.text is not a string', () => {
    expectProtocolError(
      () =>
        parseServerMessage({
          type: 'echo-response',
          id: '1',
          data: { text: 42 }
        }),
      'INVALID_FIELD_TYPE'
    )
  })

  it('ignores extra top-level fields', () => {
    const msg = parseServerMessage({
      type: 'ping',
      id: 'abc',
      data: { timestamp: '2026-09-03T00:00:00.000Z' },
      extra: 'ignored'
    })
    expect(msg.type).toBe('ping')
  })

  it('ignores extra data fields', () => {
    const msg = parseServerMessage({
      type: 'echo-response',
      id: 'abc',
      data: { text: 'hello', extra: 'ignored' }
    })
    expect(msg).toEqual({
      type: 'echo-response',
      id: 'abc',
      data: { text: 'hello' }
    })
  })
})

describe('parseClientMessage', () => {
  it('parses valid pong from object', () => {
    const msg = parseClientMessage({
      type: 'pong',
      id: 'abc',
      data: { timestamp: '2026-09-03T00:00:00.000Z' }
    })
    expect(msg).toEqual({
      type: 'pong',
      id: 'abc',
      data: { timestamp: '2026-09-03T00:00:00.000Z' }
    })
  })

  it('parses valid echo-request from JSON string', () => {
    const json = JSON.stringify({
      type: 'echo-request',
      id: 'req-1',
      data: { text: 'hello' }
    })
    const msg = parseClientMessage(json)
    expect(msg).toEqual({
      type: 'echo-request',
      id: 'req-1',
      data: { text: 'hello' }
    })
  })

  it('throws WRONG_DIRECTION for ping', () => {
    expectProtocolError(
      () =>
        parseClientMessage({
          type: 'ping',
          id: '1',
          data: { timestamp: '2026-09-03T00:00:00.000Z' }
        }),
      'WRONG_DIRECTION'
    )
  })

  it('throws WRONG_DIRECTION for echo-response', () => {
    expectProtocolError(
      () =>
        parseClientMessage({
          type: 'echo-response',
          id: '1',
          data: { text: 'hi' }
        }),
      'WRONG_DIRECTION'
    )
  })

  it('throws UNKNOWN_TYPE for unrecognized type', () => {
    expectProtocolError(
      () => parseClientMessage({ type: 'foobar', id: '1', data: {} }),
      'UNKNOWN_TYPE'
    )
  })

  it('throws INVALID_JSON for bad JSON string', () => {
    expectProtocolError(() => parseClientMessage('{bad'), 'INVALID_JSON')
  })

  it('throws INVALID_SHAPE for null', () => {
    expectProtocolError(() => parseClientMessage(null), 'INVALID_SHAPE')
  })

  it('throws MISSING_FIELD when type is absent', () => {
    expectProtocolError(
      () => parseClientMessage({ id: '1', data: { text: 'hi' } }),
      'MISSING_FIELD'
    )
  })

  it('throws INVALID_FIELD_TYPE when type is not a string', () => {
    expectProtocolError(
      () => parseClientMessage({ type: null, id: '1', data: { text: 'hi' } }),
      'INVALID_FIELD_TYPE'
    )
  })

  it('throws MISSING_FIELD when echo-request data.text is absent', () => {
    expectProtocolError(
      () => parseClientMessage({ type: 'echo-request', id: '1', data: {} }),
      'MISSING_FIELD'
    )
  })

  it('throws INVALID_FIELD_TYPE when pong data.timestamp is not a string', () => {
    expectProtocolError(
      () =>
        parseClientMessage({
          type: 'pong',
          id: '1',
          data: { timestamp: true }
        }),
      'INVALID_FIELD_TYPE'
    )
  })
})

describe('serializeMessage', () => {
  it('serializes ping message', () => {
    const msg: ServerMessage = {
      type: 'ping',
      id: 'p1',
      data: { timestamp: '2026-09-03T00:00:00.000Z' }
    }
    const json = serializeMessage(msg)
    expect(JSON.parse(json)).toEqual({
      type: 'ping',
      id: 'p1',
      data: { timestamp: '2026-09-03T00:00:00.000Z' }
    })
  })

  it('serializes echo-request message', () => {
    const msg: ClientMessage = {
      type: 'echo-request',
      id: 'e1',
      data: { text: 'hello' }
    }
    const json = serializeMessage(msg)
    expect(JSON.parse(json)).toEqual({
      type: 'echo-request',
      id: 'e1',
      data: { text: 'hello' }
    })
  })

  it('roundtrips through parse and serialize', () => {
    const messages: WebSocketMessage[] = [
      {
        type: 'ping',
        id: '1',
        data: { timestamp: '2026-09-03T00:00:00.000Z' }
      },
      {
        type: 'pong',
        id: '2',
        data: { timestamp: '2026-09-03T00:00:00.000Z' }
      },
      { type: 'echo-request', id: '3', data: { text: 'hello' } },
      { type: 'echo-response', id: '4', data: { text: 'world' } }
    ]

    for (const msg of messages) {
      const serialized = serializeMessage(msg)
      const isClient = msg.type === 'pong' || msg.type === 'echo-request'
      const parsed = isClient
        ? parseClientMessage(serialized)
        : parseServerMessage(serialized)
      expect(parsed).toEqual(msg)
    }
  })

  it('produces valid JSON string', () => {
    const msg: WebSocketMessage = {
      type: 'ping',
      id: 'x',
      data: { timestamp: 't' }
    }
    const json = serializeMessage(msg)
    expect(typeof json).toBe('string')
    expect(() => JSON.parse(json)).not.toThrow()
  })
})
