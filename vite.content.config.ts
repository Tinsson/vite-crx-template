import { defineConfig } from 'vite'
import { r, commonConfig } from './vite.config'
import { replaceCodePlugin } from 'vite-plugin-replace'
import hotReloadContent from './scripts/hot-reload/content'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { __DEV__, outputDir } from './const'

// bundling the content script
export default defineConfig({
  ...commonConfig,
  build: {
    watch: __DEV__ ? {} : null,
    cssCodeSplit: false,
    emptyOutDir: false,
    sourcemap: false,
    outDir: r(`${outputDir}/contentScript`),
    rollupOptions: {
      input: {
        contentScript: r('src/contentScript/index.ts'),
      },
      output: {
        assetFileNames: '[name].[ext]',
        entryFileNames: 'index.js',
        extend: true,
        format: 'iife'
      },
    },
  },
  plugins: [
    ...commonConfig.plugins,
    replaceCodePlugin({
      replacements: [
        {
          from: /:root\{/g,
          to: ':host{'
        }
      ]
    }),
    AutoImport({
      resolvers: [ElementPlusResolver()],
    }),
    Components({
      resolvers: [ElementPlusResolver()],
    }),
    hotReloadContent()
  ]
})
