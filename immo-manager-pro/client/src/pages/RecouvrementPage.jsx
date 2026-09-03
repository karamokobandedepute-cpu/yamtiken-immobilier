import { useEffect, useState, useRef } from 'react'
import { 
  DollarSign, 
  TrendingUp, 
  AlertTriangle, 
  FileText, 
  Plus, 
  Search, 
  Phone, 
  User, 
  Home, 
  Calendar, 
  Download, 
  X, 
  CheckCircle,
  CreditCard,
  FileDown,
  Printer,
  Building2,
  MapPin,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Landmark,
  MessageSquare
} from 'lucide-react'
import { safeMap, safeFilter, safeGet, extractApiData, getErrorMessage } from '../utils/safetyHelpers'
import ConfirmationEncaissementModal from '../components/ConfirmationEncaissementModal'
import ClientBailCard from '../components/ClientBailCard'
import { 
  fetchRecouvrementDashboard, 
  fetchClientsRetard, 
  createEncaissementRapide,
  fetchStatistiquesMensuelles,
  fetchLeases,
  fetchDroitsTerre
} from '../utils/api'
import { formatCurrency, formatDate, formatPhone, getModePaiementLabel } from '../utils/formatters'
import toast from 'react-hot-toast'
import jsPDF from 'jspdf'
import { addPdfHeader, addPdfFooter, addWatermark, addSectionTitle, addTable, addInfoCard, checkPageBreak, COLORS } from '../utils/pdfUtils'
import logoSrc from '../assets/logo/logo behemoth.png'
import { logDocGeneration } from '../utils/pdfLogger'
import { useAuthStore } from '../stores/authStore'

