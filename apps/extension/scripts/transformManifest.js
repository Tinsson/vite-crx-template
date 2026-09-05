const DEV_WS_CSP = 'ws://127.0.0.1:8801'
const DEV_HOST_PERMISSION = '<all_urls>'

export function applyDevCsp(csp) {
  if (csp.includes(DEV_WS_CSP)) return csp
  return csp + ' ' + DEV_WS_CSP
}

export function applyDevHostPermission(hostPermissions = []) {
  if (hostPermissions.includes(DEV_HOST_PERMISSION)) return hostPermissions
  return [...hostPermissions, DEV_HOST_PERMISSION]
}

export function transformManifest(manifest, isDev) {
  const result = JSON.parse(JSON.stringify(manifest))
  if (isDev) {
    result.host_permissions = applyDevHostPermission(result.host_permissions)
    const csp = result.content_security_policy?.extension_pages
    if (csp) {
      result.content_security_policy.extension_pages = applyDevCsp(csp)
    }
  }
  return result
}
