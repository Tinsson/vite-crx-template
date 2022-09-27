const hotReloadContentInit = () => {
  if (window.location.host === '127.0.0.1:8803') {
    chrome.runtime.sendMessage({
      message: 'reload_background_from_content'
    })
    window.close()
  }
}
hotReloadContentInit()
