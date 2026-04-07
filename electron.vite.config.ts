import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    // In CI/root-Umgebung: --no-sandbox automatisch setzen
    ...(process.env.ELECTRON_NO_SANDBOX ? {
      define: { 'process.env.ELECTRON_NO_SANDBOX': '"1"' }
    } : {})
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@': resolve('src/renderer/src')
      }
    },
    plugins: [react()]
  }
})
