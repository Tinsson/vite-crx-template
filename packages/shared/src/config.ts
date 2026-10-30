export const SERVER_HOST = 'localhost'
export const SERVER_PORT = 8787
export const HTTP_BASE_URL = `http://${SERVER_HOST}:${SERVER_PORT}`
export const WS_URL = `ws://${SERVER_HOST}:${SERVER_PORT}/ws`
export const HTTP_TIMEOUT_MS = 5_000
export const WS_CONNECT_TIMEOUT_MS = 5_000
export const WS_REQUEST_TIMEOUT_MS = 5_000
export const HEARTBEAT_INTERVAL_MS = 20_000
export const HEARTBEAT_TIMEOUT_MS = 30_000

/** 常驻 daemon 端口，和 dev 服务端（8787）、扩展热重载（8801）错开 */
export const DAEMON_PORT = 8788
export const DAEMON_HTTP_BASE_URL = `http://${SERVER_HOST}:${DAEMON_PORT}`
export const DAEMON_WS_URL = `ws://${SERVER_HOST}:${DAEMON_PORT}/ws`

/** 定时检查间隔（分钟）：默认 1 小时，限制在 5 分钟 ~ 24 小时 */
export const UPDATE_CHECK_INTERVAL_DEFAULT_MIN = 60
export const UPDATE_CHECK_INTERVAL_MIN_MIN = 5
export const UPDATE_CHECK_INTERVAL_MAX_MIN = 24 * 60
