import { onMessage } from '~/shared/message'
import { fetchHealth } from './httpClient'
import { WebSocketClient } from './webSocketClient'
import {
  UPDATE_POLL_ALARM,
  fetchUpdateStatus,
  finishPendingUpdate,
  getLocalVersionInfo,
  handleUpdateStatus,
  runUpdate,
  runUpdateCheck,
  setUpdateConfig
} from './updater'

const webSocketClient = new WebSocketClient({
  onUpdateEvent: ({ status }) => void handleUpdateStatus(status)
})

onMessage('server-health', async () => {
  return fetchHealth()
})

onMessage('server-ws-status', async () => {
  await webSocketClient.ensureConnected().catch(() => undefined)
  return webSocketClient.getStatus()
})

onMessage('server-ws-echo', async ({ text }) => {
  return webSocketClient.echo(text)
})

onMessage('update-status', () => fetchUpdateStatus())
onMessage('update-check', () => runUpdateCheck())
onMessage('update-run', async () => {
  // 先连上 WebSocket，才能收到构建进度和完成通知
  await webSocketClient.ensureConnected().catch(() => undefined)
  return runUpdate()
})
onMessage('update-set-config', (config) => setUpdateConfig(config))
onMessage('update-local-info', () => getLocalVersionInfo())

// WebSocket 有心跳流量时 service worker 会一直存活，能收到 daemon 的推送。
// daemon 重启或 SW 被回收后靠这个 alarm 每分钟重连一次，并拉一次状态兜底。
chrome.alarms?.create(UPDATE_POLL_ALARM, { periodInMinutes: 1 })
chrome.alarms?.onAlarm.addListener((alarm) => {
  if (alarm.name !== UPDATE_POLL_ALARM) return
  void webSocketClient.ensureConnected().catch(() => undefined)
  void fetchUpdateStatus()
})

void finishPendingUpdate().catch(() => undefined)
void webSocketClient.ensureConnected().catch(() => undefined)
void fetchUpdateStatus()
