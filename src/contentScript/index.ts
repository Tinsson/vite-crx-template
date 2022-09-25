import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'
import './hotRefresh'

// const __DEV__ = process.env.NODE_ENV === 'development'

(() => {
  const __DEV__ = true
  const rootIdName: string = 'vite_crx_content_script'
  const beforeRoot = document.querySelector(`#${rootIdName}`)
  if (beforeRoot && __DEV__) {
    document.body.removeChild(beforeRoot)
  }
  const container = document.createElement('div')
  container.id = rootIdName
  const root = document.createElement('div')
  const styleEl = document.createElement('link')
  // const shadowDOM = container.attachShadow?.({ mode: __DEV__ ? 'open' : 'closed' }) || container
  const shadowDOM = container.attachShadow?.({ mode: 'open' }) || container
  styleEl.setAttribute('rel', 'stylesheet')
  // @ts-ignore
  styleEl.setAttribute('href', chrome.runtime.getURL('contentScript/style.css'))
  // styleEl.setAttribute('href', './dist/common.css')
  shadowDOM.appendChild(styleEl)
  shadowDOM.appendChild(root)
  document.body.appendChild(container)

  const app = createApp(App)
  app.use(ElementPlus)
  app.mount(root)
})()

