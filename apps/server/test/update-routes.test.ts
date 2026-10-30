import { afterEach, describe, expect, test } from 'bun:test'
import { app, configureApp, isAllowedOrigin } from '../src/app.ts'

afterEach(() => {
  configureApp({ mode: 'dev' })
  delete process.env.VITE_CRX_EXTENSION_ID
})

describe('origin guard', () => {
  test('only chrome-extension origins are allowed', () => {
    expect(isAllowedOrigin('chrome-extension://abc')).toBe(true)
    expect(isAllowedOrigin('https://evil.example')).toBe(false)
    expect(isAllowedOrigin(undefined)).toBe(false)
  })

  test('VITE_CRX_EXTENSION_ID pins the extension', () => {
    process.env.VITE_CRX_EXTENSION_ID = 'abc'
    expect(isAllowedOrigin('chrome-extension://abc')).toBe(true)
    expect(isAllowedOrigin('chrome-extension://other')).toBe(false)
  })
})

describe('update routes', () => {
  test('dev server reports update disabled', async () => {
    const res = await app.request('/api/update/status')
    expect(res.status).toBe(200)
    expect(((await res.json()) as any).enabled).toBe(false)
  })

  test('web pages cannot trigger an update', async () => {
    const res = await app.request('/api/update', {
      method: 'POST',
      headers: { origin: 'https://evil.example' }
    })
    expect(res.status).toBe(403)
  })

  test('extension gets 503 when updater is disabled', async () => {
    const res = await app.request('/api/update', {
      method: 'POST',
      headers: { origin: 'chrome-extension://abc' }
    })
    expect(res.status).toBe(503)
  })

  test('health exposes server mode', async () => {
    configureApp({ mode: 'daemon' })
    const res = await app.request('/api/health')
    expect(((await res.json()) as any).mode).toBe('daemon')
  })
})
