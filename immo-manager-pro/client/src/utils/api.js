import axios from 'axios'

// ═══════════════════════════════════════════════════════════════════
// 🚀 CACHE EN MÉMOIRE — Navigation instantanée
// Les données sont servies immédiatement depuis le cache
// puis rafraîchies en arrière-plan
// ═══════════════════════════════════════════════════════════════════
const _cache = new Map()
const CACHE_TTL = 2 * 60 * 1000 // 2 minutes

const _cacheKey = (url, params) =>
  params && Object.keys(params).length > 0
    ? `${url}::${JSON.stringify(params)}`
    : url

const _getCached = (key) => {
  const entry = _cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL) { _cache.delete(key); return null }
  return entry.data
}

const _setCached = (key, data) => _cache.set(key, { data, ts: Date.now() })

export const invalidateCacheFor = (...patterns) => {
  for (const key of _cache.keys()) {
    if (patterns.some(p => key.startsWith(p))) _cache.delete(key)
  }
}

export const clearAllCache = () => _cache.clear()
import { useAuthStore } from '../stores/authStore'
import toast from 'react-hot-toast'
import { healthCheck } from '../lib/healthCheck'
import { captureError, addSentryBreadcrumb, addSentryContext } from '../lib/sentry'

// Détection automatique de l'environnement
const isProduction = import.meta.env.PROD || import.meta.env.NODE_ENV === 'production'

// URL de base API — dev : proxy Vite /api ; prod : VITE_API_URL ou VPS fixe
const API_URL = import.meta.env.PROD
  ? (import.meta.env.VITE_API_URL || 'http://54.36.209.70:5000/api')
  : '/api'

if (!isProduction) console.debug(`[API] Base URL: ${API_URL}`)

// Configuration ultra-robuste pour éviter les erreurs réseau
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  timeout: 30000, // 30 secondes timeout (requêtes lentes DB)
  withCredentials: true // Important pour CORS avec credentials
})

// Intercepteur pour ajouter le token JWT à chaque requête
api.interceptors.request.use((config) => {
  // 1. Source principale : store Zustand en mémoire (immédiat, pas de délai localStorage)
  const storeToken = useAuthStore.getState?.()?.token
  if (storeToken) {
    config.headers.Authorization = `Bearer ${storeToken}`
    return config
  }
  // 2. Fallback : localStorage (après rehydration)
  try {
    const raw = localStorage.getItem('auth-storage')
    if (raw) {
      const token = JSON.parse(raw)?.state?.token
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
        return config
      }
    }
  } catch (e) { /* storage corrompu */ }
  // 3. Fallback final : axios.defaults
  const defaultAuth = axios.defaults.headers.common?.['Authorization']
  if (defaultAuth) config.headers.Authorization = defaultAuth
  return config
})

// Intercepteur pour gérer les erreurs + refresh token automatique
let isRefreshing = false
let failedQueue = []

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) prom.reject(error)
    else prom.resolve(token)
  })
  failedQueue = []
}

// ═══════════════════════════════════════════════════════════════════
// SYSTÈME ANTI-SPAM ULTRA-ROBUSTE + GESTION AUTH
// Évite complètement les toasts en cascade
// ═══════════════════════════════════════════════════════════════════

const TOAST_IDS = {
  timeout:  'api-timeout',
  network:  'api-network',
  server:   'api-server',
  auth:     'api-auth',
}

// État global pour tracker les erreurs
const errorState = {
  lastToastTime: {},
  networkErrorCount: 0,
  firstNetworkErrorTime: null,
  isInQuietMode: false,
  quietModeTimer: null,
  authErrorShown: false,  // 🔒 Empêche les toasts auth en cascade
  isRedirecting: false    // 🔒 Empêche les redirections multiples
}

const TOAST_THROTTLE_MS = 30000 // 30s entre toasts du même type (augmenté)
const QUIET_MODE_DURATION = 60000 // 1 minute de silence après 3 erreurs réseau
const MAX_ERRORS_BEFORE_QUIET = 3

/**
 * Reset l'état d'erreur auth (appelé au login réussi)
 */
export const resetAuthErrorState = () => {
  errorState.authErrorShown = false
  errorState.isRedirecting = false
  console.log('[API] État auth réinitialisé')
}

/**
 * Active le mode silence (pas de toasts pendant 1 minute)
 */
