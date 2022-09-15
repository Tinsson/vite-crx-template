import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export const r = (...args: string[]) => resolve(__dirname, '.', ...args)

export const commonConfig = {
  root: r('src'),
  plugins: [
    Vue()
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
})
