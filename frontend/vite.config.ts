import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    allowedHosts: [
      'a3a0ca52c0ba07.lhr.life',
      'f54b9f294caab5.lhr.life',
      'c271bc9c4fa55d.lhr.life',
      'fd701afaac6c90.lhr.life',
      'localhost',
      '127.0.0.1'
    ],
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  },
  build: {
    sourcemap: false
  }
})
