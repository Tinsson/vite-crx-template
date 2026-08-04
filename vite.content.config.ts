import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import { r, commonConfig } from './vite.config.ts'
import hotReloadContent from './scripts/hot-reload/content.ts'
import { __DEV__, outputDir } from './const.ts'

const contentScriptCss = (): Plugin => ({
  name: 'vite-content-script-css',
  apply: 'build',
  enforce: 'post',
  generateBundle(_options, bundle) {
    let styleCss: { fileName: string; source: string } | null = null
    for (const file of Object.values(bundle)) {
      if (file.type === 'asset' && file.fileName.endsWith('.css')) {
        styleCss = file as { fileName: string; source: string }
        break
      }
    }
    if (styleCss) {
      styleCss.source = styleCss.source.replace(/:root(?=\s*\{)/g, ':host')
    } else {
      this.emitFile({ type: 'asset', fileName: 'style.css', source: '' })
    }
  }
})

// bundling the content script
export default defineConfig({
  ...commonConfig,
  build: {
    watch: __DEV__ ? {} : null,
    cssCodeSplit: false,
    emptyOutDir: false,
    sourcemap: __DEV__,
    outDir: r(`${outputDir}/contentScript`),
    rollupOptions: {
      input: {
        contentScript: r('src/contentScript/index.ts')
      },
      output: {
        assetFileNames: '[name].[ext]',
        entryFileNames: 'index.js',
        extend: true,
        format: 'iife'
      }
    }
  },
  plugins: [...commonConfig.plugins, contentScriptCss(), hotReloadContent()]
})
