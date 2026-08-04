import fs from 'fs-extra'
import chokidar from 'chokidar'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const r = (rootPath) => path.resolve(__dirname, '..', rootPath)
const __DEV__ = process.env.CRX_ENV === 'development'
const outputDir = __DEV__ ? 'local' : 'extension'

const origin = {
  manifest: r('src/manifest.json'),
  assets: r('src/assets')
}

const target = {
  manifest: r(`${outputDir}/manifest.json`),
  assets: r(`${outputDir}/assets`)
}

const copyManifest = () => {
  fs.copy(origin.manifest, target.manifest)
}
const copyIndexHtml = async () => {
  for (const view of ['popup', 'options', 'sidepanel']) {
    await fs.ensureDir(r(`${outputDir}/${view}`))
    let data = await fs.readFile(r(`src/${view}/index.html`), 'utf-8')
    data = data.replace(/\.ts/g, '.js')
    await fs.writeFile(r(`${outputDir}/${view}/index.html`), data, 'utf-8')
  }
  console.log('复制html文件成功')
}
const copyAssets = () => {
  fs.copy(origin.assets, target.assets)
}

copyManifest()
copyIndexHtml()
copyAssets()

if (__DEV__) {
  chokidar.watch([origin.manifest]).on('change', () => {
    copyManifest()
  })
  chokidar.watch(r('src/**/*.html')).on('change', () => {
    copyIndexHtml()
  })
}
