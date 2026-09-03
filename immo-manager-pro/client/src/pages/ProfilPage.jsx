import { useState } from 'react'
import { User, Lock, Eye, EyeOff, Save, ShieldCheck } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { changePassword } from '../utils/api'
import { getRoleLabel } from '../utils/formatters'
import toast from 'react-hot-toast'

const ProfilPage = () => {
  const { user, updateUser } = useAuthStore()

  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew]         = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading]         = useState(false)

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (form.newPassword !== form.confirmPassword) {
      toast.error('Les deux nouveaux mots de passe ne correspondent pas.')
      return
    }
    if (form.newPassword.length < 8) {
      toast.error('Le nouveau mot de passe doit contenir au moins 8 caractères.')
      return
    }

    setLoading(true)
    try {
      await changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword
      })
      toast.success('Mot de passe modifié avec succès !')
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Erreur lors du changement de mot de passe.')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = "w-full px-4 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 transition-all"
  const inputStyle = { borderColor: '#D1D5DB', background: '#FAFAFA', color: '#111827' }

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Carte identité */}
      <div className="rounded-2xl overflow-hidden shadow-sm border" style={{ borderColor: '#E5E7EB' }}>
        <div className="h-2" style={{ background: 'linear-gradient(90deg, #0D3B1F, #1A6B35)' }} />
        <div className="p-6 flex items-center gap-5" style={{ background: 'white' }}>
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white flex-shrink-0"
            style={{ background: '#1A6B35' }}
          >
            {user?.prenom?.[0]}{user?.nom?.[0]}
          </div>
          <div>
            <h2 className="text-xl font-bold" style={{ color: '#0D3B1F' }}>
              {user?.prenom} {user?.nom}
            </h2>
            <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>{user?.email}</p>
            <span
              className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold"
              style={{ background: '#E8F5EC', color: '#1A6B35' }}
            >
              {getRoleLabel(user?.role)}
            </span>
          </div>
        </div>
      </div>

      {/* Infos compte */}
      <div className="rounded-2xl shadow-sm border p-6 space-y-3" style={{ background: 'white', borderColor: '#E5E7EB' }}>
        <h3 className="font-semibold flex items-center gap-2" style={{ color: '#0D3B1F' }}>
          <User size={18} /> Informations du compte
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {[
            { label: 'Prénom', value: user?.prenom },
            { label: 'Nom', value: user?.nom },
            { label: 'Email', value: user?.email },
            { label: 'Rôle', value: getRoleLabel(user?.role) }
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs font-medium mb-0.5" style={{ color: '#9CA3AF' }}>{label}</p>
              <p className="font-medium" style={{ color: '#111827' }}>{value || '—'}</p>
            </div>
          ))}
        </div>
        <p className="text-xs mt-2" style={{ color: '#9CA3AF' }}>
          Pour modifier vos informations, contactez un administrateur.
        </p>
      </div>

      {/* Changer mot de passe */}
      <div className="rounded-2xl shadow-sm border p-6" style={{ background: 'white', borderColor: '#E5E7EB' }}>
        <h3 className="font-semibold flex items-center gap-2 mb-5" style={{ color: '#0D3B1F' }}>
          <Lock size={18} /> Changer le mot de passe
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Mot de passe actuel */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>
              Mot de passe actuel
            </label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                name="currentPassword"
                value={form.currentPassword}
                onChange={handleChange}
                required
                className={inputClass}
                style={inputStyle}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: '#9CA3AF' }}
              >
                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Nouveau mot de passe */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>
              Nouveau mot de passe
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                name="newPassword"
                value={form.newPassword}
                onChange={handleChange}
                required
                minLength={8}
                className={inputClass}
                style={inputStyle}
                placeholder="Min. 8 caractères"
              />
              <button
                type="button"
                onClick={() => setShowNew(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: '#9CA3AF' }}
              >
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Confirmer */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>
              Confirmer le nouveau mot de passe
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={handleChange}
                required
                minLength={8}
                className={inputClass}
                style={inputStyle}
                placeholder="Répétez le mot de passe"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: '#9CA3AF' }}
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Indicateur de correspondance */}
          {form.newPassword && form.confirmPassword && (
            <div className="flex items-center gap-2 text-xs">
              <ShieldCheck size={14} style={{ color: form.newPassword === form.confirmPassword ? '#1A6B35' : '#DC2626' }} />
              <span style={{ color: form.newPassword === form.confirmPassword ? '#1A6B35' : '#DC2626' }}>
                {form.newPassword === form.confirmPassword ? 'Les mots de passe correspondent' : 'Les mots de passe ne correspondent pas'}
              </span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium text-sm text-white transition-all disabled:opacity-60"
            style={{ background: '#1A6B35' }}
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save size={16} />
            )}
            {loading ? 'Enregistrement...' : 'Mettre à jour le mot de passe'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default ProfilPage
