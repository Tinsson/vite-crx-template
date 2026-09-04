import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import hotReloadBackground from './scripts/hot-reload/background.ts'
import { __DEV__, outputDir } from './const.ts'

export const r = (...args: string[]) =>
  resolve(import.meta.dirname, '.', ...args)

export const commonConfig = {
  root: r('src'),
  define: {
    __DEV__
  },
  resolve: {
    alias: {
      '~/': `${r('src')}/`
    }
  },
  plugins: [
    Vue(),
    AutoImport({
      resolvers: [ElementPlusResolver()]
    }),
    Components({
      resolvers: [ElementPlusResolver()]
    })
  ]
}

export default defineConfig({
  ...commonConfig,
  build: {
    watch: __DEV__ ? {} : null,
    cssCodeSplit: false,
    emptyOutDir: false,
    sourcemap: __DEV__,
    outDir: outputDir,
    rollupOptions: {
      input: {
        background: r('src/background/index.ts'),
        popup: r('src/popup/index.ts'),
        options: r('src/options/index.ts'),
        sidepanel: r('src/sidepanel/index.ts')
      },
      output: {
        assetFileNames: '[name].[ext]',
        entryFileNames: '[name]/index.js',
        extend: true,
        format: 'es'
      }
    }
  },
  plugins: [...commonConfig.plugins, hotReloadBackground()]
})
