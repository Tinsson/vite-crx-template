import { copy } from 'fs-extra'
import { watch } from 'chokidar'
import path from 'path'
const { resolve } = path

const r = (rootPath) => resolve(__dirname, '..', rootPath)

const origin = {
  manifest: r('src/manifest.json'),
  assets: r('src/assets')
}

const target = {
  manifest: r('local/manifest.json'),
  assets: r('local/assets')
}

const copuManifest = () => {
  copy(origin.manifest, target.manifest)
}

copuManifest()

const copyAssets = () => {
  copy(origin.assets, target.assets)
}

copyAssets()

watch([origin.manifest]).on('change', () => {
  copuManifest()
})
