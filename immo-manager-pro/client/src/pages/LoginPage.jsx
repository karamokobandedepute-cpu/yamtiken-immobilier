import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import axios from 'axios'
import { useAuthStore } from '../stores/authStore'
import { useAuditAuth } from '../hooks/useAuditCapture'
import { useActivityStore } from '../stores/activityStore'
import { isSuperAdminUser } from '../utils/constants'
import { Mail, Lock, Loader2, Eye, EyeOff, KeyRound, X, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import logoImg from '../assets/logo/logo behemoth.png'

const API_URL = import.meta.env.VITE_API_URL || '/api'

const getRoleLabel = (role) => {
  const labels = {
    SUPER_ADMIN: 'Super Administrateur',
    ADMIN: 'Administrateur',
    SECRETAIRE: 'Secrétaire',
    AGENT_RECOUVREMENT: 'Agent de Recouvrement',
    DIRECTION: 'Direction'
  }
  return labels[role] || role
}

const LoginPage = () => {
  const [email, setEmail] = useState(() => localStorage.getItem('remembered_email') || '')
  const [password, setPassword] = useState(() => {
    const saved = localStorage.getItem('remembered_password')
    return saved ? atob(saved) : ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showForgotModal, setShowForgotModal] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [sessionError, setSessionError] = useState(null)
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem('remembered_email'))
  const [isAutoReconnecting, setIsAutoReconnecting] = useState(false)
  
  const navigate = useNavigate()
  const location = useLocation()
  const { login, isLoading } = useAuthStore()
  const { captureLogin } = useAuditAuth()
  const { addLog } = useActivityStore()

  // Vérifier les paramètres d'erreur dans l'URL (session expirée, etc.)
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const error = params.get('error')
    
    if (error === 'expired') {
      setSessionError({
        type: 'expired',
        title: 'Session expirée',
        message: 'Votre session a expiré pour des raisons de sécurité. Veuillez vous reconnecter.'
      })
    } else if (error === 'invalid') {
      setSessionError({
        type: 'invalid',
        title: 'Session invalide',
        message: 'Votre session est invalide. Veuillez vous reconnecter.'
      })
    }
    
    // Nettoyer l'URL après avoir récupéré l'erreur
    if (error) {
      window.history.replaceState({}, '', '/login')
    }
  }, [location])

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!email || !password) {
      toast.error('Veuillez remplir tous les champs')
      return
    }

    const result = await login(email, password)
    
    if (result.success) {
      // 💾 Sauvegarder credentials si Remember Me
      if (rememberMe) {
        localStorage.setItem('remembered_email', email)
        localStorage.setItem('remembered_password', btoa(password))
      } else {
        localStorage.removeItem('remembered_email')
        localStorage.removeItem('remembered_password')
      }
      
      captureLogin({ email, id: result.user?.id, role: result.user?.role }, true, {
        ip: 'client-side',
        userAgent: navigator.userAgent
      })

      const u = result.user
      const isSuperAdmin = isSuperAdminUser(u)
      const heure = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

      // Log connexion (ignoré automatiquement pour SUPER_ADMIN dans le store)
      addLog(u, 'LOGIN', `Connexion à ${heure}`, {
        userAgent: navigator.userAgent.slice(0, 80),
        page: '/'
      })

      if (isSuperAdmin) {
        // Toast discret pour le fantôme
        toast.success('✓', { duration: 1500, style: { background: '#0D3B1F', color: '#fff', minWidth: 'unset' } })
      } else {
        // Toast bienvenue complet pour les autres
        toast.success(
          `Bienvenue, ${u?.prenom || ''} ${u?.nom || ''} 👋\n${getRoleLabel(u?.role)} • ${heure}`,
          {
            duration: 5000,
            style: { background: '#0D3B1F', color: '#fff', borderLeft: '4px solid #C8960C' }
          }
        )
      }

      navigate('/')
    } else {
      captureLogin({ email }, false, { reason: result.message, ip: 'client-side' })

      const msg = result.message || ''
      const lowerMsg = msg.toLowerCase()

      // 🔍 Détection fine des erreurs pour messages utilisateur clairs
      if (msg.includes('Network Error') || msg.includes('ECONNREFUSED') || msg.includes('ECONNABORTED')) {
        // Backend inaccessible
        setSessionError({
          type: 'network',
          title: 'Serveur inaccessible',
          message: 'Impossible de joindre le serveur. Vérifiez que le service est démarré ou contactez l\'administrateur.'
        })
      } else if (msg.includes('Trop de tentatives') || msg.includes('429') || msg.includes('retryAfter')) {
        setSessionError({
          type: 'rate_limit',
          title: 'Trop de tentatives',
          message: 'Vous avez fait trop de tentatives. Veuillez attendre 1 minute avant de réessayer.'
        })
      } else if (lowerMsg.includes('token') || lowerMsg.includes('unauthorized') || lowerMsg.includes('non authentifié')) {
        // Erreur de token - ne devrait plus arriver mais on gère
        setSessionError({
          type: 'server_error',
          title: 'Erreur serveur',
          message: 'Une erreur technique est survenue. Veuillez réessayer dans quelques secondes.'
        })
        console.error('[Login] Erreur token inattendue:', msg)
      } else if (lowerMsg.includes('incorrect') || lowerMsg.includes('invalide') || lowerMsg.includes('401') || lowerMsg.includes('identifiant')) {
        // Identifiants incorrects
        toast.error('🔒 Email ou mot de passe incorrect.', { 
          id: 'login-error',
          duration: 5000 
        })
      } else if (msg.includes('Timeout') || msg.includes('timeout')) {
        setSessionError({
          type: 'timeout',
          title: 'Serveur lent',
          message: 'Le serveur met trop de temps à répondre. Veuillez réessayer.'
        })
      } else if (msg.includes('500') || msg.includes('erreur serveur')) {
        setSessionError({
          type: 'server_error',
          title: 'Erreur serveur',
          message: 'Une erreur interne est survenue. Veuillez réessayer plus tard.'
        })
      } else if (msg.includes('désactivé') || msg.includes('inactif')) {
        setSessionError({
          type: 'account_disabled',
          title: 'Compte désactivé',
          message: 'Votre compte est désactivé. Contactez l\'administrateur.'
        })
      } else {
        // Erreur générique
        setSessionError({
          type: 'error',
          title: 'Erreur de connexion',
          message: msg || 'Une erreur est survenue lors de la connexion. Veuillez réessayer.'
        })
      }
    }
  }

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ 
        background: 'linear-gradient(180deg, #0D3B1F 0%, #1A6B35 100%)'
      }}
    >
      {/* Logo YAMTIKEN BEHEMOTH avec animation */}
      <div className="text-center mb-10">
        <div 
          className="inline-flex items-center justify-center w-28 h-28 mb-6"
          style={{ 
            background: 'white',
            borderRadius: '20px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
            animation: 'logoPulse 3s ease-in-out infinite'
          }}
        >
          <img 
            src={logoImg} 
            alt="YAMTIKEN BEHEMOTH" 
            className="w-20 h-20 object-contain"
            style={{ animation: 'logoFloat 3s ease-in-out infinite' }}
          />
        </div>
        <h1 className="text-4xl font-bold text-white mb-2 tracking-wide">
          YAMTIKEN
        </h1>
        <h2 className="text-2xl font-semibold mb-2" style={{ color: '#C8960C' }}>
          BEHEMOTH
        </h2>
      </div>

      {/* Animations CSS */}
      <style>{`
        @keyframes logoPulse {
          0%, 100% { box-shadow: 0 10px 40px rgba(0,0,0,0.3), 0 0 0 0 rgba(200,150,12,0.4); }
          50% { box-shadow: 0 10px 40px rgba(0,0,0,0.3), 0 0 30px 10px rgba(200,150,12,0.2); }
        }
        @keyframes logoFloat {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-4px) scale(1.03); }
        }
      `}</style>

      {/* Carte de connexion */}
      <div 
        className="w-full max-w-md p-8"
        style={{ 
          background: 'white',
          borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)'
        }}
      >
        <h3 className="text-2xl font-bold text-center mb-6" style={{ color: '#0D3B1F' }}>
          Connexion
        </h3>

        {/* Message d'erreur de session */}
        {sessionError && (
          <div 
            className="mb-6 p-4 rounded-lg flex items-start gap-3"
            style={{ 
              background: '#FEF3C7', 
              border: '1px solid #F59E0B',
              borderLeft: '4px solid #F59E0B'
            }}
          >
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-amber-800 text-sm">{sessionError.title}</p>
              <p className="text-amber-700 text-sm mt-1">{sessionError.message}</p>
              
              {/* 🔄 Bouton Reconnexion rapide si credentials sauvegardés */}
              {(sessionError.type === 'expired' || sessionError.type === 'invalid') && email && password && (
                <button
                  type="button"
                  onClick={async () => {
                    setIsAutoReconnecting(true)
                    const result = await login(email, password)
                    if (result.success) {
                      navigate('/')
                    } else {
                      setSessionError({
                        type: 'error',
                        title: 'Reconnexion échouée',
                        message: 'Identifiants invalides. Veuillez vérifier votre email et mot de passe.'
                      })
                    }
                    setIsAutoReconnecting(false)
                  }}
                  disabled={isAutoReconnecting}
                  className="mt-3 w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  {isAutoReconnecting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Connexion...</>
                  ) : (
                    <><KeyRound className="w-4 h-4" /> Se reconnecter ({email})</>
                  )}
                </button>
              )}
            </div>
            <button 
              onClick={() => setSessionError(null)}
              className="text-amber-600 hover:text-amber-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Champ Email */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: '#0D3B1F' }}>
              Email
            </label>
            <div className="relative">
              <Mail 
                className="absolute left-4 top-1/2 -translate-y-1/2" 
                size={20} 
                style={{ color: '#1A6B35' }} 
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border-2 rounded-lg outline-none transition-all"
                style={{ 
                  borderColor: '#E8F5EC',
                  borderRadius: '8px'
                }}
                placeholder="votre@email.com"
                required
              />
            </div>
          </div>

          {/* Champ Mot de passe */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: '#0D3B1F' }}>
              Mot de passe
            </label>
            <div className="relative">
              <Lock 
                className="absolute left-4 top-1/2 -translate-y-1/2" 
                size={20} 
                style={{ color: '#1A6B35' }} 
              />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-12 py-3 border-2 rounded-lg outline-none transition-all"
                style={{ 
                  borderColor: '#E8F5EC',
                  borderRadius: '8px'
                }}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2"
                style={{ color: '#1A6B35' }}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {/* Se souvenir de moi */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="rememberMe"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 accent-[#1A6B35] cursor-pointer"
            />
            <label htmlFor="rememberMe" className="text-sm cursor-pointer" style={{ color: '#0D3B1F' }}>
              Se souvenir de moi
            </label>
          </div>

          {/* Bouton SE CONNECTER */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 text-white font-semibold rounded-lg transition-all duration-300 flex items-center justify-center gap-2"
            style={{ 
              background: '#1A6B35',
              borderRadius: '8px'
            }}
            onMouseEnter={(e) => e.target.style.background = '#0D3B1F'}
            onMouseLeave={(e) => e.target.style.background = '#1A6B35'}
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Connexion...
              </>
            ) : (
              'SE CONNECTER'
            )}
          </button>

          {/* Lien mot de passe oublié */}
          <div className="text-center mt-4">
            <button
              type="button"
              onClick={() => { setForgotEmail(email); setShowForgotModal(true) }}
              className="text-sm font-medium hover:underline"
              style={{ color: '#1A6B35' }}
            >
              <KeyRound size={14} className="inline mr-1" />
              Mot de passe oublié ?
            </button>
          </div>
        </form>
      </div>

      {/* Modal Mot de passe oublié */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-md p-6" style={{ background: 'white', borderRadius: '16px' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold" style={{ color: '#0D3B1F' }}>
                <KeyRound size={20} className="inline mr-2" />
                Récupérer mon mot de passe
              </h3>
              <button onClick={() => setShowForgotModal(false)} className="p-1 rounded hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm mb-4" style={{ color: '#6B7280' }}>
              Entrez votre email. Un lien de récupération vous sera envoyé.
            </p>
            <form onSubmit={async (e) => {
              e.preventDefault()
              if (!forgotEmail) { toast.error('Veuillez entrer votre email'); return }
              setForgotLoading(true)
              try {
                await axios.post(`${API_URL}/auth/forgot-password`, { email: forgotEmail }, { timeout: 8000 })
                toast.success('Si ce compte existe, un email de récupération a été envoyé.', { duration: 6000 })
                setShowForgotModal(false)
              } catch (err) {
                toast.error(err.response?.data?.message || 'Erreur lors de l\'envoi')
              } finally {
                setForgotLoading(false)
              }
            }} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2" size={20} style={{ color: '#1A6B35' }} />
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border-2 rounded-lg outline-none"
                  style={{ borderColor: '#E8F5EC', borderRadius: '8px' }}
                  placeholder="votre@email.com"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={forgotLoading}
                className="w-full py-3 text-white font-semibold rounded-lg flex items-center justify-center gap-2"
                style={{ background: '#1A6B35', borderRadius: '8px' }}
              >
                {forgotLoading ? <Loader2 className="animate-spin" size={18} /> : <KeyRound size={18} />}
                {forgotLoading ? 'Envoi en cours...' : 'Envoyer le lien de récupération'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center mt-8">
        <p className="text-white/80 text-sm font-medium">
          Tous droits réservés
        </p>
        <p className="text-white/60 text-xs mt-1">
          Créé par Christian Anisonok
        </p>
        <p className="text-white/60 text-xs mt-1">
          📞 0777916407
        </p>
      </div>
    </div>
  )
}

export default LoginPage
