import { useState } from 'react'
import { Database, Trash2, AlertTriangle, CheckCircle, Loader } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../utils/api'

const DemoDataManager = () => {
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [action, setAction] = useState(null) // 'seed' ou 'clear'

  const handleSeedData = async () => {
    setLoading(true)
    try {
      const response = await api.post('/demo/seed')
      toast.success(response.data.message || 'Données de démonstration créées avec succès!')
      setShowConfirm(false)
      // Rafraîchir la page après 2 secondes
      setTimeout(() => window.location.reload(), 2000)
    } catch (error) {
      console.error('Erreur seed:', error)
      const message = error.response?.data?.message || error.message || 'Erreur lors de la création des données'
      if (error.response?.status === 403) {
        toast.error('⚠️ Accès refusé : Vous devez être Super Admin')
      } else if (error.response?.status === 401) {
        toast.error('⚠️ Non authentifié : Veuillez vous reconnecter')
      } else {
        toast.error(message)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleClearData = async () => {
    setLoading(true)
    try {
      const response = await api.delete('/demo/clear')
      toast.success(response.data.message || 'Données de démonstration supprimées avec succès!')
      setShowConfirm(false)
      // Rafraîchir la page après 2 secondes
      setTimeout(() => window.location.reload(), 2000)
    } catch (error) {
      console.error('Erreur clear:', error)
      const message = error.response?.data?.message || error.message || 'Erreur lors de la suppression des données'
      if (error.response?.status === 403) {
        toast.error('⚠️ Accès refusé : Vous devez être Super Admin')
      } else if (error.response?.status === 401) {
        toast.error('⚠️ Non authentifié : Veuillez vous reconnecter')
      } else {
        toast.error(message)
      }
    } finally {
      setLoading(false)
    }
  }

  const openConfirm = (actionType) => {
    setAction(actionType)
    setShowConfirm(true)
  }

  return (
    <>
      {/* Boutons de gestion */}
      <div className="flex gap-2">
        <button
          onClick={() => openConfirm('seed')}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          style={{ background: '#1A6B35', color: 'white' }}
          title="Remplir avec des données de démonstration"
        >
          <Database size={18} />
          Données Démo
        </button>
        
        <button
          onClick={() => openConfirm('clear')}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          style={{ background: '#DC2626', color: 'white' }}
          title="Supprimer toutes les données de démonstration"
        >
          <Trash2 size={18} />
          Nettoyer
        </button>
      </div>

      {/* Modal de confirmation */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-start gap-4 mb-4">
              <div 
                className="p-3 rounded-full"
                style={{ background: action === 'seed' ? '#DCFCE7' : '#FEE2E2' }}
              >
                {action === 'seed' ? (
                  <Database size={24} style={{ color: '#166534' }} />
                ) : (
                  <AlertTriangle size={24} style={{ color: '#DC2626' }} />
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold mb-2" style={{ color: '#0D3B1F' }}>
                  {action === 'seed' ? 'Créer des données de démonstration ?' : 'Supprimer les données de démonstration ?'}
                </h3>
                <p className="text-sm" style={{ color: '#6B7280' }}>
                  {action === 'seed' ? (
                    <>
                      Cette action va créer :
                      <ul className="mt-2 space-y-1 ml-4">
                        <li>• 5 clients fictifs</li>
                        <li>• 5 immeubles avec 15 unités</li>
                        <li>• 6 baux actifs</li>
                        <li>• 15+ paiements</li>
                        <li>• 3 visites</li>
                        <li>• 3 agents</li>
                      </ul>
                      <p className="mt-2 text-xs font-semibold" style={{ color: '#C8960C' }}>
                        ⚠️ Parfait pour une présentation !
                      </p>
                    </>
                  ) : (
                    <>
                      Cette action va supprimer <strong>toutes les données de démonstration</strong> :
                      <ul className="mt-2 space-y-1 ml-4">
                        <li>• Tous les paiements de démo</li>
                        <li>• Tous les baux de démo</li>
                        <li>• Toutes les visites</li>
                        <li>• Toutes les unités</li>
                        <li>• Tous les immeubles de démo</li>
                        <li>• Tous les clients de démo</li>
                        <li>• Les agents (sauf Super Admin)</li>
                      </ul>
                      <p className="mt-2 text-xs font-semibold" style={{ color: '#DC2626' }}>
                        ⚠️ Cette action est irréversible !
                      </p>
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={loading}
                className="flex-1 py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50"
                style={{ background: '#F3F4F6', color: '#4B5563' }}
              >
                Annuler
              </button>
              <button
                onClick={action === 'seed' ? handleSeedData : handleClearData}
                disabled={loading}
                className="flex-1 py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ 
                  background: action === 'seed' ? '#1A6B35' : '#DC2626', 
                  color: 'white' 
                }}
              >
                {loading ? (
                  <>
                    <Loader size={16} className="animate-spin" />
                    Traitement...
                  </>
                ) : (
                  <>
                    <CheckCircle size={16} />
                    {action === 'seed' ? 'Créer les données' : 'Tout supprimer'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default DemoDataManager
