export interface HealthResponse {
  status: 'ok'
  timestamp: string
}

export function isHealthResponse(value: unknown): value is HealthResponse {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  const obj = value as Record<string, unknown>
  if (obj.status !== 'ok') return false
  if (typeof obj.timestamp !== 'string') return false
  const d = new Date(obj.timestamp)
  return !Number.isNaN(d.getTime())
}

export function parseHealthResponse(value: unknown): HealthResponse {
  if (!isHealthResponse(value)) {
    throw new TypeError(
      'Invalid HealthResponse: expected { status: "ok", timestamp: <ISO string> }'
    )
  }
  return value
}