const enableQuietMode = () => {
  if (errorState.isInQuietMode) return
  
  errorState.isInQuietMode = true
  console.warn('[API] Mode silence activé pendant 60s suite à trop d\'erreurs réseau')
  
  // Notifier le health check
  healthCheck.enableSilence(QUIET_MODE_DURATION)
  
  if (errorState.quietModeTimer) {
    clearTimeout(errorState.quietModeTimer)
  }
  
  errorState.quietModeTimer = setTimeout(() => {
    errorState.isInQuietMode = false
    errorState.networkErrorCount = 0
    errorState.firstNetworkErrorTime = null
    console.info('[API] Mode silence désactivé')
  }, QUIET_MODE_DURATION)
}

/**
 * Gestion intelligente des erreurs réseau
 */
const trackNetworkError = () => {
  const now = Date.now()
  
  if (!errorState.firstNetworkErrorTime || 
      (now - errorState.firstNetworkErrorTime) > 10000) {
    // Réinitialiser si la dernière erreur date de plus de 10s
    errorState.networkErrorCount = 1
    errorState.firstNetworkErrorTime = now
  } else {
    errorState.networkErrorCount++
  }
  
  // Activer le mode silence après trop d'erreurs
  if (errorState.networkErrorCount >= MAX_ERRORS_BEFORE_QUIET) {
    enableQuietMode()
    return false // Ne pas afficher de toast
  }
  
  return !errorState.isInQuietMode
}

const throttledToast = (type, message, options = {}) => {
  // Vérifier le mode silence global
  if (errorState.isInQuietMode || !healthCheck.shouldShowError()) {
    console.debug('[API] Toast supprimé (mode silence):', message)
    return
  }
  
  const now = Date.now()
  const last = errorState.lastToastTime[type] || 0
  
  // Throttling strict
  if (now - last < TOAST_THROTTLE_MS) {
    console.debug('[API] Toast throttled:', type)
    return
  }
  
  errorState.lastToastTime[type] = now
  toast.dismiss(TOAST_IDS[type])
  toast.error(message, { id: TOAST_IDS[type], duration: 5000, ...options })
}

// Intercepteur pour gérer les erreurs avec messages ultra-clairs
api.interceptors.response.use(
  (response) => {
    // 📊 Breadcrumb pour requête réussie
    addSentryBreadcrumb(
      `API ${response.config.method?.toUpperCase()} ${response.config.url}`,
      'http',
      'info',
      { status: response.status }
    )
    return response
  },
  async (error) => {
    const originalRequest = error.config
    
    // 🚨 DÉTECTION ERREURS RÉSEAU SPÉCIFIQUES
    if (!error.response) {
      // Tracker l'erreur réseau
      const shouldShowToast = trackNetworkError()
      
      // 🔍 Capturer dans Sentry
      captureError(error, {
        api: {
          url: originalRequest?.url,
          method: originalRequest?.method,
          type: 'network_error'
        }
      })
      
      // Pas de réponse = problème réseau
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        console.error('[API] Timeout:', error.config?.url)
        if (shouldShowToast) {
          throttledToast('timeout', '⏱️ Le serveur met trop de temps à répondre.')
        }
      } else if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
        console.error('[API] Erreur réseau:', error.config?.url)
        if (shouldShowToast) {
          throttledToast('network', '🔌 Serveur injoignable. Vérification en cours...')
        }
      } else {
        console.error('[API] Erreur inconnue:', error.message, error.code)
        if (shouldShowToast) {
          throttledToast('network', '🔌 Problème de connexion. Réessayez.')
        }
      }
      
      // Mettre à jour le health check
      healthCheck.isOnline = false
      
      return Promise.reject(error)
    }

    // 🚨 GESTION ERREURS 401/403 - Token invalide ou expiré
    if (error.response?.status === 401 || error.response?.status === 403) {
      const errorMessage = error.response?.data?.message || ''
      
      // Vérifier si c'est une erreur de token
      const isTokenError = errorMessage.includes('Token') || 
                          errorMessage.includes('token') ||
                          errorMessage.includes('authentification') ||
                          errorMessage.includes('expiré')
      
      if (isTokenError) {
        // 🔒 Éviter les redirections multiples
        if (errorState.isRedirecting) {
          console.log('[API] Redirection déjà en cours, on ignore cette erreur 401')
          return Promise.reject(error)
        }
        
        // 🔒 Éviter les toasts en cascade pour les erreurs auth
        if (!errorState.authErrorShown) {
          errorState.authErrorShown = true
          
          // Toast unique et discret
          toast.dismiss('auth-error')
          toast.error('Session expirée. Veuillez vous reconnecter.', {
            id: 'auth-error',
            duration: 5000,
            icon: '🔒'
          })
        }
        
        // Marquer qu'on est en train de rediriger
        errorState.isRedirecting = true
        
        // Déconnecter proprement (store + localStorage + axios)
        console.warn('[API] 401/403 - Session invalide, déconnexion...')
        try { useAuthStore.getState().logout(true) } catch (e) {}
        localStorage.removeItem('auth-storage')
        delete axios.defaults.headers.common['Authorization']
        
        // Redirection vers login (une seule fois)
        if (window.location.pathname !== '/login') {
          // Utiliser setTimeout pour éviter les boucles
          setTimeout(() => {
            window.location.href = '/login'
          }, 100)
        }
        
        return Promise.reject(error)
      }
      
      // Autres erreurs 401/403 (pas liées au token)
      if (!errorState.authErrorShown) {
        errorState.authErrorShown = true
        throttledToast('auth', '🔒 ' + (errorMessage || 'Accès refusé'))
      }
      
      return Promise.reject(error)
    }
    
    return Promise.reject(error)
  }
)

