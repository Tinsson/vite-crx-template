import { onMessage, sendMessage, sendMessageToTab } from '~/shared/message'

export { onMessage, sendMessage, sendMessageToTab }

export const getCache = (keyName: string) =>
  sendMessage('get-value-bg', { keyName })

export const setCache = (keyName: string, value: any) =>
  sendMessage('set-value-bg', { keyName, value })

export const delCache = (keyName: string) =>
  sendMessage('del-value-bg', { keyName })
