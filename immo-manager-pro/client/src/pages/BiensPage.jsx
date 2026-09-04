import { useEffect, useState } from 'react'
import { useRealtimeSync } from '../hooks/useRealtimeSync'
import { 
  Plus, Search, Edit2, Trash2, Building2, Eye, FileDown, 
  Home, MapPin, Layers, X, Download
} from 'lucide-react'
import { 
  fetchBuildings, fetchBuilding, deleteBuilding, createBuilding, updateBuilding, generateBuildingPDF,
  createUnite, updateUnite, deleteUnite, updateUniteStatut, fetchUnitesByBuilding, fetchLeases
} from '../utils/api'
import { safeMap, safeGet, extractApiData, getErrorMessage } from '../utils/safetyHelpers'
import { 
  formatCurrency, 
  getTypeBuildingLabel, 
  getTypeUniteLabel,
  getStatutUniteBadgeColor,
  getStatutUniteLabel
} from '../utils/formatters'
import toast from 'react-hot-toast'
import jsPDF from 'jspdf'
import { addPdfHeader, addPdfFooter, addWatermark, addSectionTitle, addTable, addInfoCard, checkPageBreak } from '../utils/pdfUtils'
import Pagination from '../components/Pagination'
import { logDocGeneration } from '../utils/pdfLogger'
import { useAuthStore } from '../stores/authStore'

