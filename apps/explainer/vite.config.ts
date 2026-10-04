import { defineConfig } from 'vite'

// Served by FastAPI at /explain/. In dev, /api goes to FastAPI.
export default defineConfig({
  base: '/explain/',
  server: {
    port: 5174,
    allowedHosts: ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app', '.ngrok.io'],
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
})
