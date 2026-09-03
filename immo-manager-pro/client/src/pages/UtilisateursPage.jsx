import { useEffect, useState } from 'react'
import { Plus, Search, Edit2, Trash2, UserCircle, Power, Eye, EyeOff } from 'lucide-react'
import { fetchUsers, createUser, updateUser, deleteUser } from '../utils/api'
import { getRoleLabel, getRoleBadgeColor } from '../utils/formatters'
import toast from 'react-hot-toast'
import ConfirmDialog from '../components/ConfirmDialog'

const UtilisateursPage = () => {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', type: 'warning', onConfirm: null, cause: '' })

  useEffect(() => {
    loadUsers()
  }, [searchTerm])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const response = await fetchUsers()
      setUsers(response.data)
    } catch (error) {
      toast.error(error.response?.data?.message || 'Erreur lors du chargement des utilisateurs')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleStatus = (id, currentStatus, userName) => {
    const action = currentStatus ? 'désactiver' : 'activer'
    setConfirmDialog({
      open: true,
      title: `${currentStatus ? 'Désactiver' : 'Activer'} l'utilisateur`,
      message: `Voulez-vous ${action} le compte de ${userName} ?`,
      type: currentStatus ? 'warning' : 'success',
      cause: currentStatus ? 'L\'utilisateur ne pourra plus se connecter' : 'L\'utilisateur pourra à nouveau se connecter',
      onConfirm: async () => {
        try {
          await updateUser(id, { actif: !currentStatus })
          toast.success(`Utilisateur ${currentStatus ? 'désactivé' : 'activé'} avec succès`)
          loadUsers()
        } catch (error) {
          toast.error(error.response?.data?.message || 'Erreur lors du changement de statut')
        }
        setConfirmDialog({ open: false, title: '', message: '', type: 'warning', onConfirm: null, cause: '' })
      }
    })
  }

  const handleDelete = (id, userName) => {
    setConfirmDialog({
      open: true,
      title: 'Supprimer l\'utilisateur',
      message: `Voulez-vous supprimer le compte de ${userName} ?`,
      type: 'danger',
      cause: 'Cette action est irréversible. Toutes les données seront perdues.',
      onConfirm: async () => {
        try {
          await deleteUser(id)
          toast.success('Utilisateur supprimé avec succès')
          loadUsers()
        } catch (error) {
          toast.error(error.response?.data?.message || 'Erreur lors de la suppression')
        }
        setConfirmDialog({ open: false, title: '', message: '', type: 'warning', onConfirm: null, cause: '' })
      }
    })
  }

  const openModal = (user = null) => {
    setSelectedUser(user)
    setShowModal(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Utilisateurs</h1>
          <p className="text-gray-500">Gestion des comptes utilisateurs</p>
        </div>
        <button
          onClick={() => openModal()}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={18} />
          Nouvel utilisateur
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Rechercher un utilisateur..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-midGreen border-t-transparent"></div>
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <UserCircle size={48} className="mb-4" />
            <p>Aucun utilisateur trouvé</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Utilisateur</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Email</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Rôle</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Statut</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Dernière connexion</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-midGreen/10 flex items-center justify-center">
                          <span className="text-midGreen font-medium">
                            {user.prenom[0]}{user.nom[0]}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">
                            {user.prenom} {user.nom}
                          </p>
                          <p className="text-sm text-gray-500">{user.telephone || '-'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{user.email}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${getRoleBadgeColor(user.role)}`}>
                        {getRoleLabel(user.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        user.actif 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {user.actif ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {user.dernierConnexion 
                        ? new Date(user.dernierConnexion).toLocaleDateString('fr-FR')
                        : 'Jamais'
                      }
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleToggleStatus(user.id, user.actif, user.prenom + ' ' + user.nom)}
                          className={`p-2 rounded-lg ${
                            user.actif 
                              ? 'text-orange-600 hover:bg-orange-50' 
                              : 'text-green-600 hover:bg-green-50'
                          }`}
                          title={user.actif ? 'Désactiver' : 'Activer'}
                        >
                          <Power size={16} />
                        </button>
                        <button
                          onClick={() => openModal(user)}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(user.id, user.prenom + ' ' + user.nom)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 size={16} />
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

      {/* Modal */}
      {showModal && (
        <UserModal 
          user={selectedUser} 
          onClose={() => {
            setShowModal(false)
            loadUsers()
          }} 
        />
      )}

      {/* Dialog de confirmation */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type={confirmDialog.type}
        cause={confirmDialog.cause}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ open: false, title: '', message: '', type: 'warning', onConfirm: null, cause: '' })}
      />
    </div>
  )
}

// User Modal
const UserModal = ({ user, onClose }) => {
  const [formData, setFormData] = useState({
    nom: user?.nom || '',
    prenom: user?.prenom || '',
    email: user?.email || '',
    telephone: user?.telephone || '',
    role: user?.role || 'SECRETAIRE',
    password: '',
    actif: user?.actif ?? true
  })
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (user) {
        const data = { ...formData }
        if (!data.password) delete data.password
        await updateUser(user.id, data)
        toast.success('Utilisateur modifié avec succès')
      } else {
        if (!formData.password) {
          toast.error('Le mot de passe est requis')
          return
        }
        await createUser(formData)
        toast.success('Utilisateur créé avec succès')
      }
      onClose()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Erreur lors de l\'enregistrement')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          {user ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Nom *</label>
              <input
                type="text"
                value={formData.nom}
                onChange={(e) => setFormData({...formData, nom: e.target.value})}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="label">Prénom *</label>
              <input
                type="text"
                value={formData.prenom}
                onChange={(e) => setFormData({...formData, prenom: e.target.value})}
                className="input-field"
                required
              />
            </div>
          </div>
          <div>
            <label className="label">Email *</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="input-field"
              required
            />
          </div>
          <div>
            <label className="label">Téléphone</label>
            <input
              type="tel"
              value={formData.telephone}
              onChange={(e) => setFormData({...formData, telephone: e.target.value})}
              className="input-field"
            />
          </div>
          <div>
            <label className="label">Rôle *</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({...formData, role: e.target.value})}
              className="input-field"
            >
              <option value="SUPER_ADMIN">Super Admin</option>
              <option value="ADMIN">Administrateur</option>
              <option value="SECRETAIRE">Secrétaire</option>
              <option value="AGENT_RECOUVREMENT">Agent Recouvrement</option>
              <option value="DIRECTION">Direction</option>
            </select>
          </div>
          <div>
            <label className="label">Mot de passe {user ? '(laisser vide pour ne pas changer)' : '*'}</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                className="input-field pr-10"
                placeholder={user ? '••••••••' : 'Mot de passe'}
                required={!user}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: '#1A6B35' }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 btn-secondary"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 btn-primary"
            >
              {user ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default UtilisateursPage
