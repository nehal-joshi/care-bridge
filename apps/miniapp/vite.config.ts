import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In development, /api goes to FastAPI. ngrok hosts are allowed so the app can open inside Telegram.
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app', '.ngrok.io'],
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/explain': 'http://127.0.0.1:8000',
    },
  },
})