export default api

// ═══════════════════════════════════════════════════════════════════
// HELPERS API — avec cache automatique pour les GET principaux
// ═══════════════════════════════════════════════════════════════════

// Helper: GET avec cache transparent
const cachedGet = async (url, params = undefined) => {
  const key = _cacheKey(url, params)
  const hit = _getCached(key)
  if (hit) return hit
  const result = await api.get(url, params !== undefined ? { params } : {})
  _setCached(key, result)
  return result
}

// Clients
export const fetchClients = (params) => cachedGet('/clients', params)
export const fetchClient = (id) => api.get(`/clients/${id}`)
export const createClient = (data) => {
  invalidateCacheFor('/clients')
  return api.post('/clients', data, { headers: { 'Content-Type': 'multipart/form-data' } })
}
export const updateClient = (id, data) => {
  invalidateCacheFor('/clients')
  return api.put(`/clients/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } })
}
export const deleteClient = (id) => {
  invalidateCacheFor('/clients')
  return api.delete(`/clients/${id}`)
}
export const generateClientPDF = (id) => api.get(`/clients/${id}/pdf`)

// Visites & Secrétariat
export const fetchVisites = (params) => cachedGet('/visites', params)
export const fetchRelances = () => cachedGet('/visites/relances/en-attente')
export const createVisite = (data) => { invalidateCacheFor('/visites'); return api.post('/visites', data) }
export const updateVisite = (id, data) => { invalidateCacheFor('/visites'); return api.put(`/visites/${id}`, data) }
export const deleteVisite = (id) => { invalidateCacheFor('/visites'); return api.delete(`/visites/${id}`) }
export const traiterRelance = (id) => { invalidateCacheFor('/visites'); return api.put(`/visites/${id}/relance/traiter`) }

// Alertes
export const fetchAlertes = (params) => cachedGet('/alertes', params)
export const fetchAlertesCount = () => api.get('/alertes/non-lues/count')
export const fetchAlertesDashboard = () => cachedGet('/alertes/dashboard/urgentes')
export const marquerAlerteLue = (id) => api.put(`/alertes/${id}/lue`)
export const traiterAlerte = (id) => api.put(`/alertes/${id}/traiter`)

// Module Recouvrement
export const fetchRecouvrementDashboard = () => cachedGet('/recouvrement/dashboard')
export const fetchClientsRetard = () => cachedGet('/recouvrement/clients-retard')
export const createEncaissementRapide = (data) => { invalidateCacheFor('/recouvrement'); return api.post('/recouvrement/encaissement-rapide', data) }
export const fetchStatistiquesMensuelles = () => cachedGet('/recouvrement/statistiques-mensuelles')
export const fetchDroitsTerre = () => cachedGet('/recouvrement/droits-terre')
export const exportRecouvrementExcel = (params) => api.get('/recouvrement/export-excel', { params, responseType: 'blob' })

// Commissions
export const fetchReferrers = (params) => cachedGet('/commissions/referrers', params)
export const fetchReferrer = (id) => api.get(`/commissions/referrers/${id}`)
export const createReferrer = (data) => { invalidateCacheFor('/commissions'); return api.post('/commissions/referrers', data) }
export const updateReferrer = (id, data) => { invalidateCacheFor('/commissions'); return api.put(`/commissions/referrers/${id}`, data) }
export const deleteReferrer = (id) => { invalidateCacheFor('/commissions'); return api.delete(`/commissions/referrers/${id}`) }
export const fetchClassement = () => cachedGet('/commissions/referrers/classement')
export const fetchCommissions = (params) => cachedGet('/commissions', params)
export const createCommission = (data) => { invalidateCacheFor('/commissions'); return api.post('/commissions', data) }
export const payerCommission = (id) => { invalidateCacheFor('/commissions'); return api.put(`/commissions/${id}/payer`) }
export const deleteCommission = (id) => { invalidateCacheFor('/commissions'); return api.delete(`/commissions/${id}`) }
export const generateReferrerPDF = (id) => api.get(`/commissions/referrers/${id}/pdf`)

// Leases (Baux)
export const fetchLeases = (params) => cachedGet('/leases', params)
export const fetchLease = (id) => api.get(`/leases/${id}`)
export const createLease = (data) => { invalidateCacheFor('/leases'); return api.post('/leases', data) }
export const updateLease = (id, data) => { invalidateCacheFor('/leases'); return api.put(`/leases/${id}`, data) }
export const updateLeaseStatut = (id, statut) => { invalidateCacheFor('/leases'); return api.put(`/leases/${id}/statut`, { statut }) }
export const deleteLease = (id) => { invalidateCacheFor('/leases'); return api.delete(`/leases/${id}`) }

// Payments
export const fetchPayments = (params) => cachedGet('/payments', params)
export const fetchPayment = (id) => api.get(`/payments/${id}`)
export const createPayment = (data) => { invalidateCacheFor('/payments', '/dashboard', '/clients'); return api.post('/payments', data) }
export const updatePayment = (id, data) => { invalidateCacheFor('/payments', '/dashboard', '/clients'); return api.put(`/payments/${id}`, data) }
export const deletePayment = (id) => { invalidateCacheFor('/payments', '/dashboard', '/clients'); return api.delete(`/payments/${id}`) }
export const fetchRegistreCaisse = (date) => api.get('/payments/registre/caisse', { params: { date } })
export const generateFacturePDF = (paymentId) => api.get(`/payments/${paymentId}/facture/pdf`)
export const generateRapportPaiementsPDF = () => api.get('/payments/rapport/pdf', { responseType: 'blob' })

export const fetchBiens = (params) => cachedGet('/biens', params)
export const fetchBien = (id) => api.get(`/biens/${id}`)
export const createBien = (data) => { invalidateCacheFor('/biens'); return api.post('/biens', data) }
export const updateBien = (id, data) => { invalidateCacheFor('/biens'); return api.put(`/biens/${id}`, data) }
export const deleteBien = (id) => { invalidateCacheFor('/biens'); return api.delete(`/biens/${id}`) }

// Buildings
export const fetchBuildings = (params) => cachedGet('/buildings', params)
export const fetchBuilding = (id) => api.get(`/buildings/${id}`)
export const createBuilding = (data) => { invalidateCacheFor('/buildings'); return api.post('/buildings', data) }
export const updateBuilding = (id, data) => { invalidateCacheFor('/buildings'); return api.put(`/buildings/${id}`, data) }
export const deleteBuilding = (id) => { invalidateCacheFor('/buildings'); return api.delete(`/buildings/${id}`) }
export const generateBuildingPDF = (id) => api.get(`/buildings/${id}/pdf`)

// Unités
export const fetchUnitesByBuilding = (buildingId) => cachedGet(`/buildings/${buildingId}/unites`)
export const createUnite = (buildingId, data) => {
  invalidateCacheFor(`/buildings/${buildingId}/unites`, '/buildings')
  return api.post(`/buildings/${buildingId}/unites`, data)
}
export const updateUnite = (buildingId, uniteId, data) => {
  invalidateCacheFor(`/buildings/${buildingId}/unites`, '/buildings')
  return api.put(`/buildings/${buildingId}/unites/${uniteId}`, data)
}
export const deleteUnite = (buildingId, uniteId) => {
  invalidateCacheFor(`/buildings/${buildingId}/unites`, '/buildings')
  return api.delete(`/buildings/${buildingId}/unites/${uniteId}`)
}
export const updateUniteStatut = (buildingId, uniteId, statut) => {
  invalidateCacheFor(`/buildings/${buildingId}/unites`, '/buildings')
  return api.put(`/buildings/${buildingId}/unites/${uniteId}/statut`, { statut })
}

// Dashboard
export const fetchDashboardKPI = () => cachedGet('/dashboard/kpi')
export const fetchDashboardStats = () => cachedGet('/dashboard/stats')
export const fetchRevenusCourbe = () => cachedGet('/dashboard/revenus-courbe')
export const fetchOccupationParType = () => cachedGet('/dashboard/occupation-par-type')
export const fetchRevenusParImmeuble = () => cachedGet('/dashboard/revenus-par-immeuble')
export const fetchRevenus = () => cachedGet('/dashboard/revenus')
export const fetchRetards = () => cachedGet('/dashboard/retards')
export const fetchActivites = () => cachedGet('/dashboard/activites')
export const fetchRapportMensuel = (params) => api.get('/dashboard/rapport-mensuel', { params })
export const fetchRapportAnnuel = (params) => api.get('/dashboard/rapport-annuel', { params })
export const fetchEtatCreances = () => api.get('/dashboard/etat-creances')

// Administration
export const fetchDemoStats = () => cachedGet('/admin/demo-stats')
export const resetDemoData = () => api.delete('/admin/reset-demo')
export const fetchUsers = () => cachedGet('/admin/users')
export const createUser = (data) => { invalidateCacheFor('/admin/users'); return api.post('/admin/users', data) }
export const updateUser = (id, data) => { invalidateCacheFor('/admin/users'); return api.put(`/admin/users/${id}`, data) }
export const deleteUser = (id) => { invalidateCacheFor('/admin/users'); return api.delete(`/admin/users/${id}`) }

// Export & Profil
export const exportExcel = (params) => api.get('/export/excel', { params, responseType: 'blob' })
export const fetchMyProfile = () => api.get('/auth/me')
export const changePassword = (data) => api.post('/auth/change-password', data)

// Caisse & Dépenses
export const fetchCaisseDashboard = (params) => cachedGet('/caisse/dashboard', params)
export const fetchCaisseAudit = (params) => cachedGet('/caisse/audit', params)
export const fetchCaisseBilanMensuel = () => cachedGet('/caisse/bilan-mensuel')
export const fetchCaisseCategories = () => cachedGet('/caisse/categories')
export const fetchDepenses = (params) => cachedGet('/caisse/depenses', params)
export const createDepense = (data) => { invalidateCacheFor('/caisse'); return api.post('/caisse/depenses', data) }
export const updateDepense = (id, data) => { invalidateCacheFor('/caisse'); return api.put(`/caisse/depenses/${id}`, data) }
export const deleteDepense = (id) => { invalidateCacheFor('/caisse'); return api.delete(`/caisse/depenses/${id}`) }

// ═══════════════════════════════════════════════════════════════════
// 🚀 PRÉCHARGEMENT — appelé au login pour réchauffer le cache
// Toutes les pages s'affichent INSTANTANÉMENT après
// ═══════════════════════════════════════════════════════════════════
export const prefetchAllData = async () => {
  console.log('[Cache] 🚀 Préchargement de toutes les données...')
  const calls = [
    cachedGet('/clients'),
    cachedGet('/buildings'),
    cachedGet('/payments'),
    cachedGet('/leases'),
    cachedGet('/visites'),
    cachedGet('/commissions'),
    cachedGet('/commissions/referrers'),
    cachedGet('/dashboard/kpi'),
    cachedGet('/dashboard/revenus-courbe'),
    cachedGet('/dashboard/occupation-par-type'),
    cachedGet('/dashboard/revenus-par-immeuble'),
    cachedGet('/recouvrement/dashboard'),
    cachedGet('/recouvrement/clients-retard'),
    cachedGet('/recouvrement/statistiques-mensuelles'),
    cachedGet('/recouvrement/droits-terre'),
    cachedGet('/biens'),
    cachedGet('/admin/users'),
    cachedGet('/caisse/dashboard'),
    cachedGet('/caisse/depenses'),
    cachedGet('/caisse/audit'),
    cachedGet('/caisse/bilan-mensuel'),
    cachedGet('/caisse/categories'),
    cachedGet('/alertes'),
  ]
  try {
    await Promise.allSettled(calls)
    console.log('[Cache] ✅ Données préchargées — navigation instantanée activée')
  } catch (e) {
    console.warn('[Cache] Préchargement partiel', e)
  }
}
