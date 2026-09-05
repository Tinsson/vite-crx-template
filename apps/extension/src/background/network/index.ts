import { onMessage } from '~/shared/message'
import { fetchHealth } from './httpClient'
import { WebSocketClient } from './webSocketClient'

const webSocketClient = new WebSocketClient()

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

// A first connection is useful when the Background starts, but never retries by
// itself: later status/echo requests explicitly decide whether to reconnect.
void webSocketClient.ensureConnected().catch(() => undefined)
