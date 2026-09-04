export class ProtocolError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'ProtocolError'
    this.code = code
  }
}

export interface BaseMessage<TType extends string, TData> {
  type: TType
  id: string
  data: TData
}

export type PingMessage = BaseMessage<'ping', { timestamp: string }>
export type PongMessage = BaseMessage<'pong', { timestamp: string }>
export type EchoRequest = BaseMessage<'echo-request', { text: string }>
export type EchoResponse = BaseMessage<'echo-response', { text: string }>

export type ClientMessage = PongMessage | EchoRequest
export type ServerMessage = PingMessage | EchoResponse
export type WebSocketMessage = ClientMessage | ServerMessage

const CLIENT_TYPES: ReadonlySet<string> = new Set(['pong', 'echo-request'])
const SERVER_TYPES: ReadonlySet<string> = new Set(['ping', 'echo-response'])

type RawMessage = { type: string; id: string; data: Record<string, unknown> }

function parseRaw(raw: unknown): RawMessage {
  let parsed: unknown

  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw)
    } catch {
      throw new ProtocolError('INVALID_JSON', 'Failed to parse JSON')
    }
  } else {
    parsed = raw
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new ProtocolError(
      'INVALID_SHAPE',
      'Message must be a non-null object'
    )
  }

  const obj = parsed as Record<string, unknown>

  const type = requireStringField(obj, 'type')
  const id = requireStringField(obj, 'id')
  const data = requireObjectField(obj, 'data')

  return { type, id, data }
}

function requireStringField(
  obj: Record<string, unknown>,
  field: string
): string {
  if (!(field in obj)) {
    throw new ProtocolError('MISSING_FIELD', `Missing field: ${field}`)
  }
  if (typeof obj[field] !== 'string') {
    throw new ProtocolError(
      'INVALID_FIELD_TYPE',
      `Field "${field}" must be a string`
    )
  }
  return obj[field] as string
}

function requireObjectField(
  obj: Record<string, unknown>,
  field: string
): Record<string, unknown> {
  if (!(field in obj)) {
    throw new ProtocolError('MISSING_FIELD', `Missing field: ${field}`)
  }
  const val = obj[field]
  if (typeof val !== 'object' || val === null || Array.isArray(val)) {
    throw new ProtocolError(
      'INVALID_FIELD_TYPE',
      `Field "${field}" must be an object`
    )
  }
  return val as Record<string, unknown>
}

function requireDataString(
  data: Record<string, unknown>,
  field: string
): string {
  if (!(field in data)) {
    throw new ProtocolError('MISSING_FIELD', `Missing field: data.${field}`)
  }
  if (typeof data[field] !== 'string') {
    throw new ProtocolError(
      'INVALID_FIELD_TYPE',
      `Field "data.${field}" must be a string`
    )
  }
  return data[field] as string
}

export function parseServerMessage(raw: unknown): ServerMessage {
  const { type, id, data } = parseRaw(raw)

  if (!SERVER_TYPES.has(type)) {
    if (CLIENT_TYPES.has(type)) {
      throw new ProtocolError(
        'WRONG_DIRECTION',
        `"${type}" is a client message, expected server message`
      )
    }
    throw new ProtocolError('UNKNOWN_TYPE', `Unknown message type: "${type}"`)
  }

  if (type === 'ping') {
    const timestamp = requireDataString(data, 'timestamp')
    return { type: 'ping', id, data: { timestamp } }
  }

  const text = requireDataString(data, 'text')
  return { type: 'echo-response', id, data: { text } }
}

export function parseClientMessage(raw: unknown): ClientMessage {
  const { type, id, data } = parseRaw(raw)

  if (!CLIENT_TYPES.has(type)) {
    if (SERVER_TYPES.has(type)) {
      throw new ProtocolError(
        'WRONG_DIRECTION',
        `"${type}" is a server message, expected client message`
      )
    }
    throw new ProtocolError('UNKNOWN_TYPE', `Unknown message type: "${type}"`)
  }

  if (type === 'pong') {
    const timestamp = requireDataString(data, 'timestamp')
    return { type: 'pong', id, data: { timestamp } }
  }

  const text = requireDataString(data, 'text')
  return { type: 'echo-request', id, data: { text } }
}

export function serializeMessage(message: WebSocketMessage): string {
  return JSON.stringify({
    type: message.type,
    id: message.id,
    data: message.data
  })
}
