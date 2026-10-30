import fs from 'fs-extra'
import chokidar from 'chokidar'
import path from 'path'
import process from 'process'
import console from 'console'
import { fileURLToPath } from 'url'
import { transformManifest } from './transformManifest.js'
import { resolveOutputDir } from './outputDir.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const extensionRoot = path.resolve(__dirname, '..')
const workspaceRoot = path.resolve(extensionRoot, '../..')
const fromExtension = (relativePath) =>
  path.resolve(extensionRoot, relativePath)
const __DEV__ = process.env.CRX_ENV === 'development'
const outputDir = resolveOutputDir(workspaceRoot)
// daemon 构建时传入当前 commit，写进 manifest 的 version_name
const buildCommit = process.env.CRX_BUILD_COMMIT

const origin = {
  manifest: fromExtension('src/manifest.json'),
  assets: fromExtension('src/assets')
}

const target = {
  manifest: path.join(outputDir, 'manifest.json'),
  assets: path.join(outputDir, 'assets')
}

const copyManifest = async () => {
  const raw = await fs.readFile(origin.manifest, 'utf-8')
  const manifest = JSON.parse(raw)
  const transformed = transformManifest(manifest, __DEV__, {
    commit: buildCommit
  })
  await fs.writeFile(
    target.manifest,
    JSON.stringify(transformed, null, 2),
    'utf-8'
  )
}
const copyIndexHtml = async () => {
  for (const view of ['popup', 'options', 'sidepanel']) {
    await fs.ensureDir(path.join(outputDir, view))
    let data = await fs.readFile(
      fromExtension(`src/${view}/index.html`),
      'utf-8'
    )
    data = data.replace(/\.ts/g, '.js')
    await fs.writeFile(path.join(outputDir, view, 'index.html'), data, 'utf-8')
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
  chokidar.watch(fromExtension('src/**/*.html')).on('change', () => {
    copyIndexHtml()
  })
}
