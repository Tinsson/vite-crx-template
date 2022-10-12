const hotReloadClientInit = () => {
  const bgWs = new WebSocket('ws://127.0.0.1:8801')
  const contentWs = new WebSocket('ws://127.0.0.1:8802')

  let isAlive = true
  bgWs.addEventListener('message', (e) => {
    if (e.data === 'updateCode') {
      bgWs.close()
      contentWs.close()
      setTimeout(() => {
        chrome.runtime.reload()
      }, 500)
    } else if (e.data === 'heartbeatMonitor') {
      isAlive = true
      const interval = setInterval(() => {
        setTimeout(() => {
          if (!isAlive) {
            const detectWs = new WebSocket('ws://127.0.0.1:8801')
            detectWs.onopen = () => {
              detectWs.close()
              clearInterval(interval)
              hotReloadClientInit()
            }
          }
        }, 500)
      }, 3000)
    } else if (e.data === 'heartbeat') {
      isAlive = true
      setTimeout(() => {
        isAlive = false
      }, 2500)
    }
  })

  contentWs.addEventListener('message', (e) => {
    if (e.data === 'updateCode') {
      reloadContent()
    }
  })

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message === 'reload_background_from_content' && !isAlive) {
      hotReloadClientInit()
    }
    sendResponse(true)
  })

  const reloadContent = () => {
    chrome.tabs.query({}, (tabs) => {
      const currentTab = tabs.find((tab) => tab.active)
      if (!currentTab || currentTab.url.indexOf('chrome') === 0) {
        return
      }
      const tabId = currentTab.id
      chrome.scripting.executeScript({
        target: { tabId },
        files: ['./contentScript/index.js']
      })
    })
  }
}

export default hotReloadClientInit
