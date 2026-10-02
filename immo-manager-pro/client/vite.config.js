
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'serve' ? '/' : './',
  server: {
    host: true, // Écoute sur IPv4 et IPv6 (0.0.0.0 et ::)
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 5173
    },
    headers: {
      'Cache-Control': 'no-store'
    },
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_INTERNAL_URL || 'http://127.0.0.1:5000',
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
}))

