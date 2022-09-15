import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'

// const __DEV__ = process.env.NODE_ENV === 'development'

// console.log(__DEV__)

(() => {
  const container = document.createElement('div')
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

