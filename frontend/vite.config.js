import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://earth-table-backend-v9hsi4xdb-earth-table.vercel.app',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
