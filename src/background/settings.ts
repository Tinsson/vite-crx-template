import { onMessage } from '../shared/message'

/**
 * chrome.storage.sync 设置读写示例：
 * popup / options 通过 'get-setting' / 'set-setting' 间接读写，
 * 数据会同步到登录的 Google 账号（storage.sync），适合小体积偏好设置。
 * 大数据缓存请走 src/background/db.ts 的 IndexedDB。
 */
onMessage('get-setting', async (params) => {
  const data = await chrome.storage.sync.get(params.key)
  return {
    result: data[params.key]
  }
})

onMessage('set-setting', async (params) => {
  await chrome.storage.sync.set({ [params.key]: params.value })
  return {
    result: true
  }
})
