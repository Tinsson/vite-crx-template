import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import hotReloadBackground from './scripts/hot-reload/background'
import { __DEV__ } from './const'
import eslintPlugin from 'vite-plugin-eslint'

export const r = (...args: string[]) => resolve(__dirname, '.', ...args)

console.log(__DEV__)

export const commonConfig = {
  root: r('src'),
  define: {
    __DEV__,
  },
  plugins: [
    Vue(),
    eslintPlugin({
      include: ['src/**/*.js', 'src/**/*.vue', 'src/*.js', 'src/*.vue']
    })
  ],
}

export default defineConfig({
  ...commonConfig,
  build: {
    watch: {},
    cssCodeSplit: false,
    emptyOutDir: false,
    sourcemap: false,
    outDir: r('local'),
    rollupOptions: {
      input: {
        background: r('src/background/index.ts'),
      },
      output: {
        entryFileNames: '[name]/index.js',
        extend: true,
        format: 'iife'
      },
    },
  },
  plugins: [
    ...commonConfig.plugins,
    hotReloadBackground()
  ]
})
