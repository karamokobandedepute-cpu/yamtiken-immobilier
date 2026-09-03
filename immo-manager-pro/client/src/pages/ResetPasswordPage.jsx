import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { Lock, Loader2, Eye, EyeOff, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import logoImg from '../assets/logo/logo behemoth.png'

const API_URL = import.meta.env.VITE_API_URL || '/api'

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()

  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm]         = useState('')
  const [showPwd, setShowPwd]         = useState(false)
  const [loading, setLoading]         = useState(false)
  const [done, setDone]               = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (newPassword !== confirm) {
      toast.error('Les mots de passe ne correspondent pas')
      return
    }
    if (newPassword.length < 8) {
      toast.error('Minimum 8 caractères')
      return
    }
    setLoading(true)
    try {
      await axios.post(`${API_URL}/auth/reset-password`, { token, newPassword })
      setDone(true)
      toast.success('Mot de passe réinitialisé avec succès !', { duration: 4000 })
      setTimeout(() => navigate('/login'), 3000)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lien invalide ou expiré')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ background: 'linear-gradient(180deg, #0D3B1F 0%, #1A6B35 100%)' }}
    >
      <div className="text-center mb-8">
        <div
          className="inline-flex items-center justify-center w-24 h-24 mb-4"
          style={{ background: 'white', borderRadius: '20px', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}
        >
          <img src={logoImg} alt="YAMTIKEN" className="w-16 h-16 object-contain" />
        </div>
        <h1 className="text-3xl font-bold text-white">YAMTIKEN</h1>
        <p className="font-semibold" style={{ color: '#C8960C' }}>BEHEMOTH</p>
      </div>

      <div className="w-full max-w-md p-8" style={{ background: 'white', borderRadius: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
        {done ? (
          <div className="text-center py-6">
            <CheckCircle size={56} className="mx-auto mb-4" style={{ color: '#1A6B35' }} />
            <h2 className="text-xl font-bold mb-2" style={{ color: '#0D3B1F' }}>Mot de passe réinitialisé !</h2>
            <p className="text-gray-500 text-sm">Redirection vers la connexion...</p>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-center mb-6" style={{ color: '#0D3B1F' }}>
              Nouveau mot de passe
            </h2>
            {!token && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-center text-red-600 text-sm">
                Lien invalide. Veuillez refaire une demande de récupération.
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#0D3B1F' }}>
                  Nouveau mot de passe
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2" size={20} style={{ color: '#1A6B35' }} />
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-3 border-2 rounded-lg outline-none"
                    style={{ borderColor: '#E8F5EC', borderRadius: '8px' }}
                    placeholder="Minimum 8 caractères, 1 majuscule, 1 chiffre, 1 symbole"
                    required
                    disabled={!token}
                  />
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-4 top-1/2 -translate-y-1/2" style={{ color: '#1A6B35' }}>
                    {showPwd ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#0D3B1F' }}>
                  Confirmer le mot de passe
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2" size={20} style={{ color: '#1A6B35' }} />
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 border-2 rounded-lg outline-none"
                    style={{ borderColor: confirm && confirm !== newPassword ? '#EF4444' : '#E8F5EC', borderRadius: '8px' }}
                    placeholder="Répétez le mot de passe"
                    required
                    disabled={!token}
                  />
                </div>
                {confirm && confirm !== newPassword && (
                  <p className="text-red-500 text-xs mt-1">Les mots de passe ne correspondent pas</p>
                )}
              </div>
              <button
                type="submit"
                disabled={loading || !token}
                className="w-full py-4 text-white font-semibold rounded-lg flex items-center justify-center gap-2"
                style={{ background: loading || !token ? '#9CA3AF' : '#1A6B35', borderRadius: '8px' }}
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <Lock size={20} />}
                {loading ? 'Réinitialisation...' : 'Enregistrer le nouveau mot de passe'}
              </button>
              <button type="button" onClick={() => navigate('/login')}
                className="w-full text-sm text-center hover:underline" style={{ color: '#1A6B35' }}>
                ← Retour à la connexion
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

export default ResetPasswordPage
