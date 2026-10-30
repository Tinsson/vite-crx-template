const DEV_WS_CSP = 'ws://127.0.0.1:8801'
const DEV_HOST_PERMISSION = '<all_urls>'
// 与 packages/shared 的 SERVER_PORT / DAEMON_PORT 保持一致（有测试保证）
export const DEV_SERVER_PORT = 8787
export const DAEMON_PORT = 8788

export function applyDevCsp(csp) {
  if (csp.includes(DEV_WS_CSP)) return csp
  return csp + ' ' + DEV_WS_CSP
}

export function applyDevHostPermission(hostPermissions = []) {
  if (hostPermissions.includes(DEV_HOST_PERMISSION)) return hostPermissions
  return [...hostPermissions, DEV_HOST_PERMISSION]
}

/** 生产构建连常驻 daemon：把 manifest 里的 dev 服务端端口换成 daemon 端口 */
export function applyServerPort(value, port) {
  return value.replaceAll(`localhost:${DEV_SERVER_PORT}`, `localhost:${port}`)
}

/**
 * @param {object} manifest 源 manifest
 * @param {boolean} isDev 是否开发构建
 * @param {{ commit?: string }} [options] commit：写入 version_name，供 daemon 判断已安装的提交
 */
export function transformManifest(manifest, isDev, options = {}) {
  const result = JSON.parse(JSON.stringify(manifest))
  if (options.commit) {
    result.version_name = `${result.version} (${options.commit})`
  }
  if (!isDev) {
    result.host_permissions = (result.host_permissions ?? []).map((item) =>
      applyServerPort(item, DAEMON_PORT)
    )
    const csp = result.content_security_policy?.extension_pages
    if (csp) {
      result.content_security_policy.extension_pages = applyServerPort(
        csp,
        DAEMON_PORT
      )
    }
  }
  if (isDev) {
    result.host_permissions = applyDevHostPermission(result.host_permissions)
    const csp = result.content_security_policy?.extension_pages
    if (csp) {
      result.content_security_policy.extension_pages = applyDevCsp(csp)
    }
  }
  return result
}
