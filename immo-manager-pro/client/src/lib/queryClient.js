import { QueryClient } from '@tanstack/react-query'
import { captureError, addSentryBreadcrumb } from './sentry'

// ============================================================
// QUERY CLIENT - CONFIGURATION OPTIMALE REACT QUERY V5
// Architecture: Cache intelligent + Retry smart + Sync multi-onglets
// ============================================================
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 🕒 CACHE & FRESHNESS
      staleTime: 10 * 60 * 1000,       // Données fraîches pendant 10 min (réduit refetch)
      gcTime: 30 * 60 * 1000,          // Garbage collection après 30 min
      
      // 🔄 RETRY STRATEGY
      retry: (failureCount, error) => {
        // Breadcrumb Sentry
        addSentryBreadcrumb(
          `Query retry attempt ${failureCount}`,
          'query',
          'warning',
          { error: error?.message }
        )

        // Jamais de retry sur erreurs HTTP client (4xx)
        if (error?.response?.status === 401) return false  // Non authentifié
        if (error?.response?.status === 403) return false  // Interdit
        if (error?.response?.status === 404) return false  // Non trouvé
        if (error?.response?.status >= 400 && error?.response?.status < 500) return false
        
        // Retry sur erreurs serveur (5xx) ou réseau - max 2 tentatives
        return failureCount < 2
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Backoff exponentiel
      
      // 🔄 REFETCH BEHAVIOR - Optimisé pour réduire les appels inutiles
      refetchOnWindowFocus: false,     // ⚡ Désactivé : évite les rafraîchissements au focus
      refetchOnReconnect: true,        // Refetch à la reconnexion réseau
      refetchOnMount: true,            // Refetch au montage si stale
      refetchInterval: false,          // Pas de polling auto
      
      // 🌐 NETWORK MODE
      networkMode: 'online',           // Requêtes uniquement si en ligne
      
      // ⚠️ ERROR HANDLING
      throwOnError: false,             // Ne pas throw, gérer via error state
      
      // 📊 LOGGING (dev uniquement)
      meta: {
        errorMessage: 'Erreur de chargement des données'
      }
    },
    
    mutations: {
      // 🔄 RETRY
      retry: 0,                        // Pas de retry auto sur mutations
      networkMode: 'online',
      
      // ⚠️ ERROR HANDLING
      onError: (error, variables, context) => {
        // Capturer dans Sentry
        captureError(error, {
          mutation: {
            variables,
            context
          }
        })

        // Gérer expiration auth
        if (error?.response?.status === 401) {
          window.dispatchEvent(new CustomEvent('auth:expired'))
        }
      },
      
      // ✅ SUCCESS LOGGING
      onSuccess: (data, variables, context) => {
        addSentryBreadcrumb(
          'Mutation success',
          'mutation',
          'info',
          { variables }
        )
      }
    }
  }
})

// ============================================================
// INVALIDATION GLOBALE - Déclenché par Realtime
// ============================================================
const TABLE_TO_QUERYKEY = {
  clients:     ['clients'],
  leases:      ['leases'],
  payments:    ['payments'],
  biens:       ['biens'],
  contrats:    ['contrats'],
  visites:     ['visites'],
  alertes:     ['alertes', 'alertes-count'],
  buildings:   ['buildings'],
  commissions: ['commissions'],
  users:       ['users'],
}

export const invalidateFromRealtime = (table) => {
  const keys = TABLE_TO_QUERYKEY[table]
  if (!keys) return
  keys.forEach(key => queryClient.invalidateQueries({ queryKey: [key] }))
  // Invalider aussi le dashboard
  queryClient.invalidateQueries({ queryKey: ['dashboard'] })
}

// Helpers legacy
export const invalidatePortesCache = () => {
  queryClient.invalidateQueries({ queryKey: ['types-portes'] })
  queryClient.invalidateQueries({ queryKey: ['attributions'] })
  queryClient.invalidateQueries({ queryKey: ['client-summary'] })
  queryClient.invalidateQueries({ queryKey: ['batiment-stock'] })
}