const RecouvrementPage = () => {
  const [dashboardData, setDashboardData] = useState(null)
  const [clientsRetard, setClientsRetard] = useState([])
  const [leases, setLeases] = useState([])
  const [statsMensuelles, setStatsMensuelles] = useState(null)
  const [droitsTerreData, setDroitsTerreData] = useState(null)
  const [droitsTerreLoading, setDroitsTerreLoading] = useState(true)
  const [dtSearch, setDtSearch] = useState('')
  const [dtFilter, setDtFilter] = useState('all')
  const [collapsedBuildings, setCollapsedBuildings] = useState({})
  const toggleBuilding = (bid) => setCollapsedBuildings(prev => ({ ...prev, [bid]: !prev[bid] }))
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showEncaissementModal, setShowEncaissementModal] = useState(false)
  const [selectedClient, setSelectedClient] = useState(null)
  const [showConfirmationModal, setShowConfirmationModal] = useState(false)
  const [lastPaymentData, setLastPaymentData] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    setDroitsTerreLoading(true)
    try {
      const [dashRes, clientsRes, leasesRes, dtRes] = await Promise.allSettled([
        fetchRecouvrementDashboard(),
        fetchClientsRetard(),
        fetchLeases(),
        fetchDroitsTerre()
      ])
      if (dashRes.status === 'fulfilled') {
        setDashboardData(dashRes.value.data?.data || dashRes.value.data || null)
      }
      if (clientsRes.status === 'fulfilled') {
        const cData = clientsRes.value.data?.data || clientsRes.value.data || []
        setClientsRetard(Array.isArray(cData) ? cData : [])
      }
      if (leasesRes.status === 'fulfilled') {
        const lData = leasesRes.value.data?.data || leasesRes.value.data || []
        setLeases(Array.isArray(lData) ? lData : [])
      }
      if (dtRes.status === 'fulfilled') {
        setDroitsTerreData(dtRes.value.data || null)
      }
    } catch (error) {
      toast.error('Erreur lors du chargement des données de recouvrement')
    } finally {
      setLoading(false)
      setDroitsTerreLoading(false)
    }
  }

  const handleRelanceSMS = async (leaseId) => {
    try {
      toast.loading('Envoi du SMS...', { id: 'sms' })
      const res = await api.post(`/recouvrement/relance/${leaseId}`)
      toast.success(res.data.message || 'SMS envoyé avec succès', { id: 'sms' })
    } catch (error) {
      toast.error(error.response?.data?.message || 'Erreur lors de l\'envoi du SMS', { id: 'sms' })
    }
  }
  
  const handleEncaisser = (client) => {
    setSelectedClient(client)
    setShowEncaissementModal(true)
  }
  
  const handleSupprimer = (id) => {
    if (!confirm('Supprimer ce client de la liste ?')) return
    setClientsRetard(prev => prev.filter(c => c.id !== id))
    toast.success('✅ Client retiré de la liste')
  }
  
  const handleImprimer = (client) => {
    toast.loading('🖨️ Génération du PDF...')
    setTimeout(() => {
      toast.success('✅ Fiche de recouvrement générée')
    }, 1000)
  }
  
  const handleVisualiser = (client) => {
    toast.info(`📋 Détails: ${client.client.prenom} ${client.client.nom} - ${formatCurrency(client.soldeDu)} dû`)
  }

  // Filtrer les clients par recherche
  const filteredClients = clientsRetard.filter(client => {
    if (!client?.client || !client?.bien) return false
    const search = searchTerm.toLowerCase()
    return (
      (client.client.nom || '').toLowerCase().includes(search) ||
      (client.client.prenom || '').toLowerCase().includes(search) ||
      (client.client.telephone || '').includes(search) ||
      (client.bien.numeroBail || '').toLowerCase().includes(search)
    )
  })

  // Déterminer la couleur de la ligne selon le retard
  const getRowColor = (joursRetard) => {
    if (joursRetard > 30) return { bg: '#FEE2E2', border: '#DC2626', text: '#DC2626' } // Rouge
    if (joursRetard >= 8) return { bg: '#FEF3C7', border: '#C8960C', text: '#C8960C' } // Orange
    return { bg: '#F0FDF4', border: '#10B981', text: '#10B981' } // Vert
  }

  // Générer reçu PDF A5
  const generateRecuPDF = (paymentData) => {
    
    try {
      if (!paymentData || !paymentData.payment) {
        throw new Error('Données de paiement manquantes')
      }
      
      const doc = new jsPDF('p', 'mm', [148, 210]) // Format A5
      const { payment, stats } = paymentData
    
    const darkGreen = COLORS.darkGreen
    const gold = COLORS.gold
    const lightGreen = COLORS.lightBg

    // ── FILIGRANE SUBTIL ──
    addWatermark(doc)

    // Bordure verte
    doc.setDrawColor(darkGreen)
    doc.setLineWidth(0.8)
    doc.rect(4, 4, 140, 202)
    // Bordure dorée intérieure
    doc.setDrawColor(gold)
    doc.setLineWidth(0.3)
    doc.rect(6, 6, 136, 198)
    
    // En-tête avec logo
    doc.setFillColor(darkGreen)
    doc.rect(4, 4, 140, 28, 'F')
    doc.setFillColor(gold)
    doc.rect(4, 30, 140, 1.5, 'F')

    // Logo à gauche
    try { doc.addImage(logoSrc, 'PNG', 8, 7, 20, 20) } catch (e) {}

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text('YAMTIKEN BEHEMOTH', 74, 16, { align: 'center' })
    
    doc.setFontSize(8)
    doc.setTextColor(gold)
    doc.setFont('helvetica', 'normal')
    doc.text('IMMO MANAGER PRO  —  Abidjan, Côte d\'Ivoire', 74, 23, { align: 'center' })
    
    // Titre reçu
    doc.setTextColor(gold)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('REÇU DE PAIEMENT', 74, 38, { align: 'center' })
    
    doc.setTextColor(darkGreen)
    doc.setFontSize(10)
    doc.text(`N° ${payment.numeroFacture}`, 74, 45, { align: 'center' })
    
    // Ligne or
    doc.setDrawColor(gold)
    doc.setLineWidth(0.5)
    doc.line(20, 50, 128, 50)
    
    // Client
    let y = 60
    doc.setTextColor(darkGreen)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('CLIENT', 15, y)
    
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(11)
    doc.text(`${payment.lease.client.prenom} ${payment.lease.client.nom}`, 15, y + 6)
    doc.setFontSize(9)
    doc.text(`Tél: ${payment.lease.client.telephone}`, 15, y + 12)
    
    // Bien
    y = 82
    doc.setTextColor(darkGreen)
    doc.setFont('helvetica', 'bold')
    doc.text('BIEN LOUÉ', 15, y)
    
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(0, 0, 0)
    doc.text(`Bail N°: ${payment.lease.numeroBail}`, 15, y + 6)
    doc.text(`Unité: #${payment.lease.uniteId}`, 15, y + 11)
    
    // Montant
    y = 105
    doc.setTextColor(darkGreen)
    doc.setFont('helvetica', 'bold')
    doc.text('MONTANT PAYÉ', 15, y)
    
    doc.setTextColor(gold)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text(`${formatCurrency(payment.montantVerse)}`, 74, y + 10, { align: 'center' })
    
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    const montantLettres = numberToWords(payment.montantVerse)
    doc.text(`(${montantLettres} francs CFA)`, 74, y + 17, { align: 'center' })
    
    // Détails
    y = 135
    doc.setTextColor(darkGreen)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('DÉTAILS', 15, y)
    
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(0, 0, 0)
    doc.text(`Mode: ${getModePaiementLabel(payment.modePaiement)}`, 15, y + 6)
    doc.text(`Date: ${formatDate(payment.datePaiement)}`, 15, y + 11)
    doc.text(`Heure: ${new Date(payment.datePaiement).toLocaleTimeString('fr-FR')}`, 15, y + 16)
    
    // Reste dû
    y = 160
    doc.setTextColor(darkGreen)
    doc.setFont('helvetica', 'bold')
    doc.text('SITUATION FINANCIÈRE', 15, y)
    
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(0, 0, 0)
    const montantTotal = (stats.totalPaye || 0) + (stats.resteDu || 0)
    doc.text(`Montant total: ${formatCurrency(montantTotal)}`, 15, y + 6)
    doc.text(`Total payé: ${formatCurrency(stats.totalPaye || 0)}`, 15, y + 11)
    doc.setTextColor((stats.resteDu || 0) > 0 ? '#DC2626' : '#10B981')
    doc.setFont('helvetica', 'bold')
    doc.text(`Reste dû: ${formatCurrency(stats.resteDu || 0)}`, 15, y + 16)
    
    // Agent
    y = 185
    doc.setTextColor(darkGreen)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('AGENT', 15, y)
    
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(0, 0, 0)
    const agentNom = payment.agent ? `${payment.agent.prenom} ${payment.agent.nom}` : 'Agent de Recouvrement'
    doc.text(agentNom, 15, y + 5)
    
    // Signature
    doc.text('Signature:', 90, y + 5)
    doc.line(105, y + 8, 135, y + 8)
    
    // Pied de page
    doc.setTextColor(darkGreen)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'italic')
    doc.text('YAMTIKEN BEHEMOTH - Votre partenaire immobilier', 74, 200, { align: 'center' })
    
    doc.save(`RECU-${payment.numeroFacture}.pdf`)
    logDocGeneration(user, 'PDF_GENERATED', `RECU-${payment.numeroFacture}.pdf`, 'recouvrement', { numeroFacture: payment.numeroFacture })
    toast.success('✅ Reçu PDF généré avec succès')
    
    } catch (error) {
      console.error('[generateRecuPDF] Erreur:', error)
      toast.error('❌ Erreur génération PDF: ' + error.message)
      throw error
    }
  }

  // Fonction utilitaire pour convertir nombre en lettres (simplifiée)
  const numberToWords = (num) => {
    if (num === 0) return 'zéro'
    // Version simplifiée - retourne le nombre formaté
    return num.toLocaleString('fr-FR')
  }

  // ============================================
  // EXPORT ÉTAT DES CRÉANCES PDF
  // ============================================
  const exportCreancesPDF = () => {
    try {
      const doc = new jsPDF('p', 'mm', 'a4')
      let y = 40

      const totalCreances = filteredClients.reduce((sum, c) => sum + c.montantDu, 0)
      const critiques = filteredClients.filter(c => c.joursRetard > 30).length
      const alertes = filteredClients.filter(c => c.joursRetard >= 8 && c.joursRetard <= 30).length

      addWatermark(doc)
      addPdfHeader(doc, 'ÉTAT DES CRÉANCES', `${filteredClients.length} client(s) - Total: ${formatCurrency(totalCreances)}`)

      // Résumé
      addInfoCard(doc, 'Critiques (>30j)', critiques.toString(), 20, y, 50)
      addInfoCard(doc, 'Alertes (8-30j)', alertes.toString(), 80, y, 50)
      addInfoCard(doc, 'À jour', (filteredClients.length - critiques - alertes).toString(), 140, y, 50)
      y += 25

      if (filteredClients.length === 0) {
        doc.setFontSize(12)
        doc.setTextColor('#9CA3AF')
        doc.text('Aucune créance à afficher', doc.internal.pageSize.getWidth() / 2, y + 20, { align: 'center' })
      } else {
        // Tableau des créances
        const data = filteredClients.map(c => [
          `${c.client.prenom} ${c.client.nom}`,
          c.client.telephone,
          c.bien.numeroBail,
          formatCurrency(c.montantDu),
          `${c.joursRetard}j`,
          c.joursRetard > 30 ? 'CRITIQUE' : c.joursRetard >= 8 ? 'ALERTE' : 'À JOUR'
        ])

        y = addTable(
          doc,
          ['Client', 'Téléphone', 'N° Bail', 'Montant dû', 'Retard', 'Catégorie'],
          data,
          y,
          [40, 35, 30, 35, 20, 30]
        )
      }

      addPdfFooter(doc)
      doc.save(`ETAT-CREANCES-${new Date().toISOString().slice(0, 10)}.pdf`)
      logDocGeneration(user, 'PDF_GENERATED', `ETAT-CREANCES-${new Date().toISOString().slice(0,10)}.pdf`, 'recouvrement')
      toast.success('État des créances exporté en PDF')
    } catch (error) {
      console.error('Erreur PDF:', error)
      toast.error('Erreur lors de l\'export PDF')
    }
  }

  // ============================================
  // GÉNÉRER LETTRE DE RELANCE PDF
  // ============================================
  const generateRelancePDF = (client) => {
    try {
      const doc = new jsPDF('p', 'mm', 'a4')
      let y = 40

      addWatermark(doc)
      addPdfHeader(doc, 'LETTRE DE RELANCE', '')

      // Date et lieu
      y += 10
      doc.setFontSize(10)
      doc.setTextColor('#6B7280')
      doc.setFont('helvetica', 'normal')
      doc.text(`Abidjan, le ${formatDate(new Date())}`, doc.internal.pageSize.getWidth() - 20, y, { align: 'right' })

      // Destinataire
      y += 15
      doc.setTextColor(COLORS.black)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text('À L\'ATTENTION DE', 20, y)
      y += 8
      doc.text(`${client.client.prenom} ${client.client.nom}`, 20, y)
      y += 6
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text(`Tél: ${client.client.telephone}`, 20, y)

      // Objet
      y += 15
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(COLORS.darkGreen)
      doc.text(`Objet: Relance de paiement - Bail N° ${client.bien.numeroBail}`, 20, y)

      // Corps de la lettre
      y += 15
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(COLORS.black)
      doc.setFontSize(10)

      const lines = [
        `Monsieur/Madame,`,
        '',
        `Nous vous rappelons que vous avez contracté un bail de location portant le numéro ${client.bien.numeroBail}.`,
        '',
        `À ce jour, nous constatons un retard de paiement de ${client.joursRetard} jour(s).`,
        `Le montant total dû s'élève à ${formatCurrency(client.montantDu)}.`,
        '',
        `Nous vous prions de bien vouloir régulariser votre situation dans les plus brefs délais.`,
        `En cas de non-paiement sous 15 jours, nous nous verrons dans l'obligation d'engager`,
        `des procédures de recouvrement.`,
        '',
        `Nous vous prions d'agréer, Monsieur/Madame, l'expression de nos salutations distinguées.`,
        '',
        `Le Service Recouvrement`
      ]

      lines.forEach(line => {
        doc.text(line, 20, y)
        y += 6
      })

      // Signature
      y += 15
      doc.setFont('helvetica', 'bold')
      doc.text('Signature:', 20, y)
      doc.line(35, y + 2, 80, y + 2)

      addPdfFooter(doc)
      doc.save(`RELANCE-${client.client.nom}-${client.bien.numeroBail}.pdf`)
      logDocGeneration(user, 'PDF_GENERATED', `RELANCE-${client.client.nom}.pdf`, 'recouvrement', { client: client.client.nom })
      toast.success('Lettre de relance générée avec succès')
    } catch (error) {
      console.error('Erreur PDF:', error)
      toast.error('Erreur lors de la génération de la lettre')
    }
  }

  // ============================================
  // RAPPORT D'ACTIVITÉ AGENT PDF
  // ============================================
  const generateAgentReportPDF = () => {
    try {
      const doc = new jsPDF('p', 'mm', 'a4')
      let y = 40

      const currentMonth = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
      addWatermark(doc)
      addPdfHeader(doc, 'RAPPORT D\'ACTIVITÉ', `Agent de Recouvrement - ${currentMonth}`)

      // KPIs
      y = addSectionTitle(doc, 'Synthèse mensuelle', y)

      const kpiData = [
        ['Total encaissé ce mois', formatCurrency(dashboardData?.encaisseMois || 0)],
        ['Total encaissé cette année', formatCurrency(dashboardData?.encaisseAnnee || 0)],
        ['Dossiers en retard', `${dashboardData?.dossiersRetard || 0} client(s)`],
        ['Taux de recouvrement', `${dashboardData?.tauxRecouvrement || 0}%`]
      ]
      y = addTable(doc, ['Indicateur', 'Valeur'], kpiData, y, [80, 80])

      // Liste des créances
      if (filteredClients.length > 0) {
        y += 5
        y = checkPageBreak(doc, y)
        y = addSectionTitle(doc, `Clients en retard (${filteredClients.length})`, y)

        const data = filteredClients.slice(0, 20).map(c => [
          `${c.client.prenom} ${c.client.nom}`,
          formatCurrency(c.montantDu),
          `${c.joursRetard}j`
        ])

        y = addTable(doc, ['Client', 'Montant dû', 'Retard'], data, y, [80, 50, 30])
      }

      addPdfFooter(doc)
      doc.save(`RAPPORT-AGENT-${new Date().toISOString().slice(0, 10)}.pdf`)
      logDocGeneration(user, 'PDF_GENERATED', `RAPPORT-AGENT-${new Date().toISOString().slice(0,10)}.pdf`, 'recouvrement')
      toast.success('Rapport d\'activité généré avec succès')
    } catch (error) {
      console.error('Erreur PDF:', error)
      toast.error('Erreur lors de la génération du rapport')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#0D3B1F' }}>Agent de Recouvrement</h1>
          <p className="text-gray-500">Gestion des encaissements et suivi des paiements</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportCreancesPDF}
            className="flex items-center gap-2 px-4 py-2 font-medium rounded-lg transition-all"
            style={{ background: '#FEF3C7', color: '#92400E' }}
            title="Exporter l'état des créances PDF"
          >
            <FileText size={18} />
            État créances
          </button>
          <button
            onClick={generateAgentReportPDF}
            className="flex items-center gap-2 px-4 py-2 font-medium rounded-lg transition-all"
            style={{ background: '#DBEAFE', color: '#1D4ED8' }}
            title="Générer rapport d'activité PDF"
          >
            <Download size={18} />
            Rapport PDF
          </button>
          <button
            onClick={() => setShowEncaissementModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-white font-medium rounded-lg transition-all"
            style={{ background: '#1A6B35' }}
          >
            <Plus size={18} />
            Encaissement rapide
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard 
          icon={DollarSign}
          label="Total encaissé ce mois"
          value={formatCurrency(dashboardData?.encaisseMois || 0)}
          color="#1A6B35"
        />
        <KpiCard 
          icon={TrendingUp}
          label="Total encaissé cette année"
          value={formatCurrency(dashboardData?.encaisseAnnee || 0)}
          color="#0D3B1F"
        />
        <KpiCard 
          icon={AlertTriangle}
          label="Dossiers en retard"
          value={dashboardData?.dossiersRetard || 0}
          color="#DC2626"
          isAlert={dashboardData?.dossiersRetard > 0}
        />
        <KpiCard 
          icon={FileText}
          label="Taux de recouvrement mensuel"
          value={`${dashboardData?.tauxRecouvrement || 0}%`}
          color="#C8960C"
        />
      </div>

      {/* Tableau compact avec toutes les fonctionnalités */}
      <div className="rounded-lg overflow-hidden" style={{ background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: '#E8F5EC' }}>
          <div>
            <h2 className="text-lg font-semibold" style={{ color: '#0D3B1F' }}>
              📊 Tous les Clients avec Baux
            </h2>
            <p className="text-xs" style={{ color: '#6B7280' }}>
              {clientsRetard.length} bail{clientsRetard.length > 1 ? 'x' : ''} • Suivi en temps réel
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={18} style={{ color: '#6B7280' }} />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border-2 rounded-lg outline-none"
                style={{ borderColor: '#E8F5EC', width: '220px' }}
              />
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#10B981' }}></span>Soldé</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#3B82F6' }}></span>En cours</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#EF4444' }}></span>Retard</span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-transparent" style={{ borderColor: '#1A6B35' }} />
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64" style={{ color: '#9CA3AF' }}>
            <CheckCircle size={48} style={{ color: '#10B981' }} />
            <p className="mt-4">Aucun client trouvé</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead style={{ background: '#F9FAFB' }}>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: '#374151' }}>Client</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: '#374151' }}>Bail</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: '#374151' }}>Progression</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: '#374151' }}>Montants</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: '#374151' }}>Statut</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold" style={{ color: '#374151' }}>Action</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: '#E8F5EC' }}>
                {filteredClients.map((client) => {
                  const getProgressColor = (taux) => {
                    if (taux === 100) return '#10B981'
                    if (taux >= 75) return '#3B82F6'
                    if (taux >= 50) return '#F59E0B'
                    return '#EF4444'
                  }
                  const progressColor = getProgressColor(client.tauxPaiement ?? 0)
                  const statutColor = client.statut === 'SOLDE' ? '#10B981' : client.statut === 'RETARD' ? '#EF4444' : '#3B82F6'
                  
                  return (
                    <tr 
                      key={client.id} 
                      className="hover:bg-gray-50 transition-colors"
                      style={{ borderLeft: `3px solid ${statutColor}` }}
                    >
                      {/* Client */}
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                            style={{ background: `${statutColor}20`, color: statutColor }}
                          >
                            {(client.client?.prenom || '?')[0]}{(client.client?.nom || '?')[0]}
                          </div>
                          <div>
                            <p className="font-medium text-sm" style={{ color: '#0D3B1F' }}>
                              {client.client?.prenom} {client.client?.nom}
                            </p>
                            <p className="text-xs" style={{ color: '#9CA3AF' }}>
                              {client.client?.telephone}
                            </p>
                          </div>
                        </div>
                      </td>
                      
                      {/* Bail */}
                      <td className="px-4 py-2.5">
                        <p className="text-sm font-medium" style={{ color: '#374151' }}>{client.bien?.numeroBail}</p>
                        <p className="text-xs" style={{ color: '#9CA3AF' }}>{client.bien?.building?.nom}</p>
                      </td>
                      
                      {/* Progression */}
                      <td className="px-4 py-2.5">
                        <div className="w-32">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-bold" style={{ color: progressColor }}>
                              {(client.tauxPaiement ?? 0).toFixed(0)}%
                            </span>
                          </div>
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full rounded-full transition-all duration-500"
                              style={{ 
                                width: `${client.tauxPaiement ?? 0}%`,
                                background: progressColor
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      
                      {/* Montants */}
                      <td className="px-4 py-2.5">
                        <div className="text-xs space-y-0.5">
                          <div className="flex justify-between gap-2">
                            <span style={{ color: '#9CA3AF' }}>Total:</span>
                            <span className="font-semibold" style={{ color: '#374151' }}>{formatCurrency(client.montantTotal)}</span>
                          </div>
                          <div className="flex justify-between gap-2">
                            <span style={{ color: '#9CA3AF' }}>Payé:</span>
                            <span className="font-semibold" style={{ color: '#10B981' }}>{formatCurrency(client.totalPaye)}</span>
                          </div>
                          <div className="flex justify-between gap-2">
                            <span style={{ color: '#9CA3AF' }}>Reste:</span>
                            <span className="font-bold" style={{ color: client.soldeDu > 0 ? '#EF4444' : '#10B981' }}>
                              {formatCurrency(client.soldeDu)}
                            </span>
                          </div>
                        </div>
                      </td>
                      
                      {/* Statut */}
                      <td className="px-4 py-2.5">
                        <div className="flex flex-col gap-1">
                          <span 
                            className="px-2 py-1 rounded-full text-xs font-bold text-center"
                            style={{ 
                              background: `${statutColor}20`,
                              color: statutColor
                            }}
                          >
                            {client.statut === 'SOLDE' ? '✓ Soldé' : client.statut === 'RETARD' ? '⚠ Retard' : '⏳ En cours'}
                          </span>
                          {client.joursRetard > 0 && (
                            <span className="text-xs" style={{ color: '#EF4444' }}>
                              {client.joursRetard}j retard
                            </span>
                          )}
                        </div>
                      </td>
                      {/* Action */}
                      <td className="px-4 py-2.5">
                        <div className="flex flex-col gap-2 justify-center">
                          {client.statut !== 'SOLDE' ? (
                            <button
                              onClick={() => {
                                setSelectedClient(client)
                                setShowEncaissementModal(true)
                              }}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105"
                              style={{ background: '#10B981', color: 'white' }}
                              title="Encaisser"
                            >
                              💰 Encaisser
                            </button>
                          ) : (
                            <span className="text-xs font-medium text-center" style={{ color: '#10B981' }}>
                              ✓ Complet
                            </span>
                          )}
                          {client.statut === 'RETARD' && (
                            <button
                              onClick={() => handleRelanceSMS(client.bien.id)}
                              className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105"
                              style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FCA5A5' }}
                              title="Relancer par SMS"
                            >
                              <MessageSquare size={14} /> SMS
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══ DROITS DE TERRE — SUIVI MENSUEL ═══ */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
        {/* Header */}
        <div className="p-5 border-b flex items-center justify-between flex-wrap gap-3" style={{ borderColor: '#E8F5EC', background: 'linear-gradient(135deg,#F0FDF4,#DCFCE7)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#1A6B35' }}>
              <Landmark size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: '#0D3B1F' }}>Droits de Terre — {new Date().toLocaleString('fr-FR',{month:'long',year:'numeric'})}</h2>
              <p className="text-xs" style={{ color: '#6B7280' }}>Suivi du paiement mensuel par porte · {droitsTerreData?.entries?.length || 0} porte(s) active(s)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* KPI rapides */}
            {droitsTerreData && droitsTerreData.entries && [
              { label: 'Payé', count: (droitsTerreData.entries || []).filter(e=>e.status==='PAYÉ').length, bg:'#DCFCE7', c:'#166534' },
              { label: 'Partiel', count: (droitsTerreData.entries || []).filter(e=>e.status==='PARTIEL').length, bg:'#FEF3C7', c:'#92400E' },
              { label: 'Impayé', count: (droitsTerreData.entries || []).filter(e=>e.status==='IMPAYÉ').length, bg:'#FEE2E2', c:'#DC2626' },
            ].map(k => (
              <button key={k.label}
                onClick={() => setDtFilter(dtFilter === k.label.toUpperCase() ? 'all' : k.label.toUpperCase())}
                className="px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all"
                style={{ background: dtFilter === k.label.toUpperCase() ? k.c : k.bg, color: dtFilter === k.label.toUpperCase() ? 'white' : k.c, border: `1px solid ${k.c}22` }}>
                {k.count} {k.label}
              </button>
            ))}
            <button onClick={() => setDtFilter('all')} className="px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background:'#F3F4F6', color:'#374151' }}>Tous</button>
            <button onClick={loadData} className="p-2 rounded-lg" style={{ background:'#F3F4F6' }} title="Rafraîchir">
              <RefreshCw size={15} className={droitsTerreLoading ? 'animate-spin text-green-700' : 'text-gray-500'} />
            </button>
          </div>
        </div>

        {/* Recherche */}
        <div className="px-5 py-3 border-b" style={{ borderColor: '#E8F5EC' }}>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={15} style={{ color: '#9CA3AF' }} />
            <input type="text" value={dtSearch} onChange={e => setDtSearch(e.target.value)}
              placeholder="Rechercher client, porte, bâtiment..."
              className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm outline-none"
              style={{ borderColor: '#E8F5EC' }} />
          </div>
        </div>

        {droitsTerreLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-t-transparent" style={{ borderColor: '#1A6B35' }} />
          </div>
        ) : !droitsTerreData || !droitsTerreData.entries || droitsTerreData.entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40" style={{ color: '#9CA3AF' }}>
            <Landmark size={36} className="mb-2" />
            <p>Aucune porte active avec droit de terre</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#E8F5EC' }}>
            {(droitsTerreData.grouped || []).map(({ building, entries = [] }) => {
              const bid = building?.id || 'unknown'
              const isOpen = collapsedBuildings[bid] !== true
              const filtered = entries.filter(e => {
                const matchFilter = dtFilter === 'all' || e.status === dtFilter
                const matchSearch = !dtSearch || [
                  e.client?.nom, e.client?.prenom, e.client?.telephone,
                  e.unite?.numeroPorte, e.building?.nom, e.numeroBail
                ].some(v => v?.toLowerCase().includes(dtSearch.toLowerCase()))
                return matchFilter && matchSearch
              })
              if (filtered.length === 0) return null
              const payés = filtered.filter(e => e.status === 'PAYÉ').length
              const impayés = filtered.filter(e => e.status === 'IMPAYÉ').length
              return (
                <div key={bid}>
                  {/* Header bâtiment */}
                  <button onClick={() => toggleBuilding(bid)}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors"
                    style={{ background: isOpen ? '#FAFFFE' : 'white' }}>
                    <Building2 size={16} style={{ color: '#1A6B35' }} />
                    <span className="font-bold flex-1 text-left text-sm" style={{ color: '#0D3B1F' }}>{building?.nom || 'Bâtiment inconnu'}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background:'#DCFCE7', color:'#166534' }}>{payés}/{filtered.length} payés</span>
                    {impayés > 0 && <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background:'#FEE2E2', color:'#DC2626' }}>{impayés} impayé{impayés>1?'s':''}</span>}
                    {isOpen ? <ChevronDown size={16} style={{ color:'#6B7280' }} /> : <ChevronRight size={16} style={{ color:'#6B7280' }} />}
                  </button>

                  {/* Lignes des portes */}
                  {isOpen && (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead style={{ background:'#F9FAFB' }}>
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-semibold" style={{ color:'#6B7280' }}>Porte</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold" style={{ color:'#6B7280' }}>Client</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold" style={{ color:'#6B7280' }}>N° Bail</th>
                            <th className="px-4 py-2 text-right text-xs font-semibold" style={{ color:'#6B7280' }}>Droit/mois</th>
                            <th className="px-4 py-2 text-right text-xs font-semibold" style={{ color:'#6B7280' }}>Payé ce mois</th>
                            <th className="px-4 py-2 text-right text-xs font-semibold" style={{ color:'#6B7280' }}>Reste</th>
                            <th className="px-4 py-2 text-center text-xs font-semibold" style={{ color:'#6B7280' }}>Statut</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y" style={{ borderColor:'#F3F4F6' }}>
                          {filtered.map(e => {
                            const stCfg = {
                              'PAYÉ':    { bg:'#DCFCE7', c:'#166534', label:'✓ Payé' },
                              'PARTIEL': { bg:'#FEF3C7', c:'#92400E', label:'⚡ Partiel' },
                              'IMPAYÉ':  { bg:'#FEE2E2', c:'#DC2626', label:'✗ Impayé' },
                              'N/A':     { bg:'#F3F4F6', c:'#6B7280', label:'— N/A' },
                            }[e.status] || { bg:'#F3F4F6', c:'#6B7280', label: e.status }
                            return (
                              <tr key={e.leaseId} className="hover:bg-gray-50 transition-colors"
                                style={{ borderLeft: `3px solid ${stCfg.c}` }}>
                                <td className="px-4 py-2.5">
                                  <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                                      style={{ background: stCfg.bg, color: stCfg.c }}>
                                      {e.unite?.numeroPorte?.substring(0,2) || '?'}
                                    </div>
                                    <div>
                                      <p className="text-sm font-bold" style={{ color:'#0D3B1F' }}>{e.unite?.numeroPorte || '—'}</p>
                                      <p className="text-xs" style={{ color:'#6B7280' }}>{e.unite?.typeUnite || ''}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-2.5">
                                  <p className="text-sm font-medium" style={{ color:'#0D3B1F' }}>{e.client?.prenom} {e.client?.nom}</p>
                                  <p className="text-xs flex items-center gap-1" style={{ color:'#6B7280' }}><Phone size={10}/>{e.client?.telephone || '—'}</p>
                                </td>
                                <td className="px-4 py-2.5 text-xs" style={{ color:'#6B7280' }}>{e.numeroBail}</td>
                                <td className="px-4 py-2.5 text-right text-sm font-bold" style={{ color:'#0D3B1F' }}>{formatCurrency(e.droitTerre)}</td>
                                <td className="px-4 py-2.5 text-right text-sm font-bold" style={{ color:'#10B981' }}>{formatCurrency(e.payedThisMonth)}</td>
                                <td className="px-4 py-2.5 text-right text-sm font-bold" style={{ color: e.resteThisMonth > 0 ? '#DC2626' : '#10B981' }}>{formatCurrency(e.resteThisMonth)}</td>
                                <td className="px-4 py-2.5 text-center">
                                  <span className="px-2 py-1 rounded-full text-xs font-bold" style={{ background:stCfg.bg, color:stCfg.c }}>{stCfg.label}</span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Statistiques mensuelles */}
      {statsMensuelles && (
        <div className="rounded-lg overflow-hidden" style={{ background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: '#E8F5EC' }}>
            <h2 className="text-lg font-semibold" style={{ color: '#0D3B1F' }}>Statistiques mensuelles - {new Date().getFullYear()}</h2>
            <div className="flex gap-2">
              <button
                onClick={() => window.open('/api/recouvrement/export-excel', '_blank')}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ background: '#F3F4F6', color: '#374151' }}
              >
                <Download size={16} />
                Export Excel
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead style={{ background: '#F9FAFB' }}>
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: '#374151' }}>Mois</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold" style={{ color: '#374151' }}>Attendu</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold" style={{ color: '#374151' }}>Encaissé</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold" style={{ color: '#374151' }}>Taux %</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold" style={{ color: '#374151' }}>Écart</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: '#E8F5EC' }}>
                {statsMensuelles.statsMensuelles.map((stat, index) => {
                  const isCurrentMonth = index === new Date().getMonth()
                  return (
                    <tr 
                      key={stat.mois} 
                      className="hover:bg-gray-50"
                      style={{ background: isCurrentMonth ? '#F0FDF4' : 'transparent' }}
                    >
                      <td className="px-6 py-3">
                        <span className="font-medium" style={{ color: '#0D3B1F' }}>{stat.mois}</span>
                        {isCurrentMonth && (
                          <span className="ml-2 px-2 py-0.5 rounded text-xs" style={{ background: '#1A6B35', color: 'white' }}>
                            En cours
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-right" style={{ color: '#374151' }}>
                        {formatCurrency(stat.attendu)}
                      </td>
                      <td className="px-6 py-3 text-right font-medium" style={{ color: stat.encaisse > 0 ? '#10B981' : '#6B7280' }}>
                        {formatCurrency(stat.encaisse)}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <span 
                          className="px-2 py-1 rounded text-sm font-medium"
                          style={{ 
                            background: stat.taux >= 90 ? '#DCFCE7' : stat.taux >= 70 ? '#FEF3C7' : '#FEE2E2',
                            color: stat.taux >= 90 ? '#166534' : stat.taux >= 70 ? '#92400E' : '#DC2626'
                          }}
                        >
                          {stat.taux}%
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right" style={{ color: stat.ecart > 0 ? '#DC2626' : '#10B981' }}>
                        {stat.ecart > 0 ? '+' : ''}{formatCurrency(stat.ecart)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Totaux et projection */}
          <div className="p-4 border-t" style={{ borderColor: '#E8F5EC', background: '#F9FAFB' }}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm" style={{ color: '#6B7280' }}>Total attendu annuel</p>
                <p className="text-xl font-bold" style={{ color: '#0D3B1F' }}>{formatCurrency(statsMensuelles.totalAttendu)}</p>
              </div>
              <div>
                <p className="text-sm" style={{ color: '#6B7280' }}>Total encaissé</p>
                <p className="text-xl font-bold" style={{ color: '#10B981' }}>{formatCurrency(statsMensuelles.totalEncaisse)}</p>
              </div>
              <div>
                <p className="text-sm" style={{ color: '#6B7280' }}>Taux global</p>
                <p className="text-xl font-bold" style={{ color: '#C8960C' }}>{statsMensuelles.tauxGlobal}%</p>
              </div>
              <div>
                <p className="text-sm" style={{ color: '#6B7280' }}>Projection fin d'année</p>
                <p className="text-xl font-bold" style={{ color: '#1A6B35' }}>{formatCurrency(statsMensuelles.projectionFinAnnee)}</p>
                <p className="text-xs" style={{ color: statsMensuelles.ecartProjection > 0 ? '#DC2626' : '#10B981' }}>
                  Écart: {statsMensuelles.ecartProjection > 0 ? '+' : ''}{formatCurrency(statsMensuelles.ecartProjection)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Encaissement Rapide */}
      {showEncaissementModal && (
        <EncaissementModal 
          leases={leases}
          onClose={() => setShowEncaissementModal(false)}
          onSuccess={(paymentData) => {
            // 1. Fermer le modal d'encaissement
            setShowEncaissementModal(false)
            
            // 2. Mise à jour automatique du client dans le tableau
            setClientsRetard(prev => prev.map(client => {
              if (client.id === selectedClient?.id) {
                const nouveauTotalPaye = client.totalPaye + paymentData.payment.montantVerse
                const nouveauSoldeDu = client.soldeDu - paymentData.payment.montantVerse
                const nouveauTaux = (nouveauTotalPaye / client.montantTotal) * 100
                
                return {
                  ...client,
                  totalPaye: nouveauTotalPaye,
                  soldeDu: Math.max(0, nouveauSoldeDu),
                  tauxPaiement: Math.min(100, nouveauTaux),
                  statut: nouveauSoldeDu <= 0 ? 'SOLDE' : client.statut,
                  joursRetard: nouveauSoldeDu <= 0 ? 0 : client.joursRetard,
                  dernierPaiement: new Date().toISOString()
                }
              }
              return client
            }))
            
            // 3. Mise à jour du dashboard
            setDashboardData(prev => ({
              ...(prev || {}),
              totalEncaisse: (prev?.totalEncaisse || 0) + paymentData.payment.montantVerse,
              totalDu: (prev?.totalDu || 0) - paymentData.payment.montantVerse
            }))
            
            // 4. Enregistrer les données du paiement
            setLastPaymentData(paymentData)
            
            // 5. Afficher le modal de confirmation
            setShowConfirmationModal(true)
            
            // 6. Animation de succès
            toast.success('💰 Montants mis à jour automatiquement')
          }}
        />
      )}

      {/* Modal de Confirmation avec option d'impression */}
      {showConfirmationModal && lastPaymentData && (
        <ConfirmationEncaissementModal
          paymentData={lastPaymentData}
          onClose={() => {
            setShowConfirmationModal(false)
            setLastPaymentData(null)
            toast.success('✅ Vous pouvez réimprimer le reçu depuis l\'historique')
          }}
          onPrint={() => {
            generateRecuPDF(lastPaymentData)
            setShowConfirmationModal(false)
            setLastPaymentData(null)
          }}
          onDownload={() => {
            generateRecuPDF(lastPaymentData)
            toast.success('📥 Reçu téléchargé')
          }}
        />
      )}
    </div>
  )
}

// ============================================
// COMPOSANTS AUXILIAIRES
// ============================================

const KpiCard = ({ icon: Icon, label, value, color, isAlert }) => (
  <div 
    className="p-4 rounded-lg"
    style={{ 
      background: '#E8F5EC', 
      borderLeft: `4px solid ${color}`,
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    }}
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm" style={{ color: '#6B7280' }}>{label}</p>
        <p className="text-2xl font-bold mt-1" style={{ color: isAlert ? '#DC2626' : '#0D3B1F' }}>{value}</p>
      </div>
      <div 
        className="p-2 rounded-lg"
        style={{ background: 'white' }}
      >
        <Icon size={24} style={{ color }} />
      </div>
    </div>
  </div>
)

// ============================================
// MODAL ENCAISSEMENT RAPIDE
// ============================================
const EncaissementModal = ({ leases, onClose, onSuccess }) => {
  const [step, setStep] = useState(1) // 1: Recherche, 2: Paiement
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedLease, setSelectedLease] = useState(null)
  const [formData, setFormData] = useState({
    montantVerse: '',
    modePaiement: 'ESPECES',
    notes: ''
  })
  const [loading, setLoading] = useState(false)

  // Filtrer les baux pour recherche instantanée
  const filteredLeases = leases.filter(lease => {
    if (!lease?.client && !lease?.numeroBail) return false
    const search = searchTerm.toLowerCase()
    return (
      (lease.client?.nom || '').toLowerCase().includes(search) ||
      (lease.client?.prenom || '').toLowerCase().includes(search) ||
      (lease.client?.telephone || '').includes(search) ||
      (lease.numeroBail || '').toLowerCase().includes(search)
    )
  })

  const handleSelectLease = (lease) => {
    setSelectedLease(lease)
    // Pré-remplir avec le reste dû
    const resteDu = lease.calculs?.resteDu || lease.montantInitial
    setFormData({ ...formData, montantVerse: resteDu.toString() })
    setStep(2)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!selectedLease) {
      toast.error('❌ Veuillez sélectionner un client')
      return
    }
    
    if (!formData.montantVerse || parseFloat(formData.montantVerse) <= 0) {
      toast.error('❌ Montant invalide')
      return
    }

    setLoading(true)
    try {
      const res = await createEncaissementRapide({
        leaseId: selectedLease.id,
        montantVerse: parseFloat(formData.montantVerse),
        modePaiement: formData.modePaiement,
        notes: formData.notes || ''
      })

      const saved = res.data?.payment || res.data || {}

      const paymentData = {
        payment: {
          id: saved.id || Date.now(),
          numeroFacture: saved.numeroFacture || `FAC-${new Date().getFullYear()}-${saved.id || ''}`,
          montantVerse: parseFloat(formData.montantVerse),
          modePaiement: formData.modePaiement,
          notes: formData.notes || '',
          datePaiement: saved.datePaiement || new Date().toISOString(),
          lease: {
            id: selectedLease.id,
            numeroBail: selectedLease.numeroBail || 'N/A',
            uniteId: selectedLease.unite?.id || selectedLease.uniteId || 0,
            client: {
              prenom: selectedLease.client?.prenom || 'Client',
              nom: selectedLease.client?.nom || 'Inconnu',
              telephone: selectedLease.client?.telephone || 'N/A'
            }
          }
        },
        stats: {
          totalPaye: parseFloat(formData.montantVerse),
          resteDu: Math.max(0, (selectedLease.calculs?.resteDu || selectedLease.montantInitial || 0) - parseFloat(formData.montantVerse))
        }
      }

      toast.success('✅ Encaissement enregistré avec succès')
      
      if (onSuccess) {
        try {
          onSuccess(paymentData)
        } catch (pdfError) {
          console.error('[EncaissementModal] Erreur PDF:', pdfError)
          toast.error('⚠️ Encaissement OK mais erreur PDF: ' + pdfError.message)
        }
      }
      
      onClose()
    } catch (error) {
      console.error('[EncaissementModal] Erreur:', error)
      toast.error('❌ Erreur: ' + (error.message || 'Erreur inconnue'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b" style={{ borderColor: '#E8F5EC' }}>
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold" style={{ color: '#0D3B1F' }}>
              {step === 1 ? 'Rechercher un client' : 'Encaissement rapide'}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
              <X size={24} style={{ color: '#6B7280' }} />
            </button>
          </div>
        </div>

        <div className="p-6">
          {step === 1 ? (
            <div>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={20} style={{ color: '#6B7280' }} />
                <input
                  type="text"
                  placeholder="Rechercher par nom, téléphone, n° bail..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border-2 rounded-lg outline-none"
                  style={{ borderColor: '#E8F5EC' }}
                  autoFocus
                />
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredLeases.map((lease) => (
                  <button
                    key={lease.id}
                    onClick={() => handleSelectLease(lease)}
                    className="w-full p-4 rounded-lg text-left transition-all hover:shadow-md"
                    style={{ background: '#F9FAFB', border: '1px solid #E8F5EC' }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold" style={{ color: '#0D3B1F' }}>
                          {lease.client?.prenom} {lease.client?.nom}
                        </p>
                        <p className="text-sm" style={{ color: '#6B7280' }}>
                          {lease.numeroBail} • Tél: {lease.client?.telephone}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold" style={{ color: '#DC2626' }}>
                          Reste: {formatCurrency(lease.calculs?.resteDu || lease.montantInitial)}
                        </p>
                        <p className="text-xs" style={{ color: '#6B7280' }}>
                          Payé: {formatCurrency(lease.calculs?.totalPaye || 0)}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
                {filteredLeases.length === 0 && searchTerm && (
                  <p className="text-center py-4" style={{ color: '#9CA3AF' }}>
                    Aucun client trouvé
                  </p>
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Client sélectionné */}
              <div className="p-4 rounded-lg" style={{ background: '#F0FDF4', border: '1px solid #10B981' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold" style={{ color: '#0D3B1F' }}>
                      {selectedLease.client?.prenom} {selectedLease.client?.nom}
                    </p>
                    <p className="text-sm" style={{ color: '#6B7280' }}>
                      {selectedLease.numeroBail}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-sm" style={{ color: '#1A6B35' }}
                  >
                    Changer
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#0D3B1F' }}>
                    Montant encaissé (FCFA) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.montantVerse}
                    onChange={(e) => setFormData({...formData, montantVerse: e.target.value})}
                    className="w-full px-4 py-2 border-2 rounded-lg outline-none"
                    style={{ borderColor: '#E8F5EC' }}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#0D3B1F' }}>
                    Mode de paiement *
                  </label>
                  <select
                    value={formData.modePaiement}
                    onChange={(e) => setFormData({...formData, modePaiement: e.target.value})}
                    className="w-full px-4 py-2 border-2 rounded-lg outline-none"
                    style={{ borderColor: '#E8F5EC' }}
                  >
                    <option value="ESPECES">Espèces</option>
                    <option value="VIREMENT">Virement</option>
                    <option value="MOBILE_MONEY">Mobile Money</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#0D3B1F' }}>
                  Notes agent
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  rows={3}
                  className="w-full px-4 py-2 border-2 rounded-lg outline-none"
                  style={{ borderColor: '#E8F5EC' }}
                  placeholder="Commentaires sur l'encaissement..."
                />
              </div>

              <div className="space-y-3">
                {/* Bouton principal : Valider et Enregistrer */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 text-white font-semibold rounded-lg transition-all transform hover:scale-105 flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #0D3B1F 0%, #1A6B35 100%)' }}
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                      Enregistrement en cours...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={20} />
                      Valider et Enregistrer
                    </>
                  )}
                </button>

                {/* Ligne de séparation avec texte */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px" style={{ background: '#E5E7EB' }}></div>
                  <span className="text-xs font-medium" style={{ color: '#9CA3AF' }}>
                    Après enregistrement
                  </span>
                  <div className="flex-1 h-px" style={{ background: '#E5E7EB' }}></div>
                </div>

                {/* Boutons secondaires */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="py-2.5 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                    style={{ background: '#F3F4F6', color: '#6B7280' }}
                  >
                    <X size={18} />
                    Retour
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => {
                      toast.info('💡 Enregistrez d\'abord, puis imprimez depuis la confirmation')
                    }}
                    className="py-2.5 font-medium rounded-lg transition-all flex items-center justify-center gap-2"
                    style={{ background: '#E8F5EC', color: '#0D3B1F' }}
                    title="Disponible après enregistrement"
                  >
                    <Printer size={18} />
                    Imprimer
                  </button>
                </div>

                <p className="text-xs text-center" style={{ color: '#9CA3AF' }}>
                  💡 Le reçu sera disponible après l'enregistrement
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

// Styles globaux pour les animations
const styles = `
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`

// Injecter les styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style')
  styleSheet.textContent = styles
  document.head.appendChild(styleSheet)
}

export default RecouvrementPage
