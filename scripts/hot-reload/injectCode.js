const hotReloadClientInit = () => {
  const bgWs = new WebSocket(`ws://127.0.0.1:${UP_PORT}`)

  let isAlive = true
  bgWs.addEventListener('message', (e) => {
    if (e.data === 'UPDATE_BG') {
      bgWs.close()
      setTimeout(() => {
        chrome.runtime.reload()
      }, 500)
    } else if (e.data === 'UPDATE_CONTENT_SCRIPT') {
      reloadContent()
    } else if (e.data === 'heartbeatMonitor') {
      isAlive = true
      const interval = setInterval(() => {
        setTimeout(() => {
          if (!isAlive) {
            const detectWs = new WebSocket(`ws://127.0.0.1:${UP_PORT}`)
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

  const reloadContent = () => {
    chrome.tabs.query({}, (tabs) => {
      const activeTabs = tabs.filter((tab) => tab.active && tab.url.indexOf('chrome') !== 0)
      console.log(activeTabs)
      for (const tab of activeTabs) {
        const tabId = tab.id
        chrome.scripting.executeScript({
          target: { tabId },
          files: ['./contentScript/index.js']
        })
      }
    })
  }
}
hotReloadClientInit()
