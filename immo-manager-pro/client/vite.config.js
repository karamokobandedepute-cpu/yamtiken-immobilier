
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './', // Chemins relatifs — requis pour electron-serve (app:// protocol)
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
    headers: {
      'Cache-Control': 'no-store'
    },
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_INTERNAL_URL || 'http://localhost:5000',
        changeOrigin: true
      }
    }
  },
  build: {
    // On désactive le découpage complexe pour éviter les erreurs d'import
    rollupOptions: {
      output: {
        manualChunks: undefined,
        inlineDynamicImports: true
      }
    },
    chunkSizeWarningLimit: 2000 // On augmente la limite pour éviter les alertes
  }
})
