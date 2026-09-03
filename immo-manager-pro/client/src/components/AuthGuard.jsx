import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { Loader2 } from 'lucide-react'
import axios from 'axios'

/**
 * AuthGuard - Protection des routes avec gestion propre des erreurs auth
 * 
 * Ce composant :
 * 1. Vérifie si l'utilisateur est authentifié
 * 2. Redirige vers /login si nécessaire (une seule fois)
 * 3. Affiche un loader pendant la vérification
 * 4. Nettoie les erreurs auth au montage
 */
export function AuthGuard({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, token, user } = useAuthStore()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    // Vérification de l'authentification
    const checkAuth = () => {
      // Si pas de token ou pas authentifié
      if (!token || !isAuthenticated || !user) {
        console.log('[AuthGuard] Non authentifié, redirection vers login...')
        
        // Nettoyer le storage corrompu
        localStorage.removeItem('auth-storage')
        delete axios?.defaults?.headers?.common?.['Authorization']
        
        // Rediriger vers login avec l'URL de retour
        const returnUrl = encodeURIComponent(location.pathname + location.search)
        navigate(`/login?redirect=${returnUrl}`, { replace: true })
        return false
      }
      
      // Vérifier si le token est valide (format JWT)
      try {
        const parts = token.split('.')
        if (parts.length !== 3) {
          throw new Error('Token invalide')
        }
        
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
        
        // Vérifier expiration
        if (payload.exp && payload.exp * 1000 < Date.now()) {
          console.log('[AuthGuard] Token expiré, redirection...')
          localStorage.removeItem('auth-storage')
          navigate('/login?error=expired', { replace: true })
          return false
        }
        
        return true
      } catch (e) {
        console.log('[AuthGuard] Token malformé, redirection...')
        localStorage.removeItem('auth-storage')
        navigate('/login?error=invalid', { replace: true })
        return false
      }
    }

    const isValid = checkAuth()
    setIsChecking(false)
  }, [isAuthenticated, token, user, navigate, location])

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#1A6B35]" />
          <p className="text-sm text-gray-600">Vérification de la session...</p>
        </div>
      </div>
    )
  }

  // Si on arrive ici, l'utilisateur est authentifié
  return children
}

/**
 * PublicRoute - Pour les pages accessibles sans auth (login, reset-password)
 * Redirige vers l'accueil si déjà authentifié
 */
export function PublicRoute({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, token } = useAuthStore()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    // Si authentifié et sur une page publique, rediriger vers l'accueil
    // sauf si un paramètre redirect est présent
    if (isAuthenticated && token) {
      const params = new URLSearchParams(location.search)
      const redirectUrl = params.get('redirect')
      
      if (redirectUrl) {
        navigate(decodeURIComponent(redirectUrl), { replace: true })
      } else {
        navigate('/', { replace: true })
      }
    }
    
    setIsChecking(false)
  }, [isAuthenticated, token, navigate, location])

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#1A6B35]" />
          <p className="text-sm text-gray-600">Chargement...</p>
        </div>
      </div>
    )
  }

  return children
}

export default AuthGuard
