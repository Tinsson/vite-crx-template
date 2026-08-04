/**
 * sidePanel 相关的公共工具。
 *
 * 注意：不要直接给 chrome.sidePanel.open/close 传 chrome.windows.WINDOW_ID_CURRENT
 * （固定值 -2），close() 不会把它解析成真实窗口 id 会静默失败；
 * 先用当前活动标签页解析出真实的 windowId 再调用。
 */
export const getCurrentWindowId = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab?.windowId
}
