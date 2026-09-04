const DEV_WS_CSP = 'ws://127.0.0.1:8801'

export function applyDevCsp(csp) {
  if (csp.includes(DEV_WS_CSP)) return csp
  return csp + ' ' + DEV_WS_CSP
}

export function transformManifest(manifest, isDev) {
  const result = JSON.parse(JSON.stringify(manifest))
  if (isDev) {
    const csp = result.content_security_policy?.extension_pages
    if (csp) {
      result.content_security_policy.extension_pages = applyDevCsp(csp)
    }
  }
  return result
}
