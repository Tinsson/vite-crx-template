import { sendMessageToTab } from '../shared/message'

/**
 * 权限示例：
 *  - chrome.contextMenus：右键菜单
 *  - chrome.action.setBadgeText / setBadgeBackgroundColor：图标角标
 *  - chrome.tabs.sendMessage（封装为 sendMessageToTab）：background -> contentScript
 *
 * 右键点击菜单后：向当前标签页的 contentScript 推送 'ping-content'，
 * 并把点击次数写入 storage.sync，显示为图标角标。
 */

const BADGE_KEY = 'ping-count'

const createContextMenu = () => {
  chrome.contextMenus.create({
    id: 'ping-content',
    title: '向当前页面 contentScript 发送消息',
    contexts: ['page']
  })
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll()
  createContextMenu()
})

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    // 个别场景（如 chrome 内部页面）tab.id 可能为 -1，setBadgeText 要求 >= 0
    if (
      info.menuItemId !== 'ping-content' ||
      tab?.id === undefined ||
      tab.id < 0
    )
      return

    const data = await chrome.storage.sync.get(BADGE_KEY)
    const count = (Number(data[BADGE_KEY]) || 0) + 1
    await chrome.storage.sync.set({ [BADGE_KEY]: count })

    await chrome.action.setBadgeText({ text: String(count), tabId: tab.id })
    await chrome.action.setBadgeBackgroundColor({
      color: '#409eff',
      tabId: tab.id
    })

    const res = await sendMessageToTab(tab.id, 'ping-content', undefined)
    console.log('contentScript 响应:', res)
  } catch (e) {
    console.log('右键菜单处理失败:', e)
  }
})
