import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true, // Listen on all network interfaces (0.0.0.0) so mobile devices on the same Wi-Fi can scan & test QR codes
    port: 5173,
  },
})
