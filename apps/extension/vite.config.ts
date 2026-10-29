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

// 两个构建并行运行，且各自只看到自己入口用到的组件。
// 因此每个构建写自己的声明文件，避免后跑的构建覆盖掉前一个的类型。
export const vuePlugins = (dtsSuffix = '') => [
  Vue(),
  AutoImport({
    resolvers: [ElementPlusResolver()],
    dts: r(`src/auto-imports${dtsSuffix}.d.ts`)
  }),
  Components({
    resolvers: [ElementPlusResolver()],
    dts: r(`src/components${dtsSuffix}.d.ts`)
  })
]

export const commonConfig = {
  root: r('src'),
  define: {
    __DEV__
  },
  resolve: {
    alias: {
      '~/': `${r('src')}/`
    }
  }
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
  plugins: [...vuePlugins(), hotReloadBackground()]
})
