import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import axios from 'axios'
import { resetAuthErrorState } from '../utils/api'

// URL API : dev → proxy Vite /api ; prod → VITE_API_URL ou VPS fixe
const API_URL = import.meta.env.PROD
  ? (import.meta.env.VITE_API_URL || 'http://localhost:5000/api')
  : '/api'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null })
        try {
          const response = await axios.post(`${API_URL}/auth/login`, {
            email,
            password
          })

          const { token, refreshToken, user } = response.data

          // Configurer le header par défaut pour axios
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
          
          // 🔓 Réinitialiser l'état d'erreur auth pour permettre les futures détections
          resetAuthErrorState()

          set({
            user,
            token,
            refreshToken,
            isAuthenticated: true,
            isLoading: false
          })

          return { success: true, user }
        } catch (error) {
          const message = error.response?.data?.message
            || (error.code === 'ECONNABORTED' ? 'Timeout — serveur trop lent' : null)
            || (error.message?.includes('Network Error') ? 'Network Error' : null)
            || error.message
            || 'Erreur de connexion'
          set({ error: message, isLoading: false })
          return { success: false, message }
        }
      },

      logout: (keepCredentials = true) => {
        const currentUser = get().user
        
        // Log l'action de logout avant de nettoyer
        if (currentUser) {
          const logoutApiUrl = import.meta.env.VITE_API_URL || '/api'
          fetch(`${logoutApiUrl}/audit/log`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${get().token}`
            },
            body: JSON.stringify({
              action: 'LOGOUT',
              severity: 'INFO',
              userId: currentUser.id,
              userEmail: currentUser.email,
              userRole: currentUser.role,
              timestamp: new Date().toISOString(),
              payload: { reason: 'user_initiated' }
            })
          }).catch(() => {}) // Silencieux
        }
        
        delete axios.defaults.headers.common['Authorization']
        
        // Garder les credentials pour auto-reconnect si demandé
        if (!keepCredentials) {
          localStorage.removeItem('remembered_email')
          localStorage.removeItem('remembered_password')
        }
        
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
          error: null
        })
      },

      // Sauvegarder les credentials pour auto-reconnect
      saveCredentials: (email, password) => {
        localStorage.setItem('remembered_email', email)
        if (password) {
          // Note: En production, utiliser un chiffrement côté client
          localStorage.setItem('remembered_password', btoa(password))
        }
      },

      // Récupérer les credentials sauvegardés
      getSavedCredentials: () => {
        const email = localStorage.getItem('remembered_email') || ''
        const passwordEncoded = localStorage.getItem('remembered_password')
        const password = passwordEncoded ? atob(passwordEncoded) : ''
        return { email, password, hasCredentials: !!(email && password) }
      },

      // Auto-reconnect avec credentials sauvegardés
      autoReconnect: async () => {
        const { email, password, hasCredentials } = get().getSavedCredentials()
        
        if (!hasCredentials) {
          return { success: false, message: 'Pas de credentials sauvegardés' }
        }
        
        console.log('[AuthStore] Tentative auto-reconnect...')
        return await get().login(email, password)
      },

      updateUser: (userData) => {
        set({ user: { ...get().user, ...userData } })
      },

      hasRole: (roles) => {
        const { user } = get()
        if (!user) return false
        if (Array.isArray(roles)) {
          return roles.includes(user.role)
        }
        return user.role === roles
      },

      isAdmin: () => ['SUPER_ADMIN', 'ADMIN'].includes(get().user?.role),
      isSecretaire: () => ['SUPER_ADMIN', 'ADMIN', 'SECRETAIRE'].includes(get().user?.role),
      isRecouvrement: () => ['SUPER_ADMIN', 'ADMIN', 'AGENT_RECOUVREMENT'].includes(get().user?.role),
      isDirection: () => ['SUPER_ADMIN', 'ADMIN', 'DIRECTION'].includes(get().user?.role),
      isSuperAdmin: () => get().user?.role === 'SUPER_ADMIN',
      canReadOnly: () => get().user?.role === 'DIRECTION',

      // Renouveler le token d'accès via le refresh token
      refreshAuth: async () => {
        const { refreshToken } = get()
        if (!refreshToken) return false
        try {
          const response = await axios.post(`${API_URL}/auth/refresh`, { refreshToken })
          const { token: newToken, refreshToken: newRefreshToken } = response.data
          axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`
          set({ token: newToken, refreshToken: newRefreshToken })
          return true
        } catch {
          // Refresh échoué - ne pas déconnecter immédiatement, retourner false
          return false
        }
      },

      // Valider le token contre le backend (détecte token d'un autre environnement)
      validateTokenOnline: async () => {
        const { token } = get()
        if (!token) return false
        try {
          await axios.get(`${API_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 5000
          })
          return true
        } catch (error) {
          if (error.response?.status === 401 || error.response?.status === 403) {
            get().logout(true)
            return false
          }
          return true
        }
      },

      // Vérifier et rafraîchir le token si nécessaire (appelé périodiquement)
      checkAndRefreshToken: async () => {
        const { token, refreshToken } = get()
        if (!token || !refreshToken) return false

        try {
          // Décoder le token pour vérifier l'expiration
          const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
          const payload = JSON.parse(atob(b64))
          const expTimestamp = payload.exp * 1000
          const now = Date.now()
          const timeUntilExp = expTimestamp - now

          // Si le token expire dans moins de 1 heure, le rafraîchir
          if (timeUntilExp < 60 * 60 * 1000) {
            console.log('[Auth] Token expirant bientôt, rafraîchissement...')
            return await get().refreshAuth()
          }
          return true
        } catch {
          return false
        }
      }
    }),
    {
      name: 'auth-storage',
      onRehydrateStorage: () => (state) => {
        // Nettoyer l'ancien storage corrompu (anciens tokens avec URL absolue)
        try {
          const raw = localStorage.getItem('auth-storage')
          if (raw) {
            const parsed = JSON.parse(raw)
            // Si le token contient une URL absolue ou est malformé, tout nettoyer
            if (parsed?.state?.token && typeof parsed.state.token === 'string') {
              const b64 = parsed.state.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
              const payload = JSON.parse(atob(b64))
              const isExpired = payload.exp * 1000 < Date.now()
              if (isExpired || !parsed.state.user?.role) {
                // Nettoyer complètement
                localStorage.removeItem('auth-storage')
                delete axios.defaults.headers.common['Authorization']
                return
              }
              // Token valide - restaurer
              axios.defaults.headers.common['Authorization'] = `Bearer ${parsed.state.token}`
            }
          }
        } catch (e) {
          // Storage corrompu - tout nettoyer
          localStorage.removeItem('auth-storage')
        }
      }
    }
  )
)
