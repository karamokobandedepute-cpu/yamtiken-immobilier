import { useEffect, useState, useRef, useMemo } from 'react'
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Eye, 
  Download, 
  Trophy, 
  Users, 
  DollarSign, 
  TrendingUp,
  User,
  Phone,
  Mail,
  X,
  CheckCircle,
  Award,
  Briefcase,
  MapPin,
  FileText,
  Check,
  Printer
} from 'lucide-react'
import { 
  fetchReferrers, 
  fetchReferrer, 
  createReferrer, 
  updateReferrer, 
  deleteReferrer,
  fetchClassement,
  fetchCommissions,
  createCommission,
  payerCommission,
  deleteCommission,
  generateReferrerPDF,
  fetchClients
} from '../utils/api'
import { formatCurrency, formatDate, getStatutCommissionLabel, getStatutCommissionBadgeStyle, getTypeCommissionLabel } from '../utils/formatters'
import toast from 'react-hot-toast'
import jsPDF from 'jspdf'
import { addPdfHeader, addPdfFooter, addWatermark, COLORS } from '../utils/pdfUtils'
import { logDocGeneration } from '../utils/pdfLogger'
import { useAuthStore } from '../stores/authStore'

const CommissionsPage = () => {
  const { user } = useAuthStore()
  const [referrers, setReferrers] = useState([])
  const [classement, setClassement] = useState(null)
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showClassementModal, setShowClassementModal] = useState(false)
  const [selectedReferrer, setSelectedReferrer] = useState(null)
  const [activeTab, setActiveTab] = useState('apporteurs')
  
  const debounceTimer = useRef(null)
  const isMounted = useRef(false)

  // Chargement initial uniquement
  useEffect(() => {
    loadData()
  }, [])

  // Debounce pour la recherche
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true
      return
    }
    
    clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      loadData()
    }, 400)
    
    return () => clearTimeout(debounceTimer.current)
  }, [searchTerm])

  const loadData = async () => {
    try {
      setLoading(true)
      const params = {}
      if (searchTerm) params.search = searchTerm

      const [referrersRes, classementRes, clientsRes] = await Promise.allSettled([
        fetchReferrers(Object.keys(params).length > 0 ? params : undefined),
        fetchClassement(),
        fetchClients()
      ])

      if (referrersRes.status === 'fulfilled') {
        const d = referrersRes.value?.data
        setReferrers(Array.isArray(d) ? d : (d?.data || []))
      }
      if (classementRes.status === 'fulfilled') {
        setClassement(classementRes.value?.data || null)
      }
      if (clientsRes.status === 'fulfilled') {
        const d = clientsRes.value?.data
        setClients(Array.isArray(d) ? d : (d?.data || []))
      }

      const failed = [referrersRes, classementRes, clientsRes].filter(r => r.status === 'rejected')
      if (failed.length === 3) {
        toast.error('Erreur lors du chargement des données')
      }
    } catch (error) {
      console.error('[CommissionsPage] Erreur:', error)
      toast.error('Erreur lors du chargement des données')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet apporteur ?')) return
    
    try {
      await deleteReferrer(id)
      toast.success('Apporteur supprimé avec succès')
      loadData()
    } catch (error) {
      toast.error('Erreur lors de la suppression')
    }
  }

  const openModal = (referrer = null) => {
    setSelectedReferrer(referrer)
    setShowModal(true)
  }

  const openDetailModal = async (referrer) => {
    try {
      const response = await fetchReferrer(referrer.id)
      setSelectedReferrer(response.data)
      setShowDetailModal(true)
    } catch (error) {
      toast.error('Erreur lors du chargement des détails')
    }
  }

  // ── PDF RAPPORT GLOBAL TOUS APPORTEURS ──────────────────────────────────
  const generateRapportApporteurs = () => {
    try {
      const doc = new jsPDF('p', 'mm', 'a4')
      const W = doc.internal.pageSize.getWidth()
      const DARK = COLORS.darkGreen
      const GOLD = COLORS.gold
      const today = new Date().toLocaleDateString('fr-FR')

      // ── FILIGRANE + EN-TÊTE ──
      addWatermark(doc)
      addPdfHeader(doc, 'RAPPORT APPORTEURS D\'AFFAIRES', `Généré le ${today}`, user)

      // ── RÉSUMÉ GLOBAL ──
      let y = 44
      const totalClients = referrers.reduce((s, r) => s + (r.nbClients || 0), 0)
      const totalPercu   = referrers.reduce((s, r) => s + (r.commissionsPayees || 0), 0)
      const totalAttente = referrers.reduce((s, r) => s + (r.commissionsAttente || 0), 0)

      const kpis = [
        { label: 'Apporteurs actifs', val: referrers.length },
        { label: 'Clients envoyés',   val: totalClients },
        { label: 'Commissions perçues', val: Math.round(totalPercu).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' FCFA' },
        { label: 'En attente',         val: Math.round(totalAttente).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' FCFA' },
      ]
      const kw = (W - 30) / 4
      kpis.forEach((k, i) => {
        const x = 15 + i * kw
        doc.setFillColor(i < 2 ? COLORS.lightBg : (i === 2 ? '#DCFCE7' : '#FEF3C7'))
        doc.rect(x, y, kw - 3, 18, 'F')
        doc.setTextColor(DARK).setFontSize(14).setFont('Helvetica', 'bold')
        doc.text(String(k.val), x + (kw - 3) / 2, y + 10, { align: 'center' })
        doc.setFontSize(7).setFont('Helvetica', 'normal').setTextColor('#6B7280')
        doc.text(k.label, x + (kw - 3) / 2, y + 16, { align: 'center' })
      })
      y += 26

      // ── TITRE TABLE ──
      doc.setFontSize(11).setFont('Helvetica', 'bold').setTextColor(DARK)
      doc.text('DÉTAIL PAR APPORTEUR', 15, y)
      doc.setDrawColor(GOLD).setLineWidth(0.5).line(15, y + 2, W - 15, y + 2)
      y += 8

      // ── EN-TÊTES COLONNES ──
      const cols = [15, 65, 100, 135, 170]
      const headers = ['Apporteur', 'Contact', 'Clients', 'Perçu', 'En attente']
      doc.setFillColor(DARK)
      doc.rect(15, y - 4, W - 30, 8, 'F')
      doc.setTextColor(255, 255, 255).setFontSize(8).setFont('Helvetica', 'bold')
      headers.forEach((h, i) => doc.text(h, cols[i] + 2, y + 1))
      y += 8

      // ── LIGNES ──
      const fmt = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' F'
      referrers.forEach((r, idx) => {
        if (y > 265) { doc.addPage(); y = 20 }
        doc.setFillColor(idx % 2 === 0 ? '#FAFAFA' : '#FFFFFF')
        doc.rect(15, y - 4, W - 30, 8, 'F')
        doc.setDrawColor('#E5E7EB').setLineWidth(0.3).line(15, y + 4, W - 15, y + 4)
        doc.setTextColor(DARK).setFontSize(8).setFont('Helvetica', 'bold')
        doc.text(`${r.prenom || ''} ${r.nom || ''}`, cols[0] + 2, y + 1, { maxWidth: 46 })
        doc.setFont('Helvetica', 'normal').setTextColor('#374151')
        doc.text(r.contact || '-', cols[1] + 2, y + 1, { maxWidth: 32 })
        doc.text(String(r.nbClients || 0), cols[2] + 8, y + 1, { align: 'center' })
        doc.setTextColor('#10B981').setFont('Helvetica', 'bold')
        doc.text(fmt(r.commissionsPayees || 0), cols[3] + 2, y + 1, { maxWidth: 32 })
        doc.setTextColor('#C8960C')
        doc.text(fmt(r.commissionsAttente || 0), cols[4] + 2, y + 1, { maxWidth: 32 })
        y += 9
      })

      // ── TOTAL ──
      if (y > 255) { doc.addPage(); y = 20 }
      y += 4
      doc.setFillColor(DARK)
      doc.rect(15, y - 4, W - 30, 10, 'F')
      doc.setTextColor(255, 255, 255).setFontSize(9).setFont('Helvetica', 'bold')
      doc.text('TOTAL', cols[0] + 2, y + 2)
      doc.text(String(totalClients), cols[2] + 8, y + 2, { align: 'center' })
      doc.setTextColor('#86EFAC')
      doc.text(fmt(totalPercu), cols[3] + 2, y + 2)
      doc.setTextColor('#FCD34D')
      doc.text(fmt(totalAttente), cols[4] + 2, y + 2)

      // ── CLASSEMENT TOP 3 ──
      y += 20
      if (y > 240) { doc.addPage(); y = 20 }
      doc.setFontSize(11).setFont('Helvetica', 'bold').setTextColor(DARK)
      doc.text('TOP 3 — MEILLEURS APPORTEURS', 15, y)
      doc.setDrawColor(GOLD).setLineWidth(0.5).line(15, y + 2, W - 15, y + 2)
      y += 10
      const top3 = [...referrers].sort((a, b) => (b.commissionsPayees || 0) - (a.commissionsPayees || 0)).slice(0, 3)
      const medals = ['🥇', '🥈', '🥉']
      top3.forEach((r, i) => {
        doc.setFillColor(i === 0 ? '#FEF3C7' : i === 1 ? '#F3F4F6' : '#FEF9EC')
        doc.rect(15, y - 4, W - 30, 12, 'F')
        doc.setFontSize(9).setFont('Helvetica', 'bold').setTextColor(DARK)
        doc.text(`${medals[i]}  ${r.prenom} ${r.nom}`, 20, y + 1)
        doc.setFont('Helvetica', 'normal').setTextColor('#6B7280').setFontSize(8)
        doc.text(`${r.nbClients} clients  |  Perçu: ${fmt(r.commissionsPayees || 0)}  |  En attente: ${fmt(r.commissionsAttente || 0)}`, 20, y + 6)
        y += 14
      })

      // ── PIED DE PAGE sur chaque page ──
      const pages = doc.internal.getNumberOfPages()
      for (let p = 1; p <= pages; p++) {
        doc.setPage(p)
        addPdfFooter(doc, p, false, user)
      }

      doc.save(`RAPPORT-APPORTEURS-${new Date().toISOString().slice(0, 10)}.pdf`)
      logDocGeneration(user, 'PDF_GENERATED', `RAPPORT-APPORTEURS-${new Date().toISOString().slice(0,10)}.pdf`, 'commissions')
      toast.success('Rapport PDF généré avec succès')
    } catch (error) {
      console.error('Erreur rapport PDF:', error)
      toast.error('Erreur lors de la génération du rapport')
    }
  }

  // Générer PDF fiche apporteur
  const generatePDF = async (referrer) => {
    try {
      const response = await generateReferrerPDF(referrer.id)
      const data = response.data.data

      const doc = new jsPDF('p', 'mm', 'a4')
      const pageWidth = doc.internal.pageSize.getWidth()

      const darkGreen = COLORS.darkGreen
      const gold = COLORS.gold
      const lightGreen = COLORS.lightBg

      // ── FILIGRANE + EN-TÊTE ──
      addWatermark(doc)
      addPdfHeader(doc, 'FICHE APPORTEUR D\'AFFAIRES', 'IMMO MANAGER PRO')

      // Photo et identité
      let y = 44
      
      // Cadre photo (placeholder)
      doc.setDrawColor(darkGreen)
      doc.setLineWidth(0.5)
      doc.circle(30, y + 15, 15)
      doc.setTextColor(darkGreen)
      doc.setFontSize(8)
      doc.text('PHOTO', 30, y + 17, { align: 'center' })
      
      // Identité
      doc.setTextColor(darkGreen)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text(`${data.referrer.prenom} ${data.referrer.nom}`, 60, y + 8)
      
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(0, 0, 0)
      doc.text(`Tél: ${data.referrer.contact}`, 60, y + 16)
      if (data.referrer.email) {
        doc.text(`Email: ${data.referrer.email}`, 60, y + 22)
      }
      
      // Type commission
      y = 65
      doc.setFillColor(lightGreen)
      doc.rect(15, y, pageWidth - 30, 12, 'F')
      
      doc.setTextColor(darkGreen)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text(`Commission: ${data.referrer.tauxCommission}${data.referrer.typeCommission === 'POURCENTAGE' ? '%' : ' FCFA'} (${getTypeCommissionLabel(data.referrer.typeCommission)})`, 20, y + 8)
      
      // Section Clients apportés
      y = 85
      doc.setTextColor(darkGreen)
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('CLIENTS APPORTÉS', 15, y)
      
      // Ligne or
      doc.setDrawColor(gold)
      doc.setLineWidth(0.5)
      doc.line(15, y + 3, pageWidth - 15, y + 3)
      
      // Tableau clients
      y = 95
      const colNom = 20
      const colTelephone = 80
      const colStatut = 130
      const colLoyer = 170
      
      // En-têtes tableau
      doc.setFillColor(lightGreen)
      doc.rect(15, y - 5, pageWidth - 30, 8, 'F')
      
      doc.setTextColor(darkGreen)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.text('Nom', colNom, y)
      doc.text('Téléphone', colTelephone, y)
      doc.text('Statut', colStatut, y)
      doc.text('Loyer', colLoyer, y)
      
      y += 10
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(0, 0, 0)
      
      data.clients.forEach((client, index) => {
        if (y > 250) {
          doc.addPage()
          y = 20
        }
        
        const loyerTotal = client.leases?.reduce((sum, l) => sum + l.montantInitial, 0) || 0
        
        doc.text(`${client.prenom} ${client.nom}`, colNom, y)
        doc.text(client.telephone || '-', colTelephone, y)
        doc.text(client.statut || 'Actif', colStatut, y)
        doc.text(formatCurrency(loyerTotal), colLoyer, y)
        
        y += 7
      })
      
      // Section Commissions
      y += 10
      if (y > 220) {
        doc.addPage()
        y = 20
      }
      
      doc.setTextColor(darkGreen)
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('HISTORIQUE DES COMMISSIONS', 15, y)
      
      doc.setDrawColor(gold)
      doc.setLineWidth(0.5)
      doc.line(15, y + 3, pageWidth - 15, y + 3)
      
      // Récapitulatif financier
      y += 15
      doc.setFillColor(lightGreen)
      doc.rect(15, y - 5, pageWidth - 30, 35, 'F')
      
      doc.setTextColor(darkGreen)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text('RÉCAPITULATIF FINANCIER', pageWidth / 2, y, { align: 'center' })
      
      y += 10
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(0, 0, 0)
      
      const colLabel = 30
      const colValue = pageWidth - 30
      
      doc.text('Nombre de clients:', colLabel, y)
      doc.text(`${data.stats.nbClients}`, colValue, y, { align: 'right' })
      
      y += 7
      doc.text('Total commissions perçues:', colLabel, y)
      doc.setTextColor('#10B981')
      doc.setFont('helvetica', 'bold')
      doc.text(formatCurrency(data.stats.commissionsPayees), colValue, y, { align: 'right' })
      
      y += 7
      doc.setTextColor(0, 0, 0)
      doc.setFont('helvetica', 'normal')
      doc.text('Commissions en attente:', colLabel, y)
      doc.setTextColor('#C8960C')
      doc.setFont('helvetica', 'bold')
      doc.text(formatCurrency(data.stats.commissionsAttente), colValue, y, { align: 'right' })
      
      // Pied de page
      addPdfFooter(doc, null, true)
      
      doc.save(`FICHE-APPORTEUR-${data.referrer.nom}.pdf`)
      logDocGeneration(user, 'PDF_GENERATED', `FICHE-APPORTEUR-${data.referrer.nom}.pdf`, 'commissions', { referrer: data.referrer.nom })
      toast.success('Fiche PDF générée avec succès')
    } catch (error) {
      console.error('Erreur PDF:', error)
      toast.error('Erreur lors de la génération du PDF')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#0D3B1F' }}>Apporteurs d'Affaires</h1>
          <p className="text-gray-500">Gestion des commissions et classement des apporteurs</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={generateRapportApporteurs}
            disabled={referrers.length === 0}
            className="flex items-center gap-2 px-4 py-2 font-medium rounded-lg transition-all disabled:opacity-40"
            style={{ background: '#EFF6FF', color: '#1D4ED8' }}
            title="Imprimer le rapport de tous les apporteurs"
          >
            <Printer size={18} />
            Rapport PDF
          </button>
          <button
            onClick={() => setShowClassementModal(true)}
            className="flex items-center gap-2 px-4 py-2 font-medium rounded-lg transition-all"
            style={{ background: '#FEF3C7', color: '#92400E' }}
          >
            <Trophy size={18} />
            Classement
          </button>
          <button
            onClick={() => openModal()}
            className="flex items-center gap-2 px-4 py-2 text-white font-medium rounded-lg transition-all"
            style={{ background: '#1A6B35' }}
          >
            <Plus size={18} />
            Ajouter un apporteur
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div className="p-4 rounded-lg" style={{ background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={20} style={{ color: '#6B7280' }} />
            <input
              type="text"
              placeholder="Rechercher par nom, contact..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border-2 rounded-lg outline-none"
              style={{ borderColor: '#E8F5EC' }}
            />
          </div>
        </div>
      </div>

      {/* Grille de cartes Apporteurs */}
      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-transparent" style={{ borderColor: '#1A6B35' }} />
          <p className="text-gray-500 text-sm">Chargement des apporteurs...</p>
        </div>
      ) : referrers.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64" style={{ color: '#9CA3AF' }}>
          <Users size={48} className="mb-4" />
          <p>Aucun apporteur trouvé</p>
          <button 
            onClick={loadData}
            className="mt-4 px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 text-sm font-medium"
          >
            Rafraîchir
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {(referrers || []).map((referrer, idx) => (
            <div 
              key={`referrer-${referrer.id || idx}`}
              className="rounded-lg overflow-hidden transition-all hover:shadow-lg"
              style={{ background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
            >
              {/* Photo et nom */}
              <div className="p-4 text-center" style={{ background: '#F9FAFB' }}>
                <div 
                  className="w-20 h-20 rounded-full mx-auto mb-3 flex items-center justify-center"
                  style={{ background: '#E8F5EC' }}
                >
                  {referrer.photoUrl ? (
                    <img src={referrer.photoUrl} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <User size={32} style={{ color: '#1A6B35' }} />
                  )}
                </div>
                <h3 className="font-semibold" style={{ color: '#0D3B1F' }}>
                  {referrer.prenom} {referrer.nom}
                </h3>
                <p className="text-sm" style={{ color: '#6B7280' }}>
                  {referrer.commissionsAttente > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: '#FEF3C7', color: '#92400E' }}>
                      💰 En attente
                    </span>
                  )}
                </p>
              </div>

              {/* Stats */}
              <div className="p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm" style={{ color: '#6B7280' }}>Clients envoyés</span>
                  <span className="font-bold" style={{ color: '#0D3B1F' }}>{referrer.nbClients}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm" style={{ color: '#6B7280' }}>Commissions perçues</span>
                  <span className="font-bold" style={{ color: '#10B981' }}>
                    {formatCurrency(referrer.commissionsPayees)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm" style={{ color: '#6B7280' }}>En attente</span>
                  <span className="font-bold" style={{ color: '#C8960C' }}>
                    {formatCurrency(referrer.commissionsAttente)}
                  </span>
                </div>

                {/* Commission */}
                <div className="pt-2 border-t" style={{ borderColor: '#E8F5EC' }}>
                  <span className="text-xs" style={{ color: '#6B7280' }}>
                    Commission: {referrer.tauxCommission}{referrer.typeCommission === 'POURCENTAGE' ? '%' : ' FCFA'}
                  </span>
                </div>
              </div>

              {/* 4 Boutons */}
              <div className="p-3 grid grid-cols-4 gap-2" style={{ background: '#F9FAFB' }}>
                <button
                  onClick={() => openModal(referrer)}
                  className="p-2 rounded transition-colors"
                  style={{ background: '#DBEAFE', color: '#1D4ED8' }}
                  title="Modifier"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => openDetailModal(referrer)}
                  className="p-2 rounded transition-colors"
                  style={{ background: '#E8F5EC', color: '#1A6B35' }}
                  title="Voir détails"
                >
                  <Eye size={16} />
                </button>
                <button
                  onClick={() => generatePDF(referrer)}
                  className="p-2 rounded transition-colors"
                  style={{ background: '#FEF3C7', color: '#92400E' }}
                  title="Imprimer fiche"
                >
                  <Download size={16} />
                </button>
                <button
                  onClick={() => handleDelete(referrer.id)}
                  className="p-2 rounded transition-colors"
                  style={{ background: '#FEE2E2', color: '#DC2626' }}
                  title="Supprimer"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal - Ajouter/Modifier Apporteur */}
      {showModal && (
        <ReferrerModal 
          referrer={selectedReferrer}
          clients={clients}
          onClose={() => {
            setShowModal(false)
            setSelectedReferrer(null)
            loadData()
          }}
        />
      )}

      {/* Modal - Détail Apporteur */}
      {showDetailModal && selectedReferrer && (
        <DetailModal 
          referrer={selectedReferrer}
          onClose={() => setShowDetailModal(false)}
          onPrint={() => generatePDF(selectedReferrer)}
          onPayCommission={async (commissionId) => {
            try {
              await payerCommission(commissionId)
              toast.success('Commission marquée comme payée')
              openDetailModal(selectedReferrer)
            } catch (error) {
              toast.error('Erreur lors du paiement')
            }
          }}
        />
      )}

      {/* Modal - Classement */}
      {showClassementModal && classement && (
        <ClassementModal 
          classement={classement}
          onClose={() => setShowClassementModal(false)}
        />
      )}
    </div>
  )
}

// ============================================
// MODAL - AJOUTER/MODIFIER APPORTEUR
// ============================================
const ReferrerModal = ({ referrer, clients, onClose }) => {
  const [formData, setFormData] = useState({
    nom: referrer?.nom || '',
    prenom: referrer?.prenom || '',
    contact: referrer?.contact || '',
    email: referrer?.email || '',
    adresse: referrer?.adresse || '',
    photoUrl: referrer?.photoUrl || '',
    tauxCommission: referrer?.tauxCommission || 5,
    typeCommission: referrer?.typeCommission || 'POURCENTAGE',
    isActive: referrer?.isActive !== false,
    clientIds: referrer?.clients?.map(c => c.id) || []
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (referrer) {
        await updateReferrer(referrer.id, formData)
        toast.success('Apporteur modifié avec succès')
      } else {
        await createReferrer(formData)
        toast.success('Apporteur créé avec succès')
      }
      onClose()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Erreur lors de l\'enregistrement')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b" style={{ borderColor: '#E8F5EC' }}>
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold" style={{ color: '#0D3B1F' }}>
              {referrer ? 'Modifier l\'apporteur' : 'Nouvel apporteur'}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
              <X size={24} style={{ color: '#6B7280' }} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#0D3B1F' }}>Nom *</label>
              <input
                type="text"
                value={formData.nom}
                onChange={(e) => setFormData({...formData, nom: e.target.value})}
                className="w-full px-4 py-2 border-2 rounded-lg outline-none"
                style={{ borderColor: '#E8F5EC' }}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#0D3B1F' }}>Prénom *</label>
              <input
                type="text"
                value={formData.prenom}
                onChange={(e) => setFormData({...formData, prenom: e.target.value})}
                className="w-full px-4 py-2 border-2 rounded-lg outline-none"
                style={{ borderColor: '#E8F5EC' }}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0D3B1F' }}>Contact *</label>
            <input
              type="tel"
              value={formData.contact}
              onChange={(e) => setFormData({...formData, contact: e.target.value})}
              className="w-full px-4 py-2 border-2 rounded-lg outline-none"
              style={{ borderColor: '#E8F5EC' }}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0D3B1F' }}>Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full px-4 py-2 border-2 rounded-lg outline-none"
              style={{ borderColor: '#E8F5EC' }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0D3B1F' }}>Adresse</label>
            <textarea
              value={formData.adresse}
              onChange={(e) => setFormData({...formData, adresse: e.target.value})}
              rows={2}
              className="w-full px-4 py-2 border-2 rounded-lg outline-none"
              style={{ borderColor: '#E8F5EC' }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#0D3B1F' }}>Commission</label>
              <input
                type="number"
                step="0.1"
                value={formData.tauxCommission}
                onChange={(e) => setFormData({...formData, tauxCommission: e.target.value})}
                className="w-full px-4 py-2 border-2 rounded-lg outline-none"
                style={{ borderColor: '#E8F5EC' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#0D3B1F' }}>Type</label>
              <select
                value={formData.typeCommission}
                onChange={(e) => setFormData({...formData, typeCommission: e.target.value})}
                className="w-full px-4 py-2 border-2 rounded-lg outline-none"
                style={{ borderColor: '#E8F5EC' }}
              >
                <option value="POURCENTAGE">Pourcentage (%)</option>
                <option value="FIXE">Montant fixe (FCFA)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
              className="w-4 h-4"
              style={{ accentColor: '#1A6B35' }}
            />
            <label htmlFor="isActive" className="text-sm" style={{ color: '#0D3B1F' }}>Actif</label>
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
              {referrer ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============================================
// MODAL - DÉTAIL APPORTEUR
// ============================================
const DetailModal = ({ referrer, onClose, onPayCommission, onPrint }) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-3xl rounded-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b" style={{ borderColor: '#E8F5EC' }}>
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <div 
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: '#E8F5EC' }}
              >
                {referrer.photoUrl ? (
                  <img src={referrer.photoUrl} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <User size={32} style={{ color: '#1A6B35' }} />
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold" style={{ color: '#0D3B1F' }}>
                  {referrer.prenom} {referrer.nom}
                </h2>
                <p className="text-sm" style={{ color: '#6B7280' }}>
                  {getTypeCommissionLabel(referrer.typeCommission)}: {referrer.tauxCommission}{referrer.typeCommission === 'POURCENTAGE' ? '%' : ' FCFA'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onPrint}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                style={{ background: '#EFF6FF', color: '#1D4ED8' }}
                title="Imprimer la fiche de cet apporteur"
              >
                <Printer size={16} />
                Imprimer
              </button>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
                <X size={24} style={{ color: '#6B7280' }} />
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="p-3 rounded-lg text-center" style={{ background: '#F9FAFB' }}>
              <p className="text-xl font-bold" style={{ color: '#0D3B1F' }}>{referrer.stats?.nbClients ?? 0}</p>
              <p className="text-xs" style={{ color: '#6B7280' }}>Clients</p>
            </div>
            <div className="p-3 rounded-lg text-center" style={{ background: '#F0FDF4' }}>
              <p className="text-xl font-bold" style={{ color: '#10B981' }}>
                {formatCurrency(referrer.stats?.commissionsPayees ?? 0)}
              </p>
              <p className="text-xs" style={{ color: '#6B7280' }}>Perçu</p>
            </div>
            <div className="p-3 rounded-lg text-center" style={{ background: '#FEF3C7' }}>
              <p className="text-xl font-bold" style={{ color: '#C8960C' }}>
                {formatCurrency(referrer.stats?.commissionsAttente ?? 0)}
              </p>
              <p className="text-xs" style={{ color: '#6B7280' }}>En attente</p>
            </div>
            <div className="p-3 rounded-lg text-center" style={{ background: '#DBEAFE' }}>
              <p className="text-xl font-bold" style={{ color: '#1D4ED8' }}>
                {formatCurrency(referrer.stats?.totalCommissions ?? 0)}
              </p>
              <p className="text-xs" style={{ color: '#6B7280' }}>Total</p>
            </div>
          </div>

          {/* Liste des clients apportés */}
          <div>
            <h3 className="font-semibold mb-3" style={{ color: '#0D3B1F' }}>
              <Users size={18} className="inline mr-2" />
              Clients apportés ({(referrer.clients || []).length})
            </h3>
            {(referrer.clients || []).length > 0 ? (
              <div className="overflow-x-auto rounded-lg border" style={{ borderColor: '#E8F5EC' }}>
                <table className="w-full">
                  <thead style={{ background: '#F9FAFB' }}>
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-medium" style={{ color: '#6B7280' }}>Nom</th>
                      <th className="px-4 py-2 text-left text-sm font-medium" style={{ color: '#6B7280' }}>Type</th>
                      <th className="px-4 py-2 text-left text-sm font-medium" style={{ color: '#6B7280' }}>Statut</th>
                      <th className="px-4 py-2 text-left text-sm font-medium" style={{ color: '#6B7280' }}>Baux</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: '#E8F5EC' }}>
                    {(referrer.clients || []).map((client, ci) => (
                      <tr key={`client-detail-${client.id || ci}`} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm" style={{ color: '#374151' }}>
                          {client.prenom} {client.nom}
                        </td>
                        <td className="px-4 py-2 text-sm" style={{ color: '#6B7280' }}>
                          {client.typeClient}
                        </td>
                        <td className="px-4 py-2">
                          <span 
                            className="px-2 py-1 rounded text-xs"
                            style={{ 
                              background: client.statut === 'ACTIF' ? '#DCFCE7' : '#F3F4F6',
                              color: client.statut === 'ACTIF' ? '#166534' : '#6B7280'
                            }}
                          >
                            {client.statut}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm" style={{ color: '#6B7280' }}>
                          {client.leases?.length || 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm" style={{ color: '#9CA3AF' }}>Aucun client associé</p>
            )}
          </div>

          {/* Historique commissions */}
          <div>
            <h3 className="font-semibold mb-3" style={{ color: '#0D3B1F' }}>
              <DollarSign size={18} className="inline mr-2" />
              Historique des commissions ({(referrer.commissions || []).length})
            </h3>
            {(referrer.commissions || []).length > 0 ? (
              <div className="overflow-x-auto rounded-lg border" style={{ borderColor: '#E8F5EC' }}>
                <table className="w-full">
                  <thead style={{ background: '#F9FAFB' }}>
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-medium" style={{ color: '#6B7280' }}>Client</th>
                      <th className="px-4 py-2 text-left text-sm font-medium" style={{ color: '#6B7280' }}>Montant</th>
                      <th className="px-4 py-2 text-left text-sm font-medium" style={{ color: '#6B7280' }}>Date</th>
                      <th className="px-4 py-2 text-left text-sm font-medium" style={{ color: '#6B7280' }}>Statut</th>
                      <th className="px-4 py-2 text-center text-sm font-medium" style={{ color: '#6B7280' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: '#E8F5EC' }}>
                    {(referrer.commissions || []).map((commission, ci) => (
                      <tr key={`commission-${commission.id || ci}`} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm" style={{ color: '#374151' }}>
                          {commission.client?.prenom || ''} {commission.client?.nom || 'Client inconnu'}
                        </td>
                        <td className="px-4 py-2 text-sm font-medium" style={{ color: '#0D3B1F' }}>
                          {formatCurrency(commission.montant)}
                        </td>
                        <td className="px-4 py-2 text-sm" style={{ color: '#6B7280' }}>
                          {commission.datePaiement ? formatDate(commission.datePaiement) : '-'}
                        </td>
                        <td className="px-4 py-2">
                          <span 
                            className="px-2 py-1 rounded text-xs font-medium"
                            style={getStatutCommissionBadgeStyle(commission.statut)}
                          >
                            {getStatutCommissionLabel(commission.statut)}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-center">
                          {commission.statut === 'EN_ATTENTE' && (
                            <button
                              onClick={() => onPayCommission(commission.id)}
                              className="p-1.5 rounded transition-colors"
                              style={{ background: '#DCFCE7', color: '#166534' }}
                              title="Marquer comme payée"
                            >
                              <Check size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm" style={{ color: '#9CA3AF' }}>Aucune commission enregistrée</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// MODAL - CLASSEMENT
// ============================================
const ClassementModal = ({ classement, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-3xl rounded-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b" style={{ borderColor: '#E8F5EC' }}>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div 
                className="p-2 rounded-lg"
                style={{ background: '#FEF3C7' }}
              >
                <Trophy size={24} style={{ color: '#C8960C' }} />
              </div>
              <div>
                <h2 className="text-xl font-bold" style={{ color: '#0D3B1F' }}>Classement des Apporteurs</h2>
                <p className="text-sm" style={{ color: '#6B7280' }}>
                  Total: {classement.totalApporteurs} apporteurs actifs
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
              <X size={24} style={{ color: '#6B7280' }} />
            </button>
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top par nombre de clients */}
          <div>
            <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: '#0D3B1F' }}>
              <Users size={18} style={{ color: '#1A6B35' }} />
              🏆 Top par clients envoyés
            </h3>
            <div className="space-y-3">
              {(classement.topByClients || []).map((referrer, index) => (
                <div 
                  key={referrer.id}
                  className="flex items-center gap-3 p-3 rounded-lg"
                  style={{ background: index === 0 ? '#FEF3C7' : '#F9FAFB' }}
                >
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
                    style={{ 
                      background: index === 0 ? '#C8960C' : index === 1 ? '#9CA3AF' : index === 2 ? '#B45309' : '#E8F5EC',
                      color: index < 3 ? 'white' : '#0D3B1F'
                    }}
                  >
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium" style={{ color: '#0D3B1F' }}>
                      {referrer.prenom} {referrer.nom}
                    </p>
                    <p className="text-xs" style={{ color: '#6B7280' }}>
                      {referrer.nbClients} clients • {formatCurrency(referrer.totalCommissions)}
                    </p>
                  </div>
                  {index === 0 && <Award size={20} style={{ color: '#C8960C' }} />}
                </div>
              ))}
            </div>
          </div>

          {/* Top par chiffre d'affaires */}
          <div>
            <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: '#0D3B1F' }}>
              <Briefcase size={18} style={{ color: '#1A6B35' }} />
              💼 Top par chiffre d'affaires
            </h3>
            <div className="space-y-3">
              {(classement.topByCA || []).map((referrer, index) => (
                <div 
                  key={referrer.id}
                  className="flex items-center gap-3 p-3 rounded-lg"
                  style={{ background: index === 0 ? '#FEF3C7' : '#F9FAFB' }}
                >
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
                    style={{ 
                      background: index === 0 ? '#C8960C' : index === 1 ? '#9CA3AF' : index === 2 ? '#B45309' : '#E8F5EC',
                      color: index < 3 ? 'white' : '#0D3B1F'
                    }}
                  >
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium" style={{ color: '#0D3B1F' }}>
                      {referrer.prenom} {referrer.nom}
                    </p>
                    <p className="text-xs" style={{ color: '#6B7280' }}>
                      CA: {formatCurrency(referrer.chiffreAffaires)} • {referrer.nbClients} clients
                    </p>
                  </div>
                  {index === 0 && <Award size={20} style={{ color: '#C8960C' }} />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CommissionsPage
