import { useEffect, useState } from 'react'
import { Plus, Search, Edit2, Trash2, Calendar, CheckCircle, XCircle } from 'lucide-react'
import { fetchVisites, deleteVisite } from '../utils/api'
import { formatDate, formatDateTime, getStatutBadgeColor } from '../utils/formatters'
import toast from 'react-hot-toast'

const VisitesPage = () => {
  const [visites, setVisites] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatut, setFilterStatut] = useState('')

  useEffect(() => {
    loadVisites()
  }, [searchTerm, filterStatut])

  const loadVisites = async () => {
    try {
      setLoading(true)
      const params = {}
      if (searchTerm) params.search = searchTerm
      if (filterStatut) params.statut = filterStatut
      
      const response = await fetchVisites(params)
      setVisites(response.data.data || [])
    } catch (error) {
      toast.error('Erreur lors du chargement des visites')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette visite ?')) return
    
    try {
      await deleteVisite(id)
      toast.success('Visite supprimée avec succès')
      loadVisites()
    } catch (error) {
      toast.error('Erreur lors de la suppression')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Visites</h1>
          <p className="text-gray-500">Planification et suivi des visites</p>
        </div>
        <button
          onClick={() => {}}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={18} />
          Nouvelle visite
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Rechercher une visite..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <select
            value={filterStatut}
            onChange={(e) => setFilterStatut(e.target.value)}
            className="input-field w-full sm:w-48"
          >
            <option value="">Tous les statuts</option>
            <option value="PLANIFIEE">Planifiée</option>
            <option value="TERMINEE">Terminée</option>
            <option value="ANNULEE">Annulée</option>
          </select>
        </div>
      </div>

      {/* Visites Table */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-midGreen border-t-transparent"></div>
          </div>
        ) : visites.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <Calendar size={48} className="mb-4" />
            <p>Aucune visite trouvée</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Date & Heure</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Client</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Bien</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Statut</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Résultat</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visites.map((visite) => (
                  <tr key={visite.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-800">
                        {formatDate(visite.dateVisite)}
                      </p>
                      <p className="text-sm text-gray-500">
                        {visite.heureVisite || 'Heure non définie'}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-gray-800">
                        {visite.client?.prenom} {visite.client?.nom}
                      </p>
                      <p className="text-sm text-gray-500">{visite.client?.telephone}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-800">{visite.bien?.titre}</p>
                      <p className="text-sm text-gray-500">{visite.bien?.adresse}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatutBadgeColor(visite.statut)}`}>
                        {visite.statut}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-600">
                        {visite.resultat || 'En attente'}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                          title="Marquer comme terminée"
                        >
                          <CheckCircle size={16} />
                        </button>
                        <button
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          title="Annuler"
                        >
                          <XCircle size={16} />
                        </button>
                        <button
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(visite.id)}
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
    </div>
  )
}

export default VisitesPage
