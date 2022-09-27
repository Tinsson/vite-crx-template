const fs = require('fs-extra')
const chokidar = require('chokidar')
const path = require('path')
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
  fs.copy(origin.manifest, target.manifest)
}

copuManifest()

const copyAssets = () => {
  fs.copy(origin.assets, target.assets)
}

copyAssets()

chokidar.watch([origin.manifest]).on('change', () => {
  copuManifest()
})