const BiensPage = () => {
  const [buildings, setBuildings] = useState([])
  const [loading, setLoading] = useState(true) // true = afficher spinner au chargement initial
  const [refreshing, setRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterCommune, setFilterCommune] = useState('')
  
  // ✅ SYNCHRONISATION TEMPS RÉEL SUPABASE
  const { status: realtimeStatus, lastSync } = useRealtimeSync({ enabled: true })
  
  // Modals
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 15 // mode liste
  const { user } = useAuthStore()
  const [showBuildingModal, setShowBuildingModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showUniteModal, setShowUniteModal] = useState(false)
  const [selectedBuilding, setSelectedBuilding] = useState(null)
  const [selectedUnite, setSelectedUnite] = useState(null)
  const [refreshDetailTrigger, setRefreshDetailTrigger] = useState(0)
  const [cameFromDetail, setCameFromDetail] = useState(false)

  useEffect(() => {
    loadBuildings()
  }, [searchTerm, filterType, filterCommune])
  
  // 🔄 Rafraîchir quand Realtime détecte un changement
  useEffect(() => {
    if (lastSync) {
      console.log('[Biens] Changement détecté via Realtime, rafraîchissement...')
      loadBuildings()
    }
  }, [lastSync])

  const loadBuildings = async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true)
    else setLoading(true)
    
    try {
      const params = {}
      if (searchTerm) params.search = searchTerm
      if (filterType) params.type = filterType
      if (filterCommune) params.commune = filterCommune
      
      const response = await fetchBuildings(Object.keys(params).length > 0 ? params : undefined)
      setBuildings(response?.data?.data || [])
    } catch (error) {
      if (error?.response?.status !== 401 && error?.response?.status !== 403) {
        toast.error('Erreur lors du chargement des immeubles')
      }
      console.error('[loadBuildings]', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet immeuble et toutes ses unités ?')) return
    
    try {
      await deleteBuilding(id)
      toast.success('Immeuble supprimé avec succès')
      loadBuildings()
    } catch (error) {
      toast.error('Erreur lors de la suppression')
    }
  }

  const handleExportPDF = async (building) => {
    const toastId = toast.loading('Génération du PDF...')
    try {
      // Récupérer les données depuis l'API
      const response = await generateBuildingPDF(building.id)
      const { building: buildingData, stats, unites } = response.data
      
      // Créer le PDF
      const doc = new jsPDF('p', 'mm', 'a4')
      let y = 40
      
      addWatermark(doc)
      addPdfHeader(doc, 'FICHE IMMEUBLE', buildingData.nom, user)
      
      // Informations générales
      y = addSectionTitle(doc, 'Informations Générales', y)
      addInfoCard(doc, 'Nom', buildingData.nom || '-', 15, y, 55)
      addInfoCard(doc, 'Type', buildingData.type || '-', 75, y, 35)
      addInfoCard(doc, 'Commune', buildingData.commune || '-', 115, y, 40)
      addInfoCard(doc, 'Ville', buildingData.ville || '-', 160, y, 35)
      y += 18
      addInfoCard(doc, 'Adresse', buildingData.adresse || '-', 15, y, 90)
      addInfoCard(doc, 'Étages', buildingData.nombreEtages?.toString() || '-', 115, y, 40)
      
      y += 22
      
      // Statistiques
      y = addSectionTitle(doc, 'Statistiques', y)
      const cw = 33
      addInfoCard(doc, 'Total', (stats.totalUnites || 0).toString(), 15, y, cw)
      addInfoCard(doc, 'Disponibles', (stats.disponibles || 0).toString(), 50, y, cw)
      addInfoCard(doc, 'Louées', (stats.louees || 0).toString(), 85, y, cw)
      addInfoCard(doc, 'Réservées', (stats.reservees || 0).toString(), 120, y, cw)
      addInfoCard(doc, 'En travaux', (stats.enTravaux || 0).toString(), 155, y, 40)
      
      y += 22
      
      // Liste des unités
      if (unites.length > 0) {
        y = checkPageBreak(doc, y, 60)
        y = addSectionTitle(doc, 'Liste des Unités', y)
        
        const tableData = safeMap(unites, u => [
          u.numeroPorte,
          u.typeUnite,
          u.surface ? `${u.surface} m²` : '-',
          u.statut,
          u.loyerMensuel ? `${u.loyerMensuel.toLocaleString()} FCFA` : '-'
        ])
        
        y = addTable(doc, 
          ['N° Porte', 'Type', 'Surface', 'Statut', 'Loyer'],
          tableData,
          y
        )
      }
      
      addPdfFooter(doc, 1, true, user)
      
      // Ouvrir le PDF
      const pdfBlob = doc.output('blob')
      const pdfUrl = URL.createObjectURL(pdfBlob)
      window.open(pdfUrl, '_blank')
      
      logDocGeneration(user, 'PDF_GENERATED', `fiche_${buildingData.nom}.pdf`, 'buildings', { buildingId: buildingData.id })
      toast.success('Fiche PDF générée avec succès', { id: toastId })
    } catch (error) {
      console.error('Erreur PDF:', error)
      toast.error('Erreur lors de la génération PDF', { id: toastId })
    }
  }

  // ============================================
  // EXPORT LISTE PATRIMOINE PDF
  // ============================================
  const exportPatrimoinePDF = () => {
    try {
      const doc = new jsPDF('p', 'mm', 'a4')
      let y = 40

      const typeLabel = filterType ? ` - Type: ${getTypeBuildingLabel(filterType)}` : ''
      const communeLabel = filterCommune ? ` - Commune: ${filterCommune}` : ''

      addWatermark(doc)
      addPdfHeader(doc, 'LISTE DU PATRIMOINE', `${buildings.length} immeuble(s)${typeLabel}${communeLabel}`, user)

      if (buildings.length === 0) {
        doc.setFontSize(12)
        doc.setTextColor('#9CA3AF')
        doc.text('Aucun immeuble à afficher', doc.internal.pageSize.getWidth() / 2, y + 20, { align: 'center' })
      } else {
        // Résumé global
        const totalUnites = buildings.reduce((sum, b) => sum + (b.stats?.totalUnites || 0), 0)
        const totalLoyer = buildings.reduce((sum, b) => sum + (b.stats?.loyerTotal || 0), 0)
        const tauxMoyen = buildings.length > 0
          ? Math.round(buildings.reduce((sum, b) => sum + parseFloat(b.stats?.tauxOccupation || 0), 0) / buildings.length)
          : 0

        addInfoCard(doc, 'Total unités', totalUnites.toString(), 20, y, 50)
        addInfoCard(doc, 'Loyer mensuel', formatCurrency(totalLoyer), 80, y, 60)
        addInfoCard(doc, 'Taux occupation', `${tauxMoyen}%`, 150, y, 50)
        y += 25

        // Tableau des immeubles
        y = addSectionTitle(doc, 'Détail des immeubles', y)

        const data = safeMap(buildings, b => [
          b.nom,
          getTypeBuildingLabel(b.type),
          b.commune,
          b.stats?.totalUnites?.toString() || '0',
          `${b.stats?.tauxOccupation || 0}%`,
          formatCurrency(b.stats?.loyerTotal || 0)
        ])

        y = addTable(doc, ['Nom', 'Type', 'Commune', 'Unités', 'Occup.', 'Loyer/mois'], data, y, [45, 30, 35, 20, 20, 35])
      }

      addPdfFooter(doc, 1, true, user)
      doc.save(`PATRIMOINE-${new Date().toISOString().slice(0, 10)}.pdf`)
      logDocGeneration(user, 'PDF_GENERATED', `PATRIMOINE-${new Date().toISOString().slice(0,10)}.pdf`, 'biens')
      toast.success('Liste du patrimoine exportée en PDF')
    } catch (error) {
      console.error('Erreur PDF:', error)
      toast.error('Erreur lors de l\'export PDF')
    }
  }

  const openBuildingModal = (building = null) => {
    setSelectedBuilding(building)
    setShowBuildingModal(true)
  }

  const openDetailModal = (building) => {
    setSelectedBuilding(building)
    setShowDetailModal(true)
  }

  const openUniteModal = (building, unite = null, fromDetail = false) => {
    setSelectedBuilding(building)
    setSelectedUnite(unite)
    setCameFromDetail(fromDetail)
    setShowUniteModal(true)
  }

  const closeModals = () => {
    setShowBuildingModal(false)
    setShowDetailModal(false)
    setShowUniteModal(false)
    setSelectedBuilding(null)
    setSelectedUnite(null)
    loadBuildings()
  }
  
  // Fermer seulement le modal unité et revenir au détail si nécessaire
  const closeUniteModal = () => {
    setShowUniteModal(false)
    setSelectedUnite(null)
    // Si on vient du DetailModal, le rouvrir et rafraîchir
    if (cameFromDetail && selectedBuilding) {
      // Forcer le rafraîchissement immédiat
      setRefreshDetailTrigger(prev => prev + 1)
      setShowDetailModal(true)
      setCameFromDetail(false)
    }
    loadBuildings()
  }
  
  // Callback pour rafraîchir après succès d'ajout/modification d'unité
  const handleUniteSuccess = async () => {
    console.log('🔄 [handleUniteSuccess] === DÉBUT RAFRAÎCHISSEMENT ===')
    
    // ÉTAPE 1 : Incrémenter le trigger avec timestamp (garantit un changement)
    const newTrigger = Date.now()
    console.log('🔔 [handleUniteSuccess] Nouveau trigger:', newTrigger)
    setRefreshDetailTrigger(newTrigger)
    
    // ÉTAPE 2 : Recharger la liste des buildings (pour mettre à jour les stats)
    console.log('🔄 [handleUniteSuccess] Rechargement des buildings...')
    await loadBuildings()
    
    console.log('✅ [handleUniteSuccess] === RAFRAÎCHISSEMENT TERMINÉ ===')
  }

  // Calcul du taux d'occupation
  const getTauxOccupationColor = (taux) => {
    if (taux >= 80) return '#10B981'
    if (taux >= 50) return '#F59E0B'
    return '#EF4444'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#0D3B1F' }}>Patrimoine Immobilier</h1>
          <p className="text-gray-500">Gestion des immeubles et unités</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportPatrimoinePDF}
            className="flex items-center gap-2 px-4 py-2 font-medium rounded-lg transition-all"
            style={{ background: '#FEF3C7', color: '#92400E' }}
            title="Exporter la liste du patrimoine en PDF"
          >
            <FileDown size={18} />
            Export PDF
          </button>
          <button
            onClick={() => openBuildingModal()}
            className="flex items-center gap-2 px-4 py-2 text-white font-medium rounded-lg transition-all"
            style={{ background: '#1A6B35' }}
            onMouseEnter={(e) => e.target.style.background = '#0D3B1F'}
            onMouseLeave={(e) => e.target.style.background = '#1A6B35'}
          >
            <Plus size={18} />
            Nouvel immeuble
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div 
        className="p-4 rounded-lg"
        style={{ background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
      >
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={20} style={{ color: '#6B7280' }} />
            <input
              type="text"
              placeholder="Rechercher un immeuble..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border-2 rounded-lg outline-none transition-all"
              style={{ borderColor: '#E8F5EC', borderRadius: '8px' }}
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 border-2 rounded-lg outline-none"
            style={{ borderColor: '#E8F5EC', minWidth: '160px' }}
          >
            <option value="">Tous les types</option>
            <option value="R2">R+2</option>
            <option value="R3">R+3</option>
            <option value="R4">R+4</option>
            <option value="VILLA">Villa</option>
            <option value="COUR_COMMUNE">Cour Commune</option>
          </select>
          <select
            value={filterCommune}
            onChange={(e) => setFilterCommune(e.target.value)}
            className="px-4 py-2 border-2 rounded-lg outline-none"
            style={{ borderColor: '#E8F5EC', minWidth: '160px' }}
          >
            <option value="">Toutes les communes</option>
            <option value="Cocody">Cocody</option>
            <option value="Marcory">Marcory</option>
            <option value="Plateau">Plateau</option>
            <option value="Yopougon">Yopougon</option>
            <option value="Angré">Angré</option>
            <option value="Riviera">Riviera</option>
          </select>
        </div>
      </div>

      {/* Liste détaillée des immeubles */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-transparent"
            style={{ borderColor: '#1A6B35' }}
          />
        </div>
      ) : buildings.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64" style={{ color: '#9CA3AF' }}>
          <Building2 size={48} className="mb-4" />
          <p>Aucun immeuble trouvé</p>
          <button 
            onClick={() => loadBuildings(true)}
            disabled={refreshing}
            className="mt-4 px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 text-sm font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {refreshing && <div className="w-4 h-4 border-2 border-green-700 border-t-transparent rounded-full animate-spin" />}
            {refreshing ? 'Chargement...' : 'Rafraîchir'}
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          {/* En-tête tableau */}
          <div className="grid gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider" 
            style={{ gridTemplateColumns: '2fr 1fr 1fr 0.8fr 0.8fr 1.2fr auto', background: '#0D3B1F', color: '#C8960C' }}>
            <span>Immeuble</span>
            <span>Type</span>
            <span>Commune</span>
            <span className="text-center">Unités</span>
            <span className="text-center">Occup.</span>
            <span className="text-right">Loyer/mois</span>
            <span className="text-center">Actions</span>
          </div>
          {/* Lignes */}
          {safeMap(buildings.slice((currentPage-1)*PAGE_SIZE, currentPage*PAGE_SIZE), (building, idx) => (
            <div 
              key={building.id}
              className="grid gap-2 px-4 py-3 items-center transition-colors"
              style={{ 
                gridTemplateColumns: '2fr 1fr 1fr 0.8fr 0.8fr 1.2fr auto',
                borderBottom: '1px solid #E8F5EC',
                background: idx % 2 === 0 ? '#FFFFFF' : '#F9FFF9'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#F0FDF4'}
              onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 0 ? '#FFFFFF' : '#F9FFF9'}
            >
              {/* Nom + adresse */}
              <div>
                <p className="font-bold text-sm" style={{ color: '#0D3B1F' }}>{building.nom}</p>
                <p className="text-xs" style={{ color: '#6B7280' }}>{building.adresse}</p>
              </div>
              {/* Type */}
              <div>
                <span className="px-2 py-1 rounded-full text-xs font-medium" style={{ background: '#E8F5EC', color: '#1A6B35' }}>
                  {getTypeBuildingLabel(building.type)}
                </span>
              </div>
              {/* Commune */}
              <span className="text-sm" style={{ color: '#374151' }}>{building.commune}</span>
              {/* Unités */}
              <span className="text-center font-bold text-sm" style={{ color: '#0D3B1F' }}>{building.stats?.totalUnites || 0}</span>
              {/* Occupation */}
              <div className="text-center">
                <span className="font-bold text-sm" style={{ color: getTauxOccupationColor(parseFloat(building.stats?.tauxOccupation || 0)) }}>
                  {building.stats?.tauxOccupation || 0}%
                </span>
              </div>
              {/* Loyer */}
              <span className="text-right font-bold text-sm" style={{ color: '#1A6B35' }}>{formatCurrency(building.stats?.loyerTotal || 0)}</span>
              {/* Actions */}
              <div className="flex items-center gap-1">
                <button onClick={() => openUniteModal(building)} className="p-1.5 rounded transition-colors" style={{ color: '#166534' }} title="Ajouter unité"
                  onMouseEnter={e => e.currentTarget.style.background='#DCFCE7'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                  <Plus size={16} />
                </button>
                <button onClick={() => openDetailModal(building)} className="p-1.5 rounded transition-colors" style={{ color: '#4B5563' }} title="Voir détails"
                  onMouseEnter={e => e.currentTarget.style.background='#F3F4F6'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                  <Eye size={16} />
                </button>
                <button onClick={() => openBuildingModal(building)} className="p-1.5 rounded transition-colors" style={{ color: '#1D4ED8' }} title="Modifier"
                  onMouseEnter={e => e.currentTarget.style.background='#DBEAFE'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                  <Edit2 size={16} />
                </button>
                <button onClick={() => handleExportPDF(building)} className="p-1.5 rounded transition-colors" style={{ color: '#C8960C' }} title="Fiche PDF"
                  onMouseEnter={e => e.currentTarget.style.background='#FEF3C7'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                  <FileDown size={16} />
                </button>
                <button onClick={() => handleDelete(building.id)} className="p-1.5 rounded transition-colors" style={{ color: '#DC2626' }} title="Supprimer"
                  onMouseEnter={e => e.currentTarget.style.background='#FEE2E2'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Pagination
        currentPage={currentPage}
        totalPages={Math.ceil(buildings.length / PAGE_SIZE)}
        onPageChange={setCurrentPage}
        totalItems={buildings.length}
        pageSize={PAGE_SIZE}
      />

      {/* Modal - Formulaire Immeuble */}
      {showBuildingModal && (
        <BuildingModal 
          building={selectedBuilding}
          onClose={closeModals}
        />
      )}

      {/* Modal - Vue Détail avec Unités */}
      {showDetailModal && selectedBuilding && (
        <DetailModal 
          building={selectedBuilding}
          onClose={closeModals}
          onAddUnite={() => {
            setShowDetailModal(false)
            openUniteModal(selectedBuilding, null, true)
          }}
          onEditUnite={(unite) => {
            setShowDetailModal(false)
            openUniteModal(selectedBuilding, unite, true)
          }}
          refreshTrigger={refreshDetailTrigger}
          user={user}
        />
      )}

      {/* Modal - Formulaire Unité */}
      {showUniteModal && selectedBuilding && (
        <UniteModal 
          building={selectedBuilding}
          unite={selectedUnite}
          onClose={closeUniteModal}
          onSuccess={handleUniteSuccess}
        />
      )}
    </div>
  )
}

// ============================================
// MODAL - FORMULAIRE IMMEUBLE
// ============================================
const BuildingModal = ({ building, onClose }) => {
  const [formData, setFormData] = useState({
    nom: building?.nom || '',
    type: building?.type || 'R2',
    adresse: building?.adresse || '',
    commune: building?.commune || '',
    ville: building?.ville || 'Abidjan',
    nombreEtages: building?.nombreEtages || 1,
    valeurEstimee: building?.valeurEstimee || '',
    droitsTerre: building?.droitsTerre || '',
    chargesAnnexes: building?.chargesAnnexes || '',
    dateAcquisition: building?.dateAcquisition ? new Date(building.dateAcquisition).toISOString().split('T')[0] : '',
    notes: building?.notes || ''
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const data = {
        ...formData,
        nombreEtages: parseInt(formData.nombreEtages) || 1,
        valeurEstimee: formData.valeurEstimee ? parseFloat(formData.valeurEstimee) : null,
        chargesAnnexes: formData.chargesAnnexes ? parseFloat(formData.chargesAnnexes) : null
      }

      if (building) {
        await updateBuilding(building.id, data)
        toast.success('Immeuble modifié avec succès')
      } else {
        await createBuilding(data)
        toast.success('Immeuble créé avec succès')
      }
      onClose()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Erreur lors de l\'enregistrement')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div 
        className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        style={{ borderRadius: '16px' }}
      >
        <div className="p-6 border-b" style={{ borderColor: '#E8F5EC' }}>
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold" style={{ color: '#0D3B1F' }}>
              {building ? 'Modifier l\'immeuble' : 'Nouvel immeuble'}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
              <X size={24} style={{ color: '#6B7280' }} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#0D3B1F' }}>
                Nom de l'immeuble *
              </label>
              <input
                type="text"
                value={formData.nom}
                onChange={(e) => setFormData({...formData, nom: e.target.value})}
                className="w-full px-4 py-2 border-2 rounded-lg outline-none focus:border-midGreen"
                style={{ borderColor: '#E8F5EC' }}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#0D3B1F' }}>
                Type *
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({...formData, type: e.target.value})}
                className="w-full px-4 py-2 border-2 rounded-lg outline-none focus:border-midGreen"
                style={{ borderColor: '#E8F5EC' }}
              >
                <option value="R2">R+2</option>
                <option value="R3">R+3</option>
                <option value="R4">R+4</option>
                <option value="VILLA">Villa</option>
                <option value="COUR_COMMUNE">Cour Commune</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0D3B1F' }}>
              Adresse *
            </label>
            <input
              type="text"
              value={formData.adresse}
              onChange={(e) => setFormData({...formData, adresse: e.target.value})}
              className="w-full px-4 py-2 border-2 rounded-lg outline-none focus:border-midGreen"
              style={{ borderColor: '#E8F5EC' }}
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#0D3B1F' }}>
                Commune *
              </label>
              <input
                type="text"
                value={formData.commune}
                onChange={(e) => setFormData({...formData, commune: e.target.value})}
                className="w-full px-4 py-2 border-2 rounded-lg outline-none focus:border-midGreen"
                style={{ borderColor: '#E8F5EC' }}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#0D3B1F' }}>
                Ville
              </label>
              <input
                type="text"
                value={formData.ville}
                onChange={(e) => setFormData({...formData, ville: e.target.value})}
                className="w-full px-4 py-2 border-2 rounded-lg outline-none focus:border-midGreen"
                style={{ borderColor: '#E8F5EC' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#0D3B1F' }}>
                Nombre d'étages
              </label>
              <input
                type="number"
                min="1"
                value={formData.nombreEtages}
                onChange={(e) => setFormData({...formData, nombreEtages: e.target.value})}
                className="w-full px-4 py-2 border-2 rounded-lg outline-none focus:border-midGreen"
                style={{ borderColor: '#E8F5EC' }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#0D3B1F' }}>
                Valeur estimée (FCFA)
              </label>
              <input
                type="number"
                value={formData.valeurEstimee}
                onChange={(e) => setFormData({...formData, valeurEstimee: e.target.value})}
                className="w-full px-4 py-2 border-2 rounded-lg outline-none focus:border-midGreen"
                style={{ borderColor: '#E8F5EC' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#0D3B1F' }}>
                Droits au sol
              </label>
              <input
                type="text"
                value={formData.droitsTerre}
                onChange={(e) => setFormData({...formData, droitsTerre: e.target.value})}
                className="w-full px-4 py-2 border-2 rounded-lg outline-none focus:border-midGreen"
                style={{ borderColor: '#E8F5EC' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#0D3B1F' }}>
                Charges annuelles
              </label>
              <input
                type="number"
                value={formData.chargesAnnexes}
                onChange={(e) => setFormData({...formData, chargesAnnexes: e.target.value})}
                className="w-full px-4 py-2 border-2 rounded-lg outline-none focus:border-midGreen"
                style={{ borderColor: '#E8F5EC' }}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0D3B1F' }}>
              Date d'acquisition
            </label>
            <input
              type="date"
              value={formData.dateAcquisition}
              onChange={(e) => setFormData({...formData, dateAcquisition: e.target.value})}
              className="w-full px-4 py-2 border-2 rounded-lg outline-none focus:border-midGreen"
              style={{ borderColor: '#E8F5EC' }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0D3B1F' }}>
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              rows={3}
              className="w-full px-4 py-2 border-2 rounded-lg outline-none focus:border-midGreen"
              style={{ borderColor: '#E8F5EC' }}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 font-medium rounded-lg transition-colors"
              style={{ background: '#F3F4F6', color: '#4B5563' }}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 py-3 text-white font-medium rounded-lg transition-colors"
              style={{ background: '#1A6B35' }}
            >
              {building ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============================================
// MODAL - VUE DÉTAIL AVEC UNITÉS (AMÉLIORÉ)
// ============================================
const DetailModal = ({ building, onClose, onAddUnite, onEditUnite, refreshTrigger, user }) => {
  const [unites, setUnites] = useState([])
  const [leases, setLeases] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchUnite, setSearchUnite] = useState('')
  const [filterStatut, setFilterStatut] = useState('')
  const [generatingPDF, setGeneratingPDF] = useState(false)
  const [viewMode, setViewMode] = useState('unites')
  const [collapsedClients, setCollapsedClients] = useState({})
  const buildingId = building.id

  const toggleClientGroup = (key) =>
    setCollapsedClients(prev => ({ ...prev, [key]: !prev[key] }))

  useEffect(() => {
    loadData()
    // Rafraîchissement automatique toutes les 30 secondes
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [buildingId, refreshTrigger])

  const loadData = async () => {
    try {
      if (!unites.length) setLoading(true)
      // Charger unités, détails bâtiment ET baux actifs en parallèle
      const [unitesRes, buildingRes, leasesRes] = await Promise.all([
        fetchUnitesByBuilding(building.id),
        fetchBuilding(building.id).catch(() => null),
        fetchLeases({ buildingId: building.id, limit: 500 }).catch(() => null)
      ])

      const unitesData = unitesRes?.data?.data || unitesRes?.data || []
      setUnites(Array.isArray(unitesData) ? [...unitesData] : [])

      // Fusionner baux depuis les deux sources
      const fromBuilding = buildingRes?.data?.leases || []
      const fromLeases   = leasesRes?.data?.data || leasesRes?.data || []
      const allLeases    = fromLeases.length ? fromLeases : fromBuilding
      setLeases(Array.isArray(allLeases) ? allLeases : [])

    } catch (error) {
      console.error('[DetailModal] Erreur chargement:', error)
      setUnites([])
    } finally {
      setLoading(false)
    }
  }

  // Alias pour compatibilité
  const loadUnites = loadData

  // Filtrer les unités
  const filteredUnites = unites.filter(unite => {
    const matchSearch = !searchUnite || 
      unite.numeroPorte?.toLowerCase().includes(searchUnite.toLowerCase()) ||
      unite.typeUnite?.toLowerCase().includes(searchUnite.toLowerCase())
    const matchStatut = !filterStatut || unite.statut === filterStatut
    return matchSearch && matchStatut
  })

  // Map uniteId -> lease (pour afficher le client sur chaque porte)
  const leasesMap = leases.reduce((acc, l) => {
    if (l.uniteId) acc[l.uniteId] = l
    return acc
  }, {})

  // Statistiques calculées — croisées avec les baux actifs pour exactitude
  const activeLeaseUniteIds = new Set(
    leases
      .filter(l => l.statut === 'ACTIF' || l.statut === 'EN_COURS')
      .map(l => l.uniteId)
      .filter(Boolean)
  )
  const occupesSet = new Set(
    unites.filter(u => u.statut === 'OCCUPE' || activeLeaseUniteIds.has(u.id)).map(u => u.id)
  )
  const stats = {
    total:     unites.length,
    occupes:   occupesSet.size,
    reserves:  unites.filter(u => u.statut === 'RESERVE' && !occupesSet.has(u.id)).length,
    vacants:   unites.filter(u => !occupesSet.has(u.id) && u.statut !== 'RESERVE').length,
    loyerTotal: leases
      .filter(l => l.statut === 'ACTIF' || l.statut === 'EN_COURS')
      .reduce((sum, l) => sum + (parseFloat(l.montantInitial) || parseFloat(l.loyerMensuel) || 0), 0)
      || unites.filter(u => occupesSet.has(u.id))
               .reduce((sum, u) => sum + (parseFloat(u.loyerBase) || 0), 0)
  }

  const handleDeleteUnite = async (uniteId) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette unité ?')) return
    
    try {
      await deleteUnite(building.id, uniteId)
      toast.success('Unité supprimée avec succès')
      loadUnites()
    } catch (error) {
      toast.error('Erreur lors de la suppression')
    }
  }

  const handleStatutChange = async (uniteId, newStatut) => {
    try {
      await updateUniteStatut(building.id, uniteId, newStatut)
      toast.success('Statut mis à jour')
      loadUnites()
    } catch (error) {
      toast.error('Erreur lors de la mise à jour')
    }
  }

  // 🖨️ IMPRESSION PDF DES UNITÉS
  const printUnitesPDF = async () => {
    setGeneratingPDF(true)
    const toastId = toast.loading('Génération du PDF...')
    
    try {
      console.log('📄 [PDF] Début génération PDF des unités')
      console.log('📄 [PDF] Building:', building.nom)
      console.log('📄 [PDF] User:', user)
      console.log('📄 [PDF] Unités:', unites.length)
      
      // Vérification de user
      if (!user) {
        throw new Error('Utilisateur non connecté')
      }
      
      const doc = new jsPDF('p', 'mm', 'a4')
      let y = 40

      // Watermark
      console.log('📄 [PDF] Ajout watermark...')
      if (typeof addWatermark === 'function') {
        addWatermark(doc)
      }

      // Header
      console.log('📄 [PDF] Ajout header...')
      if (typeof addPdfHeader === 'function') {
        addPdfHeader(doc, 'LISTE DES UNITÉS', building.nom, user)
      }

      // Stats résumé
      console.log('📄 [PDF] Ajout stats...')
      y = addSectionTitle(doc, 'Résumé', y)
      const cardW = 33
      addInfoCard(doc, 'Total', stats.total.toString(), 15, y, cardW)
      addInfoCard(doc, 'Vacants', stats.vacants.toString(), 50, y, cardW)
      addInfoCard(doc, 'Réservés', stats.reserves.toString(), 85, y, cardW)
      addInfoCard(doc, 'Occupés', stats.occupes.toString(), 120, y, cardW)
      addInfoCard(doc, 'Loyer/mois', formatCurrency(stats.loyerTotal), 155, y, 40)
      y += 20

      // Tableau des unités
      if (filteredUnites.length > 0) {
        console.log('📄 [PDF] Ajout tableau des unités...')
        y = checkPageBreak(doc, y, 60)
        y = addSectionTitle(doc, 'Détail des unités', y)

        const tableData = safeMap(filteredUnites, u => [
          u.numeroPorte || '-',
          getTypeUniteLabel(u.typeUnite),
          `Étage ${u.etage || 0}`,
          getStatutUniteLabel(u.statut),
          formatCurrency(u.loyerBase || 0)
        ])

        y = addTable(doc,
          ['N° Porte', 'Type', 'Étage', 'Statut', 'Loyer'],
          tableData,
          y,
          [30, 40, 30, 35, 40]
        )
      }

      // Footer
      console.log('📄 [PDF] Ajout footer...')
      if (typeof addPdfFooter === 'function') {
        addPdfFooter(doc, 1, true, user)
      }

      // Sauvegarde
      const fileName = `UNITES-${building.nom.replace(/[^a-z0-9]/gi, '_')}-${new Date().toISOString().slice(0,10)}.pdf`
      console.log('📄 [PDF] Sauvegarde:', fileName)
      doc.save(fileName)
      
      // Log
      if (typeof logDocGeneration === 'function') {
        logDocGeneration(user, 'PDF_GENERATED', fileName, 'buildings', { buildingId: building.id })
      }
      
      console.log('✅ [PDF] Génération terminée avec succès')
      toast.success('PDF généré avec succès', { id: toastId })
    } catch (error) {
      console.error('❌ [PDF] Erreur complète:', error)
      console.error('❌ [PDF] Message:', error.message)
      console.error('❌ [PDF] Stack:', error.stack)
      toast.error(`Erreur PDF: ${error.message || 'Erreur inconnue'}`, { id: toastId })
    } finally {
      setGeneratingPDF(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div 
        className="bg-white w-full max-w-5xl max-h-[90vh] overflow-y-auto"
        style={{ borderRadius: '16px' }}
      >
        {/* Header */}
        <div className="p-6 border-b" style={{ borderColor: '#E8F5EC' }}>
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold" style={{ color: '#0D3B1F' }}>
                {building.nom}
              </h2>
              <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
                {getTypeBuildingLabel(building.type)} • {building.commune} • {building.adresse}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={printUnitesPDF}
                disabled={generatingPDF || unites.length === 0}
                className="flex items-center gap-2 px-4 py-2 font-medium rounded-lg transition-all disabled:opacity-50"
                style={{ background: '#FEF3C7', color: '#92400E' }}
                title="Imprimer la liste des unités"
              >
                {generatingPDF ? (
                  <div className="w-4 h-4 border-2 border-yellow-700 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Download size={18} />
                )}
                {generatingPDF ? 'PDF...' : 'Imprimer'}
              </button>
              <button
                onClick={onAddUnite}
                className="flex items-center gap-2 px-4 py-2 text-white font-medium rounded-lg transition-all"
                style={{ background: '#1A6B35' }}
              >
                <Plus size={18} />
                Ajouter une unité
              </button>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
                <X size={24} style={{ color: '#6B7280' }} />
              </button>
            </div>
          </div>
        </div>

        {/* Stats visuelles */}
        <div className="p-6 grid grid-cols-5 gap-4 border-b" style={{ borderColor: '#E8F5EC', background: '#F9FAFB' }}>
          <div className="text-center p-3 rounded-lg bg-white shadow-sm">
            <p className="text-2xl font-bold" style={{ color: '#0D3B1F' }}>{stats.total}</p>
            <p className="text-xs" style={{ color: '#6B7280' }}>Total</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-white shadow-sm">
            <p className="text-2xl font-bold" style={{ color: '#10B981' }}>{stats.occupes}</p>
            <p className="text-xs" style={{ color: '#6B7280' }}>Occupés</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-white shadow-sm">
            <p className="text-2xl font-bold" style={{ color: '#F59E0B' }}>{stats.reserves}</p>
            <p className="text-xs" style={{ color: '#6B7280' }}>Réservés</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-white shadow-sm">
            <p className="text-2xl font-bold" style={{ color: '#6B7280' }}>{stats.vacants}</p>
            <p className="text-xs" style={{ color: '#6B7280' }}>Vacants</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-white shadow-sm">
            <p className="text-2xl font-bold" style={{ color: '#1A6B35' }}>{formatCurrency(stats.loyerTotal)}</p>
            <p className="text-xs" style={{ color: '#6B7280' }}>Loyer/mois</p>
          </div>
        </div>

        {/* ══ TOGGLE VUE + FILTRES ══ */}
        <div className="px-6 py-4 border-b" style={{ borderColor: '#E8F5EC' }}>
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Toggle Par Unité / Par Client */}
            <div className="flex rounded-lg overflow-hidden border-2" style={{ borderColor: '#E8F5EC' }}>
              <button
                onClick={() => setViewMode('unites')}
                className="px-4 py-2 text-sm font-medium transition-all"
                style={viewMode === 'unites'
                  ? { background: '#1A6B35', color: 'white' }
                  : { background: 'white', color: '#4B5563' }}
              >
                🏠 Par Unité
              </button>
              <button
                onClick={() => setViewMode('clients')}
                className="px-4 py-2 text-sm font-medium transition-all"
                style={viewMode === 'clients'
                  ? { background: '#1A6B35', color: 'white' }
                  : { background: 'white', color: '#4B5563' }}
              >
                👤 Par Client
              </button>
            </div>
            {/* Recherche */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={18} style={{ color: '#6B7280' }} />
              <input
                type="text"
                placeholder={viewMode === 'clients' ? 'Rechercher un client ou unité...' : 'Rechercher une unité...'}
                value={searchUnite}
                onChange={(e) => setSearchUnite(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border-2 rounded-lg outline-none"
                style={{ borderColor: '#E8F5EC' }}
              />
            </div>
            {viewMode === 'unites' && (
              <select
                value={filterStatut}
                onChange={(e) => setFilterStatut(e.target.value)}
                className="px-4 py-2 border-2 rounded-lg outline-none"
                style={{ borderColor: '#E8F5EC', minWidth: '140px' }}
              >
                <option value="">Tous les statuts</option>
                <option value="VACANT">Vacant</option>
                <option value="RESERVE">Réservé</option>
                <option value="OCCUPE">Occupé</option>
              </select>
            )}
            {(searchUnite || filterStatut) && (
              <button onClick={() => { setSearchUnite(''); setFilterStatut('') }}
                className="px-3 py-2 text-sm rounded-lg"
                style={{ background: '#F3F4F6', color: '#4B5563' }}>Réinit.</button>
            )}
          </div>
        </div>

        {/* ══ VUE PAR UNITÉ ══ */}
        {viewMode === 'unites' && (
        <div className="p-6">
          <h3 className="font-semibold mb-4" style={{ color: '#0D3B1F' }}>
            Liste des unités ({filteredUnites.length})
          </h3>
          
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-t-transparent" style={{ borderColor: '#1A6B35' }} />
            </div>
          ) : filteredUnites.length === 0 ? (
            <div className="text-center py-12" style={{ background: '#F9FAFB', borderRadius: '12px' }}>
              <Home size={48} className="mx-auto mb-3" style={{ color: '#9CA3AF' }} />
              <p style={{ color: '#6B7280' }}>
                {unites.length === 0 ? 'Aucune unité dans cet immeuble' : 'Aucune unité correspondant aux filtres'}
              </p>
              {unites.length === 0 && (
                <button
                  onClick={onAddUnite}
                  className="mt-4 px-4 py-2 rounded-lg text-white font-medium transition-all"
                  style={{ background: '#1A6B35' }}
                >
                  <Plus size={16} className="inline mr-2" />
                  Ajouter la première unité
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {safeMap(filteredUnites, (unite, index) => (
                <div 
                  key={unite.id}
                  className="p-4 rounded-xl transition-all hover:shadow-lg hover:scale-105 animate-slideIn"
                  style={{ 
                    background: 'white', 
                    border: '2px solid #E8F5EC',
                    borderLeft: `6px solid ${unite.statut === 'OCCUPE' ? '#10B981' : unite.statut === 'RESERVE' ? '#F59E0B' : '#6B7280'}`,
                    animationDelay: `${index * 50}ms`
                  }}
                >
                  {/* En-tête avec numéro et statut */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center font-bold"
                        style={{ 
                          background: unite.statut === 'OCCUPE' ? '#DCFCE7' : unite.statut === 'RESERVE' ? '#FEF3C7' : '#F3F4F6',
                          color: unite.statut === 'OCCUPE' ? '#166534' : unite.statut === 'RESERVE' ? '#92400E' : '#4B5563'
                        }}
                      >
                        {unite.numeroPorte?.substring(0, 2) || '?'}
                      </div>
                      <div>
                        <span className="font-bold text-lg block" style={{ color: '#0D3B1F' }}>
                          {unite.numeroPorte || 'N/A'}
                        </span>
                        <span className="text-xs" style={{ color: '#6B7280' }}>
                          {getTypeUniteLabel(unite.typeUnite)}
                        </span>
                      </div>
                    </div>
                    
                    <span 
                      className="px-2 py-1 rounded-full text-xs font-bold animate-pulse"
                      style={{ 
                        background: unite.statut === 'OCCUPE' ? '#DCFCE7' : unite.statut === 'RESERVE' ? '#FEF3C7' : '#F3F4F6',
                        color: unite.statut === 'OCCUPE' ? '#166534' : unite.statut === 'RESERVE' ? '#92400E' : '#4B5563'
                      }}
                    >
                      {unite.statut === 'OCCUPE' ? '✓ Occupé' : unite.statut === 'RESERVE' ? '⏳ Réservé' : '○ Vacant'}
                    </span>
                  </div>

                  {/* Détails */}
                  <div className="space-y-2 mb-3">
                    <div className="flex items-center gap-2 text-sm" style={{ color: '#6B7280' }}>
                      <MapPin size={14} style={{ color: '#1A6B35' }} />
                      <span>Étage {unite.etage || 0}</span>
                    </div>
                    {unite.surface && (
                      <div className="flex items-center gap-2 text-sm" style={{ color: '#6B7280' }}>
                        <Layers size={14} style={{ color: '#1A6B35' }} />
                        <span>{unite.surface} m²</span>
                      </div>
                    )}
                  </div>

                  {/* Droit de terre */}
                  <div className="p-3 rounded-lg mb-3" style={{ background: 'linear-gradient(135deg, #E8F5EC 0%, #F0FDF4 100%)' }}>
                    <p className="text-xs mb-1" style={{ color: '#6B7280' }}>Droit de terre mensuel</p>
                    <p className="font-bold text-xl" style={{ color: '#1A6B35' }}>
                      {formatCurrency(unite.loyerBase || 0)}/mois
                    </p>
                  </div>

                  {/* Client occupant */}
                  {(() => {
                    const lease = leasesMap[unite.id]
                    if (!lease) return (
                      <div className="p-2 rounded-lg mb-3 text-center" style={{ background: '#F9FAFB', border: '1px dashed #D1D5DB' }}>
                        <p className="text-xs" style={{ color: '#9CA3AF' }}>Porte vacante</p>
                      </div>
                    )
                    return (
                      <div className="p-2.5 rounded-lg mb-3" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                        <p className="text-xs font-semibold mb-0.5" style={{ color: '#1D4ED8' }}>👤 Occupant</p>
                        <p className="text-sm font-bold" style={{ color: '#1E3A5F' }}>{lease.client?.prenom || lease.client_prenom || ''} {lease.client?.nom || lease.client_nom || ''}</p>
                        <p className="text-xs" style={{ color: '#3B82F6' }}>{lease.numeroBail || ''}</p>
                      </div>
                    )
                  })()}
                  
                  <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t" style={{ borderColor: '#F3F4F6' }}>
                    <select
                      value={unite.statut}
                      onChange={(e) => handleStatutChange(unite.id, e.target.value)}
                      className="px-2 py-1 rounded text-xs border outline-none"
                      style={{ borderColor: '#E8F5EC' }}
                    >
                      <option value="VACANT">Vacant</option>
                      <option value="RESERVE">Réservé</option>
                      <option value="OCCUPE">Occupé</option>
                    </select>
                    
                    <button
                      onClick={() => onEditUnite(unite)}
                      className="p-1.5 rounded transition-colors"
                      style={{ color: '#1D4ED8', background: '#DBEAFE' }}
                      title="Modifier"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteUnite(unite.id)}
                      className="p-1.5 rounded transition-colors"
                      style={{ color: '#DC2626', background: '#FEE2E2' }}
                      title="Supprimer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        )} {/* fin viewMode === 'unites' */}

        {/* ══ VUE PAR CLIENT ══ */}
        {viewMode === 'clients' && (
          <div className="p-6">
            <h3 className="font-semibold mb-4" style={{ color: '#0D3B1F' }}>
              Regroupement par client ({Object.keys(
                filteredUnites.reduce((acc, u) => {
                  const l = leasesMap[u.id]
                  if (l) acc[l.clientId || `${l.client?.prenom || l.client_prenom}-${l.client?.nom || l.client_nom}`] = true
                  return acc
                }, {})
              ).length} client(s) · {filteredUnites.filter(u => !leasesMap[u.id]).length} vacant(s))
            </h3>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-t-transparent" style={{ borderColor: '#1A6B35' }} />
              </div>
            ) : (() => {
              /* Grouper unités par client */
              const clientMap = {}
              filteredUnites.forEach(u => {
                const l = leasesMap[u.id]
                if (l) {
                  const key = l.clientId || `${l.client?.prenom || l.client_prenom}-${l.client?.nom || l.client_nom}`
                  if (!clientMap[key]) clientMap[key] = { nom: `${l.client?.prenom || l.client_prenom || ''} ${l.client?.nom || l.client_nom || ''}`.trim(), telephone: l.client?.telephone || l.client_telephone || '', unites: [] }
                  clientMap[key].unites.push({ unite: u, lease: l })
                }
              })
              const clientGroups = Object.entries(clientMap).sort((a, b) => a[1].nom.localeCompare(b[1].nom))
              const vacants = filteredUnites.filter(u => !leasesMap[u.id])

              return (
                <div className="space-y-3">
                  {/* Groupes par client */}
                  {clientGroups.map(([key, group]) => {
                    const collapsed = collapsedClients[key]
                    return (
                      <div key={key} className="rounded-xl overflow-hidden border-2" style={{ borderColor: '#E8F5EC' }}>
                        {/* En-tête client */}
                        <button
                          onClick={() => toggleClientGroup(key)}
                          className="w-full flex items-center justify-between px-4 py-3 transition-all"
                          style={{ background: 'linear-gradient(135deg, #F0FDF4, #DCFCE7)' }}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm" style={{ background: '#1A6B35', color: 'white' }}>
                              {group.nom.charAt(0) || '?'}
                            </div>
                            <div className="text-left">
                              <p className="font-bold text-sm" style={{ color: '#0D3B1F' }}>{group.nom}</p>
                              {group.telephone && <p className="text-xs" style={{ color: '#6B7280' }}>{group.telephone}</p>}
                            </div>
                            <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: '#DCFCE7', color: '#166534' }}>
                              {group.unites.length} unité(s)
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold" style={{ color: '#1A6B35' }}>
                              {formatCurrency(group.unites.reduce((s, { unite: u }) => s + (parseFloat(u?.loyerBase) || 0), 0))}
                            </span>
                            <span style={{ color: '#6B7280' }}>{collapsed ? '▶' : '▼'}</span>
                          </div>
                        </button>
                        {/* Unités du client */}
                        {!collapsed && (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-3" style={{ background: '#F9FAFB' }}>
                            {group.unites.map(({ unite: u, lease: l }) => (
                              <div key={u.id} className="p-3 rounded-lg bg-white border-l-4" style={{ borderColor: '#10B981', border: '1px solid #DCFCE7', borderLeft: '4px solid #10B981' }}>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-bold" style={{ color: '#0D3B1F' }}>{u.numeroPorte}</span>
                                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#DCFCE7', color: '#166534' }}>Occupé</span>
                                </div>
                                <p className="text-xs mb-1" style={{ color: '#6B7280' }}>{getTypeUniteLabel(u.typeUnite)}  ·  Étage {u.etage || 0}</p>
                                <p className="text-sm font-bold" style={{ color: '#1A6B35' }}>{formatCurrency(u.loyerBase || 0)}/mois</p>
                                <p className="text-xs mt-1" style={{ color: '#3B82F6' }}>Bail : {l.numeroBail || '—'}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Groupe Vacants */}
                  {vacants.length > 0 && (() => {
                    const key = '__vacants__'
                    const collapsed = collapsedClients[key]
                    return (
                      <div className="rounded-xl overflow-hidden border-2" style={{ borderColor: '#E5E7EB' }}>
                        <button
                          onClick={() => toggleClientGroup(key)}
                          className="w-full flex items-center justify-between px-4 py-3"
                          style={{ background: '#F9FAFB' }}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: '#F3F4F6', color: '#9CA3AF' }}>○</div>
                            <p className="font-bold text-sm" style={{ color: '#6B7280' }}>Unités vacantes</p>
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: '#F3F4F6', color: '#6B7280' }}>{vacants.length}</span>
                          </div>
                          <span style={{ color: '#6B7280' }}>{collapsed ? '▶' : '▼'}</span>
                        </button>
                        {!collapsed && (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-3" style={{ background: '#FAFAFA' }}>
                            {vacants.map(u => (
                              <div key={u.id} className="p-3 rounded-lg bg-white border-l-4" style={{ border: '1px solid #F3F4F6', borderLeft: '4px solid #D1D5DB' }}>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-bold" style={{ color: '#374151' }}>{u.numeroPorte}</span>
                                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#F3F4F6', color: '#6B7280' }}>Vacant</span>
                                </div>
                                <p className="text-xs mb-1" style={{ color: '#9CA3AF' }}>{getTypeUniteLabel(u.typeUnite)}  ·  Étage {u.etage || 0}</p>
                                <p className="text-sm font-bold" style={{ color: '#6B7280' }}>{formatCurrency(u.loyerBase || 0)}/mois</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              )
            })()}
          </div>
        )}

        {/* ══ CLIENTS ATTRIBUÉS (bas de page) ══ */}
        {leases.length > 0 && (
          <div className="px-6 py-4 border-t" style={{ borderColor: '#E8F5EC', background: '#F9FAFB' }}>
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2" style={{ color: '#0D3B1F' }}>
              👥 Clients attribués
              <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: '#DCFCE7', color: '#166534' }}>{leases.length}</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {leases.map((lease, i) => (
                <div key={lease.id || i} className="flex items-center justify-between p-2.5 rounded-lg bg-white border" style={{ borderColor: '#E8F5EC' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: '#DCFCE7', color: '#166534' }}>
                      {(lease.client?.prenom || lease.client_prenom || '?')[0]}{(lease.client?.nom || lease.client_nom || '?')[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: '#0D3B1F' }}>{lease.client?.prenom || lease.client_prenom} {lease.client?.nom || lease.client_nom}</p>
                      <p className="text-xs" style={{ color: '#6B7280' }}>{lease.numeroBail || '—'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold" style={{ color: '#1A6B35' }}>{formatCurrency(lease.montantInitial || 0)}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{
                      background: lease.statut === 'ACTIF' ? '#DCFCE7' : '#FEF3C7',
                      color: lease.statut === 'ACTIF' ? '#166534' : '#92400E'
                    }}>{lease.statut || '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

// ============================================
// MODAL - FORMULAIRE UNITÉ
// ============================================
const UniteModal = ({ building, unite, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    numeroPorte: unite?.numeroPorte || '',
    typeUnite: unite?.typeUnite || 'STUDIO',
    etage: unite?.etage || 0,
    loyerBase: unite?.loyerBase || '',
    statut: unite?.statut || 'VACANT'
  })
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      const data = {
        ...formData,
        etage: parseInt(formData.etage) || 0,
        loyerBase: parseFloat(formData.loyerBase) || 0
      }

      // ÉTAPE 1 : Créer ou modifier l'unité
      if (unite) {
        await updateUnite(building.id, unite.id, data)
        console.log('✅ [UniteModal] Unité modifiée avec succès')
        toast.success('Unité modifiée avec succès')
      } else {
        const response = await createUnite(building.id, data)
        console.log('✅ [UniteModal] Unité créée - Réponse complète:', response)
        console.log('✅ [UniteModal] Données de l\'unité:', response?.data)
        toast.success('Unité créée avec succès')
      }
      
      // ÉTAPE 2 : Attendre que la BDD soit synchronisée
      console.log('⏳ [UniteModal] Attente de 400ms pour synchronisation BDD...')
      await new Promise(resolve => setTimeout(resolve, 400))
      
      // ÉTAPE 3 : Déclencher le rafraîchissement du DetailModal
      console.log('🔄 [UniteModal] Déclenchement du rafraîchissement...')
      if (onSuccess) {
        await onSuccess()
      }
      
      // ÉTAPE 4 : Fermer le modal
      console.log('✅ [UniteModal] Fermeture du modal')
      onClose()
    } catch (error) {
      console.error('[UniteModal] Erreur:', error)
      toast.error(error.response?.data?.message || 'Erreur lors de l\'enregistrement')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div 
        className="bg-white w-full max-w-md"
        style={{ borderRadius: '16px' }}
      >
        <div className="p-6 border-b" style={{ borderColor: '#E8F5EC' }}>
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold" style={{ color: '#0D3B1F' }}>
              {unite ? 'Modifier l\'unité' : 'Nouvelle unité'}
            </h2>
            <p className="text-sm" style={{ color: '#6B7280' }}>{building.nom}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0D3B1F' }}>
              Numéro de porte *
            </label>
            <input
              type="text"
              value={formData.numeroPorte}
              onChange={(e) => setFormData({...formData, numeroPorte: e.target.value})}
              className="w-full px-4 py-2 border-2 rounded-lg outline-none focus:border-midGreen"
              style={{ borderColor: '#E8F5EC' }}
              placeholder="Ex: A101, B205"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#0D3B1F' }}>
                Type *
              </label>
              <select
                value={formData.typeUnite}
                onChange={(e) => setFormData({...formData, typeUnite: e.target.value})}
                className="w-full px-4 py-2 border-2 rounded-lg outline-none focus:border-midGreen"
                style={{ borderColor: '#E8F5EC' }}
              >
                <option value="STUDIO">Studio</option>
                <option value="CHAMBRE">Chambre</option>
                <option value="CHAMBRE_SALON">Chambre-Salon</option>
                <option value="MAGASIN">Magasin</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#0D3B1F' }}>
                Étage *
              </label>
              <input
                type="number"
                min="0"
                value={formData.etage}
                onChange={(e) => setFormData({...formData, etage: e.target.value})}
                className="w-full px-4 py-2 border-2 rounded-lg outline-none focus:border-midGreen"
                style={{ borderColor: '#E8F5EC' }}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0D3B1F' }}>
              Droit de terre mensuel (FCFA/mois) *
            </label>
            <input
              type="number"
              min="0"
              value={formData.loyerBase}
              onChange={(e) => setFormData({...formData, loyerBase: e.target.value})}
              className="w-full px-4 py-2 border-2 rounded-lg outline-none focus:border-midGreen"
              style={{ borderColor: '#E8F5EC' }}
              required
            />
          </div>

          {unite && (
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#0D3B1F' }}>
                Statut
              </label>
              <select
                value={formData.statut}
                onChange={(e) => setFormData({...formData, statut: e.target.value})}
                className="w-full px-4 py-2 border-2 rounded-lg outline-none focus:border-midGreen"
                style={{ borderColor: '#E8F5EC' }}
              >
                <option value="VACANT">Vacant</option>
                <option value="RESERVE">Réservé</option>
                <option value="OCCUPE">Occupé</option>
              </select>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 py-3 font-medium rounded-lg transition-colors disabled:opacity-50"
              style={{ background: '#F3F4F6', color: '#4B5563' }}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-3 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: '#1A6B35' }}
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Enregistrement...
                </>
              ) : (
                unite ? 'Enregistrer' : 'Créer'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default BiensPage

// Styles CSS pour les animations
const styles = `
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-slideIn {
    animation: slideIn 0.3s ease-out forwards;
  }
`

// Injecter les styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style')
  styleSheet.textContent = styles
  document.head.appendChild(styleSheet)
}
