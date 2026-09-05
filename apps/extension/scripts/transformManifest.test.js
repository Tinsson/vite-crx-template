import { describe, it, expect } from 'vitest'
import {
  transformManifest,
  applyDevCsp,
  applyDevHostPermission
} from './transformManifest.js'

const baseCsp =
  "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; connect-src 'self' http://localhost:8787 ws://localhost:8787"

const baseManifest = () => ({
  name: 'test',
  minimum_chrome_version: '116',
  host_permissions: ['http://localhost:8787/*'],
  content_security_policy: { extension_pages: baseCsp }
})

describe('applyDevCsp', () => {
  it('appends ws://127.0.0.1:8801 once', () => {
    const result = applyDevCsp(baseCsp)
    expect(result).toContain('ws://127.0.0.1:8801')
    expect(result.split('ws://127.0.0.1:8801').length - 1).toBe(1)
  })

  it('does not duplicate on repeated calls', () => {
    const once = applyDevCsp(baseCsp)
    const twice = applyDevCsp(once)
    expect(twice).toBe(once)
  })
})

describe('applyDevHostPermission', () => {
  it('appends <all_urls> once', () => {
    const result = applyDevHostPermission(['http://localhost:8787/*'])
    expect(result).toEqual(['http://localhost:8787/*', '<all_urls>'])
    expect(applyDevHostPermission(result)).toEqual(result)
  })
})

describe('transformManifest', () => {
  it('dev adds ws://127.0.0.1:8801 to connect-src', () => {
    const result = transformManifest(baseManifest(), true)
    const csp = result.content_security_policy.extension_pages
    expect(csp).toContain('ws://127.0.0.1:8801')
    expect(csp).toContain('http://localhost:8787')
  })

  it('prod does not add ws://127.0.0.1:8801', () => {
    const result = transformManifest(baseManifest(), false)
    const csp = result.content_security_policy.extension_pages
    expect(csp).not.toContain('ws://127.0.0.1:8801')
    expect(csp).toContain('http://localhost:8787')
  })

  it('adds <all_urls> host permission only in dev', () => {
    const devResult = transformManifest(baseManifest(), true)
    const prodResult = transformManifest(baseManifest(), false)

    expect(devResult.host_permissions).toContain('<all_urls>')
    expect(prodResult.host_permissions).not.toContain('<all_urls>')
  })

  it('repeated dev transform does not duplicate the dev ws entry', () => {
    const once = transformManifest(baseManifest(), true)
    const twice = transformManifest(once, true)
    const csp = twice.content_security_policy.extension_pages
    expect(csp.split('ws://127.0.0.1:8801').length - 1).toBe(1)
    expect(once.host_permissions).toEqual(twice.host_permissions)
  })

  it('does not mutate the input manifest', () => {
    const input = baseManifest()
    const originalCsp = input.content_security_policy.extension_pages
    transformManifest(input, true)
    expect(input.content_security_policy.extension_pages).toBe(originalCsp)
  })
})
