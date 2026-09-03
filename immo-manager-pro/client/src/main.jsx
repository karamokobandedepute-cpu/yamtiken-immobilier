import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
// import { ReactQueryDevtools } from '@tanstack/react-query-devtools' // Désactivé
import { Toaster } from 'react-hot-toast'
import { SWRConfig } from 'swr'
import { queryClient } from './lib/queryClient'
import { swrGlobalConfig } from './lib/swrConfig.js'
import App from './App.jsx'
import { SentryErrorBoundary } from './components/SentryErrorBoundary.jsx'
import { initSentry } from './lib/sentry'
import './index.css'
import './styles/animations.css'

// 🔍 Initialiser Sentry pour le monitoring des erreurs
initSentry()

// Nettoyer le storage corrompu avant le rendu
try {
  const raw = localStorage.getItem('auth-storage')
  if (raw) {
    const parsed = JSON.parse(raw)
    if (parsed?.state?.token) {
      const parts = parsed.state.token.split('.')
      if (parts.length === 3) {
        const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
        const payload = JSON.parse(atob(b64))
        if (payload.exp * 1000 < Date.now()) {
          localStorage.removeItem('auth-storage')
        }
      } else {
        localStorage.removeItem('auth-storage')
      }
    }
  }
} catch (e) {
  localStorage.removeItem('auth-storage')
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SentryErrorBoundary>
      <SWRConfig value={swrGlobalConfig}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <App />
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#0D3B1F',
                  color: '#fff',
                },
                success: {
                  iconTheme: {
                    primary: '#2D9E57',
                    secondary: '#fff',
                  },
                },
                error: {
                  iconTheme: {
                    primary: '#ef4444',
                    secondary: '#fff',
                  },
                },
              }}
            />
          </BrowserRouter>
          {/* ReactQueryDevtools désactivé en production */}
        </QueryClientProvider>
      </SWRConfig>
    </SentryErrorBoundary>
  </React.StrictMode>,
)

// ============================================================
// PWA - ENREGISTREMENT DU SERVICE WORKER
// ============================================================
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(registration => {
        console.log('✅ Service Worker enregistré:', registration.scope)
        
        // Vérifier les mises à jour toutes les heures
        setInterval(() => {
          registration.update()
        }, 60 * 60 * 1000)
      })
      .catch(error => {
        console.error('❌ Erreur Service Worker:', error)
      })
  })
}
