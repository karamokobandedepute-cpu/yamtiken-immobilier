import { useState, useEffect } from 'react'
import { 
  Trash2, 
  RotateCcw, 
  AlertTriangle, 
  Search, 
  Filter,
  Clock,
  User,
  Building,
  FileText,
  DollarSign,
  Calendar,
  X,
  CheckCircle
} from 'lucide-react'
import { getDeletedItems, restoreItem, purgeItem } from '../utils/deleteHelper'
import { formatDate } from '../utils/formatters'
import toast from 'react-hot-toast'
import ConfirmDialogAdvanced from '../components/ConfirmDialogAdvanced'

/**
 * PAGE CORBEILLE - Gestion des éléments supprimés (Soft Delete)
 * Permet de restaurer ou supprimer définitivement les éléments
 */
const CorbeillePage = () => {
  const [deletedItems, setDeletedItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTypes, setSelectedTypes] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedItem, setSelectedItem] = useState(null)
  const [showRestoreDialog, setShowRestoreDialog] = useState(false)
  const [showPurgeDialog, setShowPurgeDialog] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [purging, setPurging] = useState(false)

  const itemTypes = [
    { id: 'clients', label: 'Clients', icon: User, color: '#3B82F6' },
    { id: 'buildings', label: 'Immeubles', icon: Building, color: '#1A6B35' },
    { id: 'leases', label: 'Contrats', icon: FileText, color: '#C8960C' },
    { id: 'payments', label: 'Paiements', icon: DollarSign, color: '#10B981' },
    { id: 'visites', label: 'Visites', icon: Calendar, color: '#8B5CF6' }
  ]

  // Charger les éléments supprimés
  useEffect(() => {
    loadDeletedItems()
  }, [selectedTypes])

  const loadDeletedItems = async () => {
    setLoading(true)
    try {
      const allItems = []
      
      const typesToLoad = selectedTypes.length > 0 
        ? itemTypes.filter(t => selectedTypes.includes(t.id))
        : itemTypes
      
      for (const type of typesToLoad) {
        const items = await getDeletedItems(type.id)
        const formattedItems = items.map(item => ({
          ...item,
          itemType: type.id,
          typeLabel: type.label,
          TypeIcon: type.icon,
          typeColor: type.color
        }))
        allItems.push(...formattedItems)
      }
      
      // Trier par date de suppression (plus récent d'abord)
      allItems.sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt))
      
      setDeletedItems(allItems)
    } catch (error) {
      console.error('Erreur chargement corbeille:', error)
      toast.error('Erreur lors du chargement de la corbeille')
    } finally {
      setLoading(false)
    }
  }

  // Filtrer les items
  const filteredItems = deletedItems.filter(item => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      (item.nom && item.nom.toLowerCase().includes(search)) ||
      (item.prenom && item.prenom.toLowerCase().includes(search)) ||
      (item.email && item.email.toLowerCase().includes(search)) ||
      (item.reference && item.reference.toLowerCase().includes(search))
    )
  })

  // Restaurer un élément
  const handleRestore = async () => {
    if (!selectedItem) return
    
    setRestoring(true)
    try {
      const result = await restoreItem(selectedItem.itemType, selectedItem.id)
      
      if (result.success) {
        toast.success(`${selectedItem.typeLabel} restauré avec succès`)
        setDeletedItems(prev => prev.filter(item => item.id !== selectedItem.id))
        setShowRestoreDialog(false)
      } else {
        toast.error(result.message || 'Erreur lors de la restauration')
      }
    } catch (error) {
      toast.error('Erreur lors de la restauration')
    } finally {
      setRestoring(false)
      setSelectedItem(null)
    }
  }

  // Supprimer définitivement
  const handlePurge = async () => {
    if (!selectedItem) return
    
    setPurging(true)
    try {
      const result = await purgeItem(selectedItem.itemType, selectedItem.id)
      
      if (result.success) {
        toast.success(`${selectedItem.typeLabel} définitivement supprimé`)
        setDeletedItems(prev => prev.filter(item => item.id !== selectedItem.id))
        setShowPurgeDialog(false)
      } else {
        toast.error(result.message || 'Erreur lors de la suppression définitive')
      }
    } catch (error) {
      toast.error('Erreur lors de la suppression définitive')
    } finally {
      setPurging(false)
      setSelectedItem(null)
    }
  }

  // Restauration multiple
  const handleRestoreAll = async () => {
    if (filteredItems.length === 0) return
    
    let restored = 0
    let failed = 0
    
    for (const item of filteredItems) {
      try {
        const result = await restoreItem(item.itemType, item.id)
        if (result.success) {
          restored++
        } else {
          failed++
        }
      } catch (error) {
        failed++
      }
    }
    
    if (restored > 0) {
      toast.success(`${restored} élément(s) restauré(s)`)
      loadDeletedItems()
    }
    if (failed > 0) {
      toast.error(`${failed} échec(s)`)
    }
  }

  // Vider la corbeille
  const handlePurgeAll = async () => {
    if (filteredItems.length === 0) return
    
    let purged = 0
    let failed = 0
    
    for (const item of filteredItems) {
      try {
        const result = await purgeItem(item.itemType, item.id)
        if (result.success) {
          purged++
        } else {
          failed++
        }
      } catch (error) {
        failed++
      }
    }
    
    if (purged > 0) {
      toast.success(`${purged} élément(s) définitivement supprimé(s)`)
      loadDeletedItems()
    }
    if (failed > 0) {
      toast.error(`${failed} échec(s)`)
    }
  }

  const toggleType = (typeId) => {
    setSelectedTypes(prev => 
      prev.includes(typeId) 
        ? prev.filter(id => id !== typeId)
        : [...prev, typeId]
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#0D3B1F' }}>Corbeille</h1>
          <p className="text-gray-500">Gestion des éléments supprimés - Restauration possible</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRestoreAll}
            disabled={filteredItems.length === 0}
            className="flex items-center gap-2 px-4 py-2 font-medium rounded-lg transition-all disabled:opacity-50"
            style={{ background: '#E8F5EC', color: '#1A6B35' }}
          >
            <RotateCcw size={18} />
            Tout restaurer
          </button>
          <button
            onClick={handlePurgeAll}
            disabled={filteredItems.length === 0}
            className="flex items-center gap-2 px-4 py-2 font-medium rounded-lg transition-all disabled:opacity-50"
            style={{ background: '#FEE2E2', color: '#DC2626' }}
          >
            <Trash2 size={18} />
            Vider la corbeille
          </button>
        </div>
      </div>

      {/* Filtres par type */}
      <div className="flex flex-wrap gap-2">
        {itemTypes.map(type => {
          const Icon = type.icon
          const isSelected = selectedTypes.includes(type.id)
          return (
            <button
              key={type.id}
              onClick={() => toggleType(type.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                isSelected 
                  ? 'text-white' 
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
              style={isSelected ? { backgroundColor: type.color } : {}}
            >
              <Icon size={16} />
              {type.label}
            </button>
          )
        })}
      </div>

      {/* Barre de recherche */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={20} style={{ color: '#6B7280' }} />
        <input
          type="text"
          placeholder="Rechercher dans la corbeille..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:border-[#1A6B35]"
        />
      </div>

      {/* Liste des éléments supprimés */}
      <div 
        className="bg-white rounded-xl overflow-hidden"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
      >
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#1A6B35] border-t-transparent" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <Trash2 size={48} className="mb-4" />
            <p className="text-lg">Corbeille vide</p>
            <p className="text-sm">Aucun élément supprimé</p>
          </div>
        ) : (
          <div className="divide-y">
            {filteredItems.map((item) => {
              const Icon = item.TypeIcon
              return (
                <div 
                  key={`${item.itemType}-${item.id}`}
                  className="p-4 hover:bg-gray-50 flex items-center gap-4 group"
                >
                  {/* Icône type */}
                  <div 
                    className="w-12 h-12 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${item.typeColor}15` }}
                  >
                    <Icon size={24} style={{ color: item.typeColor }} />
                  </div>

                  {/* Informations */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">
                        {item.nom || item.prenom || item.reference || `ID: ${item.id}`}
                        {item.prenom && item.nom && ` ${item.nom}`}
                      </span>
                      <span 
                        className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{ 
                          backgroundColor: `${item.typeColor}15`,
                          color: item.typeColor
                        }}
                      >
                        {item.typeLabel}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                      <span className="flex items-center gap-1">
                        <Clock size={14} />
                        Supprimé le {formatDate(item.deletedAt)}
                      </span>
                      {item.deletedBy && (
                        <span className="flex items-center gap-1">
                          <User size={14} />
                          Par utilisateur #{item.deletedBy}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        setSelectedItem(item)
                        setShowRestoreDialog(true)
                      }}
                      className="p-2 rounded-lg hover:bg-green-50 text-green-600 transition-colors"
                      title="Restaurer"
                    >
                      <RotateCcw size={18} />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedItem(item)
                        setShowPurgeDialog(true)
                      }}
                      className="p-2 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                      title="Supprimer définitivement"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Dialog de restauration */}
      <ConfirmDialogAdvanced
        isOpen={showRestoreDialog}
        onClose={() => {
          setShowRestoreDialog(false)
          setSelectedItem(null)
        }}
        onConfirm={handleRestore}
        title="Restaurer l'élément ?"
        message={`L'élément "${selectedItem?.nom || selectedItem?.prenom || selectedItem?.reference}" va être restauré dans sa section d'origine.`}
        type="info"
        itemName={selectedItem?.nom || selectedItem?.prenom || selectedItem?.reference}
        itemType={selectedItem?.typeLabel}
        confirmButtonText={restoring ? 'Restauration...' : 'Restaurer'}
        cancelButtonText="Annuler"
        isLoading={restoring}
      />

      {/* Dialog de suppression définitive */}
      <ConfirmDialogAdvanced
        isOpen={showPurgeDialog}
        onClose={() => {
          setShowPurgeDialog(false)
          setSelectedItem(null)
        }}
        onConfirm={handlePurge}
        title="⚠️ Suppression définitive"
        message="Cette action est IRRÉVERSIBLE. L'élément sera définitivement supprimé de la base de données."
        type="danger"
        itemName={selectedItem?.nom || selectedItem?.prenom || selectedItem?.reference}
        itemType={selectedItem?.typeLabel}
        consequences={[
          'Données perdues définitivement',
          'Impossible de restaurer',
          'Affecte les rapports historiques'
        ]}
        requireText="SUPPRIMER"
        confirmButtonText={purging ? 'Suppression...' : 'Supprimer définitivement'}
        cancelButtonText="Annuler"
        isLoading={purging}
      />
    </div>
  )
}

export default CorbeillePage
