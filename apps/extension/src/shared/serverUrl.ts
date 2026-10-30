import {
  DAEMON_HTTP_BASE_URL,
  DAEMON_WS_URL,
  HTTP_BASE_URL,
  WS_URL
} from '@vite-crx/shared'

/**
 * 开发构建（local/）连 `pnpm dev` 的服务端（8787），
 * 生产构建（extension/）连常驻 daemon（8788）。
 * 单元测试里没有注入 __DEV__，按开发环境处理。
 */
const isProdBuild = typeof __DEV__ !== 'undefined' && !__DEV__

export const SERVER_HTTP_BASE = isProdBuild
  ? DAEMON_HTTP_BASE_URL
  : HTTP_BASE_URL
export const SERVER_WS_URL = isProdBuild ? DAEMON_WS_URL : WS_URL
