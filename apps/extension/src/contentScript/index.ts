import { createApp } from 'vue'
import 'element-plus/dist/index.css'
import App from './App.vue'
;(() => {
  const rootIdName = 'vite_crx_content_script'
  const beforeRoot = document.querySelector(`#${rootIdName}`)
  // 热更新或 daemon 自动更新后会重新注入，先移除旧实例，避免页面上出现两个
  if (beforeRoot) {
    beforeRoot.remove()
  }
  const container = document.createElement('div')
  container.id = rootIdName
  const root = document.createElement('div')
  const styleEl = document.createElement('link')
  const shadowDOM =
    container.attachShadow?.({ mode: __DEV__ ? 'open' : 'closed' }) || container
  styleEl.setAttribute('rel', 'stylesheet')
  styleEl.setAttribute('href', chrome.runtime.getURL('contentScript/style.css'))
  shadowDOM.appendChild(styleEl)
  shadowDOM.appendChild(root)
  document.body.appendChild(container)

  const app = createApp(App)
  app.mount(root)
})()
