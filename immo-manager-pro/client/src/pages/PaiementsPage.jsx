import { useEffect, useState, useRef, useCallback } from 'react'
import { fetchPayments, deletePayment, fetchRegistreCaisse, generateFacturePDF, generateRapportPaiementsPDF, fetchLeases, fetchClients, createPayment } from '../utils/api'
import { safeMap, safeFilter, safeGet, extractApiData, getErrorMessage } from '../utils/safetyHelpers'
import toast from 'react-hot-toast'
import { useLocation } from 'react-router-dom'
import { Plus, Search, Trash2, CreditCard, FileDown, X, Printer, User, Home, Calendar, Banknote, Receipt, TrendingUp, Wallet, CheckCircle, RefreshCw, TableProperties, Wifi, Eye, Phone, CreditCard as CardIcon } from 'lucide-react'
import { formatDate, formatCurrency, formatDateTime, formatPhone } from '../utils/formatters'
import jsPDF from 'jspdf'
import { addPdfHeader, addPdfFooter, addWatermark, addSectionTitle, addTable, addInfoCard, checkPageBreak } from '../utils/pdfUtils'
import logoSrc from '../assets/logo/logo behemoth.png'
import Pagination from '../components/Pagination'
import PaymentSummaryCard from '../components/PaymentSummaryCard'
import ConfirmationPaiementModal from '../components/ConfirmationPaiementModal'
import { exportToExcel } from '../utils/excelUtils'
import { logDocGeneration } from '../utils/pdfLogger'
import { useAuthStore } from '../stores/authStore'
import { useRealtimeTable } from '../hooks/useRealtimeTable'

const PaiementsPage = () => {
  const location = useLocation()
  const [payments, setPayments] = useState([])
  const [leases, setLeases] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterDate, setFilterDate] = useState('')   // Vide = tous les paiements
  const [registre, setRegistre] = useState(null)
  const [totalCount, setTotalCount] = useState(0)
  
  const [clients, setClients] = useState([])
  const [lastRefresh, setLastRefresh] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Modals
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showRegistreModal, setShowRegistreModal] = useState(false)
  const [showConfirmationModal, setShowConfirmationModal] = useState(false)
  const [lastPaymentData, setLastPaymentData] = useState(null)
  const [selectedLease, setSelectedLease] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 15
  const { user } = useAuthStore()
  const [groupByClient, setGroupByClient] = useState(true)
  const [viewMode, setViewMode] = useState('cards') // 'cards' ou 'table'
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState(null)

  const handleExportExcel = async () => {
    const headers = ['N° Facture', 'Client', 'Bail', 'Date', 'Montant versé', 'Mode', 'Statut']
    const rows = payments.map(p => [
      p.numeroFacture || '',
      p.lease?.client ? `${p.lease.client.prenom} ${p.lease.client.nom}` : '',
      p.lease?.numeroBail || '',
      p.datePaiement ? new Date(p.datePaiement).toLocaleDateString('fr-FR') : '',
      p.montantVerse,
      p.modePaiement || '',
      p.statut || ''
    ])
    const ok = await exportToExcel('PAIEMENTS', 'Paiements', headers, rows, 'REGISTRE DES PAIEMENTS')
    if (ok) logDocGeneration(user, 'EXCEL_GENERATED', `PAIEMENTS_${new Date().toISOString().slice(0,10)}.xlsx`, 'paiements')
  }

  // Pré-sélection depuis navigation
  useEffect(() => {
    if (location.state?.leaseId) {
      setSelectedLease({ id: location.state.leaseId })
      setShowPaymentModal(true)
    }
  }, [location])

  // Vérifier l'authentification avant de charger
  useEffect(() => {
    const checkAuth = () => {
      const storeToken = useAuthStore.getState?.()?.token
      const localToken = localStorage.getItem('auth-storage')
      if (storeToken || localToken) {
        setIsAuthenticated(true)
      } else {
        // Réessayer dans 500ms si pas encore authentifié
        setTimeout(checkAuth, 500)
      }
    }
    checkAuth()
  }, [])

  // Chargement initial avec timeout de sécurité
  useEffect(() => {
    if (!isAuthenticated) return // Attendre l'authentification
    
    const timeoutId = setTimeout(() => {
      if (loading) {
        console.warn('[PaiementsPage] Timeout de chargement - forçage arrêt spinner')
        setLoading(false)
        setLoadError('Le chargement prend trop de temps (30s). Problème de connexion à la base de données.')
      }
    }, 30000) // 30 secondes max (Supabase est lent)
    
    loadInitial()
    
    return () => clearTimeout(timeoutId)
  }, [isAuthenticated])

  // ⚡ REALTIME : WebSocket Supabase (remplace le polling)
  const { isConnected: isRealtimeConnected } = useRealtimeTable('payments', {
    onInsert: (payload) => {
      console.log('✅ Nouveau paiement détecté:', payload.new)
      toast.success('Nouveau paiement ajouté')
      loadPaymentsSilent()
    },
    onUpdate: (payload) => {
      console.log('🔄 Paiement modifié:', payload.new)
      toast.info('Paiement mis à jour')
      loadPaymentsSilent()
    },
    onDelete: (payload) => {
      console.log('🗑️ Paiement supprimé:', payload.old)
      toast.error('Paiement supprimé')
      loadPaymentsSilent()
    },
    enabled: isAuthenticated
  })

  const generatePDF = (payment) => generateInvoicePDF(payment)

  const openDetail = (payment) => {
    setSelectedPayment(payment)
    setShowDetailModal(true)
  }

  // Debounce uniquement pour la recherche / filtre date (ignore le 1er render)
  const debounceRef = useRef(null)
  const isMounted = useRef(false)
  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => loadPayments(), searchTerm ? 400 : 0)
    return () => clearTimeout(debounceRef.current)
  }, [searchTerm, filterDate])

  const loadInitial = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      // ÉTAPE 1: Charger les paiements d'abord (priorité)
      const paymentsRes = await fetchPayments()
      const pData = paymentsRes.data?.data || paymentsRes.data || []
      setPayments(Array.isArray(pData) ? pData : [])
      setTotalCount(paymentsRes.data?.count || pData.length)
      
      // Arrêter le spinner dès que les paiements sont chargés
      setLoading(false)
      setLastRefresh(new Date())
      
      // ÉTAPE 2: Charger baux et clients en arrière-plan (silencieux)
      loadSecondaryData()
      
    } catch (error) {
      console.error('[PaiementsPage] Erreur chargement paiements:', error.message)
      setPayments([])
      setLoadError('Erreur lors du chargement des paiements')
      setLoading(false)
    }
  }
  
  // Chargement secondaire en arrière-plan
  const loadSecondaryData = async () => {
    try {
      const [lRes, cRes] = await Promise.allSettled([
        fetchLeases(),
        fetchClients()
      ])
      
      if (lRes.status === 'fulfilled') {
        const lData = lRes.value.data?.data || lRes.value.data || []
        setLeases(Array.isArray(lData) ? lData : [])
      }
      
      if (cRes.status === 'fulfilled') {
        const cData = cRes.value.data?.data || cRes.value.data || []
        setClients(Array.isArray(cData) ? cData : [])
      }
    } catch (error) {
      console.error('[PaiementsPage] Erreur données secondaires:', error)
    }
  }

  // Refresh silencieux (pas de spinner) pour le realtime
  const loadPaymentsSilent = useCallback(async () => {
    try {
      const params = {}
      if (searchTerm) params.search = searchTerm
      if (filterDate) { params.dateDebut = filterDate; params.dateFin = filterDate }
      const response = await fetchPayments(Object.keys(params).length > 0 ? params : undefined)
      const pData = response.data?.data || response.data || []
      setPayments(Array.isArray(pData) ? pData : [])
      setTotalCount(response.data?.count || pData.length)
      setLastRefresh(new Date())
    } catch {}
  }, [searchTerm, filterDate])

  const loadPayments = async () => {
    setLoading(true)
    try {
      const params = {}
      if (searchTerm) params.search = searchTerm
      if (filterDate) { params.dateDebut = filterDate; params.dateFin = filterDate }
      const response = await fetchPayments(Object.keys(params).length > 0 ? params : undefined)
      const pData = response.data?.data || response.data || []
      setPayments(Array.isArray(pData) ? pData : [])
      setTotalCount(response.data?.count || pData.length)
    } catch (error) {
      console.error('[PaiementsPage] load:', error.message)
      toast.error('Erreur chargement paiements')
      setPayments([])
    } finally {
      setLoading(false)
    }
  }

  const loadLeases = async () => {
    try {
      const response = await fetchLeases()
      const lData = response.data?.data || response.data || []
      setLeases(Array.isArray(lData) ? lData : [])
    } catch (error) {
      console.error('[PaiementsPage] leases:', error.message)
    }
  }

  const loadRegistre = async () => {
    try {
      const response = await fetchRegistreCaisse(filterDate)
      setRegistre(response.data)
      setShowRegistreModal(true)
    } catch (error) {
      toast.error('Erreur lors du chargement du registre')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce paiement ?')) return
    
    try {
      await deletePayment(id)
      toast.success('Paiement supprimé avec succès')
      loadPayments()
    } catch (error) {
      toast.error('Erreur lors de la suppression')
    }
  }

  // ============================================
  // RAPPORT GLOBAL PDF (pdfkit côté serveur)
  // ============================================
  const [rapportLoading, setRapportLoading] = useState(false)

  const handleRapportGlobal = async () => {
    if (rapportLoading) return
    setRapportLoading(true)
    const toastId = toast.loading('Génération du rapport en cours...')
    try {
      const response = await generateRapportPaiementsPDF()
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url  = URL.createObjectURL(blob)
      const win  = window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 15000)
      if (!win) {
        const a = document.createElement('a')
        a.href = url
        a.download = `rapport_paiements_${new Date().toISOString().split('T')[0]}.pdf`
        a.click()
      }
      toast.success('Rapport global ouvert', { id: toastId })
    } catch (error) {
      console.error('[Rapport PDF]', error)
      toast.error('Erreur génération rapport', { id: toastId })
    } finally {
      setRapportLoading(false)
    }
  }

  // ============================================
  // GÉNÉRATION FACTURE PDF AVEC JSPDF
  // ============================================
  const generateInvoicePDF = async (payment) => {
    const toastId = toast.loading('Génération facture PDF...')
    try {
      // Utiliser les données locales du paiement
      const data = {
        numeroFacture: payment.numeroFacture,
        datePaiement: payment.datePaiement,
        modePaiement: payment.modePaiement,
        montantVerse: payment.montantVerse,
        client: {
          nom: payment.lease?.client ? `${payment.lease.client.prenom} ${payment.lease.client.nom}` : 'Client',
          telephone: payment.lease?.client?.telephone || 'N/A',
          email: payment.lease?.client?.email || '',
          numeroPiece: payment.lease?.client?.numeroPiece || ''
        },
        bail: {
          numeroBail: payment.lease?.numeroBail || 'N/A',
          numeroPorte: payment.lease?.unite?.numeroPorte || '',
          buildingNom: payment.lease?.building?.nom || '',
          uniteId: payment.lease?.uniteId || '',
          buildingId: payment.lease?.buildingId || ''
        },
        stats: {
          montantInitial: payment.lease?.montantInitial || 0,
          totalPaye: payment.lease?.calculs?.totalPaye ?? payment.montantVerse,
          resteDu: payment.lease?.calculs?.resteDu ?? ((payment.lease?.montantInitial || 0) - (payment.montantVerse || 0)),
          progression: payment.lease?.calculs?.progression ?? 0
        }
      }

      // Créer le PDF format A4
      const doc = new jsPDF('p', 'mm', 'a4')
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      
      // Couleurs YAMTIKEN BEHEMOTH
      const darkGreen = '#0D3B1F'
      const gold = '#C8960C'
      const lightGreen = '#E8F5EC'
      
      // Filigrane subtil
      addWatermark(doc)

      // En-tête avec fond vert foncé
      doc.setFillColor(darkGreen)
      doc.rect(0, 0, pageWidth, 36, 'F')
      // Bande dorée
      doc.setFillColor(gold)
      doc.rect(0, 34, pageWidth, 2, 'F')

      // Logo à gauche
      try { doc.addImage(logoSrc, 'PNG', 6, 4, 26, 26) } catch (e) {}

      // Titre société
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.text('YAMTIKEN BEHEMOTH', 38, 14)
      
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text('IMMO MANAGER PRO', 38, 21)
      doc.text('Abidjan, Côte d\'Ivoire', 38, 27)
      
      // Numéro de facture à droite
      doc.setTextColor(gold)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text(`FACTURE N° ${data.numeroFacture}`, pageWidth - 15, 15, { align: 'right' })
      
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text(`Date: ${formatDateTime(data.datePaiement)}`, pageWidth - 15, 22, { align: 'right' })
      doc.text(`Mode: ${data.modePaiement}`, pageWidth - 15, 28, { align: 'right' })
      
      // Encadré CLIENT
      doc.setDrawColor(darkGreen)
      doc.setLineWidth(0.5)
      doc.rect(15, 45, 85, 40)
      
      doc.setTextColor(darkGreen)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text('CLIENT', 20, 52)
      
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(0, 0, 0)
      doc.setFontSize(11)
      doc.text(data.client.nom, 20, 60)
      doc.setFontSize(9)
      doc.text(`Tél: ${data.client.telephone}`, 20, 67)
      if (data.client.email) {
        doc.text(`Email: ${data.client.email}`, 20, 73)
      }
      if (data.client.numeroPiece) {
        doc.text(`Pièce: ${data.client.numeroPiece}`, 20, 79)
      }
      
      // Encadré BIEN
      doc.rect(110, 45, 85, 40)
      
      doc.setTextColor(darkGreen)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text('BIEN LOUÉ', 115, 52)
      
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(0, 0, 0)
      doc.setFontSize(9)
      doc.text(`Bail N°: ${data.bail.numeroBail}`, 115, 60)
      doc.text(`Unité: ${data.bail.numeroPorte || data.bail.uniteId || '—'}`, 115, 67)
      doc.text(`Immeuble: ${data.bail.buildingNom || data.bail.buildingId || '—'}`, 115, 73)
      
      // Titre tableau financier
      doc.setFillColor(lightGreen)
      doc.rect(15, 95, pageWidth - 30, 10, 'F')
      
      doc.setTextColor(darkGreen)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text('DÉTAILS FINANCIERS', pageWidth / 2, 101, { align: 'center' })
      
      // Tableau financier
      let y = 115
      const colLabel = 20
      const colValue = pageWidth - 50
      
      // Ligne 1: Montant initial
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(0, 0, 0)
      doc.text('Montant initial du bien', colLabel, y)
      doc.setFont('helvetica', 'bold')
      doc.text(`${formatCurrency(data.stats.montantInitial)}`, colValue, y, { align: 'right' })
      
      // Ligne 2: Montant versé ce jour
      y += 12
      doc.setFont('helvetica', 'normal')
      doc.text('Montant versé ce jour', colLabel, y)
      doc.setTextColor(gold)
      doc.setFont('helvetica', 'bold')
      doc.text(`+ ${formatCurrency(data.montantVerse)}`, colValue, y, { align: 'right' })
      
      // Ligne 3: Total versé
      y += 12
      doc.setTextColor(0, 0, 0)
      doc.setFont('helvetica', 'normal')
      doc.text('Total versé depuis le début', colLabel, y)
      doc.setTextColor(darkGreen)
      doc.setFont('helvetica', 'bold')
      doc.text(`${formatCurrency(data.stats.totalPaye)}`, colValue, y, { align: 'right' })
      
      // Ligne 4: Reste dû (en rouge si > 0)
      y += 12
      doc.setTextColor(0, 0, 0)
      doc.setFont('helvetica', 'normal')
      doc.text('Reste dû', colLabel, y)
      const resteDu = data.stats.resteDu
      doc.setTextColor(resteDu > 0 ? 220 : 26, resteDu > 0 ? 38 : 129, resteDu > 0 ? 38 : 69)
      doc.setFont('helvetica', 'bold')
      doc.text(`${formatCurrency(resteDu)}`, colValue, y, { align: 'right' })
      
      // Droits de terre
      y += 12
      doc.setTextColor(0, 0, 0)
      doc.setFont('helvetica', 'normal')
      doc.text('Droits de terre', colLabel, y)
      doc.setFont('helvetica', 'bold')
      doc.text(`${formatCurrency(data.bail.droitsTerre || 0)}`, colValue, y, { align: 'right' })
      
      // Charges annexes
      y += 12
      doc.setFont('helvetica', 'normal')
      doc.text('Charges annexes', colLabel, y)
      doc.setFont('helvetica', 'bold')
      doc.text(`${formatCurrency(data.bail.chargesAnnexes || 0)}`, colValue, y, { align: 'right' })
      
      // Ligne de séparation
      y += 8
      doc.setDrawColor(gold)
      doc.setLineWidth(0.5)
      doc.line(15, y, pageWidth - 15, y)
      
      // Progression
      y += 15
      doc.setTextColor(darkGreen)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      const prog = typeof data.stats.progression === 'number' ? data.stats.progression : 0
      doc.text(`Progression: ${prog}%`, colLabel, y)
      
      // Barre de progression
      doc.setFillColor(lightGreen)
      doc.roundedRect(15, y + 3, pageWidth - 30, 8, 2, 2, 'F')
      
      const progressionWidth = ((pageWidth - 30) * Math.min(prog, 100)) / 100
      doc.setFillColor(26, 129, 69) // Vert
      doc.roundedRect(15, y + 3, progressionWidth, 8, 2, 2, 'F')
      
      // Zone signature
      y += 35
      doc.setTextColor(darkGreen)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text('SIGNATURES', 15, y)
      
      // Agent
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(0, 0, 0)
      doc.text(`Agent: ${user?.prenom || ''} ${user?.nom || ''}`, 15, y + 10)
      doc.text('Signature:', 15, y + 18)
      doc.line(35, y + 18, 80, y + 18)
      
      // Client
      doc.text('Client:', 120, y + 10)
      doc.text('Signature:', 120, y + 18)
      doc.line(140, y + 18, 185, y + 18)
      
      // Cachet
      doc.setDrawColor(gold)
      doc.setLineWidth(1)
      doc.ellipse(pageWidth / 2, y + 35, 20, 12)
      doc.setTextColor(gold)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text('CACHET', pageWidth / 2, y + 37, { align: 'center' })
      doc.text('YAMTIKEN BEHEMOTH', pageWidth / 2, y + 42, { align: 'center' })
      
      // Pied de page
      doc.setFillColor(darkGreen)
      doc.rect(0, pageHeight - 15, pageWidth, 15, 'F')
      
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'italic')
      doc.text('YAMTIKEN BEHEMOTH — Votre partenaire immobilier de confiance', pageWidth / 2, pageHeight - 7, { align: 'center' })
      
      // Ouvrir dans un nouvel onglet pour aperçu + impression
      const pdfBlob = new Blob([doc.output('blob')], { type: 'application/pdf' })
      const url = URL.createObjectURL(pdfBlob)
      const win = window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 15000)
      if (!win) { doc.save(`FACTURE-${data.numeroFacture}.pdf`) }
      logDocGeneration(user, 'PDF_GENERATED', `FACTURE-${data.numeroFacture}.pdf`, 'paiements', { numeroBail: data.numeroBail })
      toast.success(`Facture ${data.numeroFacture} ouverte`, { id: toastId })
      
    } catch (error) {
      console.error('Erreur PDF:', error)
      toast.error('Erreur lors de la génération du PDF', { id: toastId })
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#0D3B1F' }}>Paiements Échelonnés</h1>
          <p className="text-gray-500">
            Gestion des encaissements et facturation
            {totalCount > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: '#E8F5EC', color: '#1A6B35' }}>
                {totalCount} paiement{totalCount > 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadRegistre}
            className="flex items-center gap-2 px-4 py-2 font-medium rounded-lg transition-all"
            style={{ background: '#FEF3C7', color: '#92400E' }}
          >
            <Wallet size={18} />
            Registre de caisse
          </button>
          <button
            onClick={handleRapportGlobal}
            disabled={rapportLoading}
            className="flex items-center gap-2 px-4 py-2 font-medium rounded-lg transition-all disabled:opacity-60"
            style={{ background: '#E0F2FE', color: '#0369A1' }}
          >
            <FileDown size={18} />
            {rapportLoading ? 'Génération...' : 'Rapport Global PDF'}
          </button>
          <button
            onClick={loadPaymentsSilent}
            className="flex items-center gap-2 px-3 py-2 font-medium rounded-lg transition-all"
            style={{ background: '#F0FDF4', color: '#166534' }}
            title={lastRefresh ? `Dernière sync: ${lastRefresh.toLocaleTimeString('fr-FR')}` : 'Actualiser'}
          >
            <RefreshCw size={16} />
            {lastRefresh && <span className="text-xs">{lastRefresh.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>}
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 font-medium rounded-lg transition-all border-2"
            style={{ background: 'white', color: '#1A6B35', borderColor: '#1A6B35' }}
          >
            <TableProperties size={18} />
            Excel
          </button>
          <button
            onClick={() => setShowPaymentModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-white font-medium rounded-lg transition-all"
            style={{ background: '#1A6B35' }}
          >
            <Plus size={18} />
            Nouveau paiement
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div className="p-4 rounded-lg" style={{ background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={20} style={{ color: '#6B7280' }} />
            <input
              type="text"
              placeholder="Rechercher par n° facture, client..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border-2 rounded-lg outline-none transition-all"
              style={{ borderColor: '#E8F5EC' }}
            />
          </div>
          <div className="flex items-center gap-2">
            {/* Indicateur de connexion temps réel */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium" style={{ background: isRealtimeConnected ? '#DCFCE7' : '#FEE2E2', color: isRealtimeConnected ? '#166534' : '#991B1B' }}>
              <Wifi size={14} className={isRealtimeConnected ? 'animate-pulse' : ''} />
              {isRealtimeConnected ? 'Temps réel actif' : 'Connecté'}
            </div>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="px-4 py-2 border-2 rounded-lg outline-none text-sm"
              style={{ borderColor: '#E8F5EC' }}
            />
            {filterDate && (
              <button
                onClick={() => setFilterDate('')}
                className="px-3 py-2 rounded-lg text-sm font-medium"
                style={{ background: '#E8F5EC', color: '#1A6B35' }}
                title="Voir tous les paiements"
              >
                Tous
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tableau des Paiements */}
      <div className="rounded-lg overflow-hidden" style={{ background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-transparent" style={{ borderColor: '#1A6B35' }} />
            {!isAuthenticated ? (
              <div className="text-center">
                <p className="text-blue-600 text-sm mb-2">Connexion en cours...</p>
              </div>
            ) : loadError ? (
              <div className="text-center">
                <p className="text-red-600 text-sm mb-2">{loadError}</p>
                <button 
                  onClick={loadInitial}
                  className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm hover:bg-green-200"
                >
                  Réessayer
                </button>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-gray-500 text-sm">Chargement des paiements...</p>
              </div>
            )}
          </div>
        ) : payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64" style={{ color: '#9CA3AF' }}>
            <Receipt size={48} className="mb-4" />
            <p>Aucun paiement trouvé</p>
            <button 
              onClick={loadPayments}
              className="mt-4 px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 text-sm font-medium"
            >
              Rafraîchir
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead style={{ background: '#F9FAFB' }}>
                <tr>
                  <th className="px-4 py-4 text-left text-sm font-semibold" style={{ color: '#374151' }}>N° Facture</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold" style={{ color: '#374151' }}>Client</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold" style={{ color: '#374151' }}>Date</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold" style={{ color: '#374151' }}>Montant versé</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold" style={{ color: '#374151' }}>Mode</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold" style={{ color: '#374151' }}>Progression bail</th>
                  <th className="px-4 py-4 text-center text-sm font-semibold" style={{ color: '#374151' }}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: '#E8F5EC' }}>
                {payments.slice((currentPage-1)*PAGE_SIZE, currentPage*PAGE_SIZE).map((payment) => {
                    // Calcul progression du bail
                    const allLeasePayments = payment.lease?.payments || []
                    const montantInit = payment.lease?.montantInitial || payment.lease?.calculs?.montantInitial || 0
                    const totalPaye = allLeasePayments.reduce ? allLeasePayments.reduce((s, p) => s + (p.montantVerse || 0), 0) : 0
                    const progression = montantInit > 0 ? Math.min(100, Math.round((totalPaye / montantInit) * 100)) : null
                    const solde = progression !== null && progression >= 100
                    const aucunPaiement = progression !== null && totalPaye === 0

                    return (
                    <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-4">
                      <p className="font-bold text-sm" style={{ color: '#C8960C' }}>{payment.numeroFacture}</p>
                      <p className="text-xs" style={{ color: '#6B7280' }}>Bail: {payment.lease?.numeroBail}</p>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <User size={15} style={{ color: '#1A6B35' }} />
                        <span className="font-medium text-sm" style={{ color: '#374151' }}>
                          {payment.lease?.client?.prenom} {payment.lease?.client?.nom}
                        </span>
                      </div>
                      <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
                        {formatPhone(payment.lease?.client?.telephone)}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm" style={{ color: '#374151' }}>{formatDate(payment.datePaiement)}</p>
                      <p className="text-xs" style={{ color: '#6B7280' }}>{new Date(payment.datePaiement).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-bold" style={{ color: '#10B981' }}>+{formatCurrency(payment.montantVerse)}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className="px-2 py-1 rounded text-xs font-medium" style={{ background: '#E8F5EC', color: '#1A6B35' }}>
                        {payment.modePaiement}
                      </span>
                    </td>
                    <td className="px-4 py-4" style={{ minWidth: 140 }}>
                      {progression !== null ? (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span
                              className="text-xs font-bold px-1.5 py-0.5 rounded"
                              style={{
                                background: solde ? '#DCFCE7' : aucunPaiement ? '#FEE2E2' : '#DBEAFE',
                                color: solde ? '#166534' : aucunPaiement ? '#DC2626' : '#1D4ED8'
                              }}
                            >
                              {solde ? '✅ SOLDÉ' : aucunPaiement ? '🔴 AUCUN' : `🔵 ${progression}%`}
                            </span>
                            <span className="text-xs" style={{ color: '#6B7280' }}>{progression}%</span>
                          </div>
                          <div className="h-2 rounded-full overflow-hidden" style={{ background: '#E8F5EC', width: 120 }}>
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${progression}%`,
                                background: solde ? '#10B981' : aucunPaiement ? '#DC2626' : '#3B82F6'
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs" style={{ color: '#9CA3AF' }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openDetail(payment)}
                          className="p-2 rounded transition-colors"
                          style={{ background: '#DBEAFE', color: '#1D4ED8' }}
                          title="Aperçu du paiement"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => generatePDF(payment)}
                          className="p-2 rounded transition-colors"
                          style={{ background: '#FEF3C7', color: '#92400E' }}
                          title="Imprimer facture PDF"
                        >
                          <Printer size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(payment.id)}
                          className="p-2 rounded transition-colors"
                          style={{ background: '#FEE2E2', color: '#DC2626' }}
                          title="Supprimer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          currentPage={currentPage}
          totalPages={Math.ceil(payments.length / PAGE_SIZE)}
          onPageChange={setCurrentPage}
          totalItems={payments.length}
          pageSize={PAGE_SIZE}
        />
      </div>

      {/* Modal - Registre de Caisse */}
      {showRegistreModal && registre && (
        <RegistreModal 
          registre={registre}
          onClose={() => setShowRegistreModal(false)}
        />
      )}

      {/* Modal - Aperçu Paiement */}
      {showDetailModal && selectedPayment && (
        <PaymentDetailModal
          payment={selectedPayment}
          onClose={() => { setShowDetailModal(false); setSelectedPayment(null) }}
          onPrint={() => generatePDF(selectedPayment)}
        />
      )}

      {/* Modal - Nouveau Paiement */}
      {showPaymentModal && (
        <PaymentModal 
          leases={leases}
          clients={clients}
          selectedLease={selectedLease}
          onClose={() => {
            setShowPaymentModal(false)
            setSelectedLease(null)
            loadPayments()
          }}
          onSuccess={loadPayments}
        />
      )}
    </div>
  )
}

// ============================================
// MODAL - REGISTRE DE CAISSE
// ============================================
const RegistreModal = ({ registre, onClose }) => {
  // Export Registre de Caisse PDF
  const exportRegistrePDF = () => {
    try {
      const doc = new jsPDF('p', 'mm', 'a4')
      let y = 40

      addWatermark(doc)
      addPdfHeader(doc, 'REGISTRE DE CAISSE', `Date: ${formatDate(registre.date)}`)

      // KPIs
      addInfoCard(doc, 'Transactions', registre.entrees.length.toString(), 20, y, 50)
      addInfoCard(doc, 'Paiements', registre.nombreTransactions.toString(), 80, y, 50)
      addInfoCard(doc, 'Total journée', formatCurrency(registre.totalJournee), 140, y, 50)
      y += 25

      addInfoCard(doc, 'Solde global', formatCurrency(registre.soldeGlobal), 20, y, 50)
      y += 30

      if (registre.entrees.length === 0) {
        doc.setFontSize(12)
        doc.setTextColor('#9CA3AF')
        doc.text('Aucune entrée pour cette date', doc.internal.pageSize.getWidth() / 2, y + 20, { align: 'center' })
      } else {
        // Tableau des entrées
        y = addSectionTitle(doc, `Détail des entrées (${registre.entrees.length})`, y)

        const data = registre.entrees.map(e => [
          e.numeroFacture,
          `${e.lease?.client?.prenom || ''} ${e.lease?.client?.nom || ''}`,
          new Date(e.datePaiement).toLocaleTimeString('fr-FR'),
          formatCurrency(e.montantVerse),
          e.modePaiement,
          `${e.agent?.prenom || ''} ${e.agent?.nom || ''}`
        ])

        y = addTable(doc, ['N° Facture', 'Client', 'Heure', 'Montant', 'Mode', 'Agent'], data, y, [30, 45, 25, 30, 30, 35])
      }

      addPdfFooter(doc)
      doc.save(`REGISTRE-CAISSE-${registre.date}.pdf`)
      logDocGeneration(user, 'PDF_GENERATED', `REGISTRE-CAISSE-${registre.date}.pdf`, 'paiements')
      toast.success('Registre de caisse exporté en PDF')
    } catch (error) {
      console.error('Erreur PDF:', error)
      toast.error('Erreur lors de l\'export PDF')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl">
        <div className="p-6 border-b" style={{ borderColor: '#E8F5EC' }}>
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold" style={{ color: '#0D3B1F' }}>Registre de Caisse</h2>
              <p className="text-sm" style={{ color: '#6B7280' }}>{formatDate(registre.date)}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={exportRegistrePDF}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors"
                style={{ background: '#FEF3C7', color: '#92400E' }}
                title="Exporter le registre en PDF"
              >
                <Printer size={18} />
                PDF
              </button>
              <div className="text-right">
                <p className="text-xs" style={{ color: '#6B7280' }}>Total journée</p>
                <p className="text-xl font-bold" style={{ color: '#10B981' }}>{formatCurrency(registre.totalJournee)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs" style={{ color: '#6B7280' }}>Solde global</p>
                <p className="text-xl font-bold" style={{ color: '#0D3B1F' }}>{formatCurrency(registre.soldeGlobal)}</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
                <X size={24} style={{ color: '#6B7280' }} />
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="p-4 rounded-lg text-center" style={{ background: '#F0FDF4' }}>
              <p className="text-2xl font-bold" style={{ color: '#10B981' }}>{registre.entrees.length}</p>
              <p className="text-sm" style={{ color: '#6B7280' }}>Transactions</p>
            </div>
            <div className="p-4 rounded-lg text-center" style={{ background: '#FEF3C7' }}>
              <p className="text-2xl font-bold" style={{ color: '#92400E' }}>{registre.nombreTransactions}</p>
              <p className="text-sm" style={{ color: '#6B7280' }}>Nombre de paiements</p>
            </div>
            <div className="p-4 rounded-lg text-center" style={{ background: '#DBEAFE' }}>
              <p className="text-2xl font-bold" style={{ color: '#1D4ED8' }}>{formatCurrency(registre.totalJournee)}</p>
              <p className="text-sm" style={{ color: '#6B7280' }}>Entrées du jour</p>
            </div>
          </div>

          <h3 className="font-semibold mb-3" style={{ color: '#0D3B1F' }}>Détail des entrées</h3>
          {registre.entrees.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border" style={{ borderColor: '#E8F5EC' }}>
              <table className="w-full">
                <thead style={{ background: '#F9FAFB' }}>
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium" style={{ color: '#6B7280' }}>N° Facture</th>
                    <th className="px-4 py-2 text-left text-sm font-medium" style={{ color: '#6B7280' }}>Client</th>
                    <th className="px-4 py-2 text-left text-sm font-medium" style={{ color: '#6B7280' }}>Heure</th>
                    <th className="px-4 py-2 text-left text-sm font-medium" style={{ color: '#6B7280' }}>Montant</th>
                    <th className="px-4 py-2 text-left text-sm font-medium" style={{ color: '#6B7280' }}>Mode</th>
                    <th className="px-4 py-2 text-left text-sm font-medium" style={{ color: '#6B7280' }}>Agent</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: '#E8F5EC' }}>
                  {registre.entrees.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm font-medium" style={{ color: '#C8960C' }}>{entry.numeroFacture}</td>
                      <td className="px-4 py-2 text-sm" style={{ color: '#374151' }}>
                        {entry.lease?.client?.prenom} {entry.lease?.client?.nom}
                      </td>
                      <td className="px-4 py-2 text-sm" style={{ color: '#6B7280' }}>
                        {new Date(entry.datePaiement).toLocaleTimeString('fr-FR')}
                      </td>
                      <td className="px-4 py-2 text-sm font-bold" style={{ color: '#10B981' }}>
                        +{formatCurrency(entry.montantVerse)}
                      </td>
                      <td className="px-4 py-2 text-sm" style={{ color: '#6B7280' }}>{entry.modePaiement}</td>
                      <td className="px-4 py-2 text-sm" style={{ color: '#6B7280' }}>
                        {entry.agent?.prenom} {entry.agent?.nom}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center py-8" style={{ color: '#9CA3AF' }}>Aucune entrée pour cette date</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================
// MODAL - NOUVEAU PAIEMENT ULTRA-MODERNE
// ============================================
const PaymentModal = ({ leases = [], clients = [], selectedLease = null, onClose, onSuccess, loadingLeases = false }) => {
  // 🛡️ GARDE ULTRA-ROBUSTE - Vérifier que leases est un tableau valide
  const safeLeases = Array.isArray(leases) ? leases : []
  
  const [formData, setFormData] = useState({
    leaseId: selectedLease?.id || '',
    montantVerse: selectedLease?.montantRestant || '',
    modePaiement: 'ESPECES',
    notes: ''
  })
  
  // 🔍 État pour la recherche
  const [bailSearch, setBailSearch] = useState('')
  const [showBailDropdown, setShowBailDropdown] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const bailInputRef = useRef(null)

  // 👤 Sélection par client
  const [clientSearch, setClientSearch] = useState('')
  const [selectedClientId, setSelectedClientId] = useState(null)
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const safeClients = Array.isArray(clients) ? clients : []

  // Baux filtrés selon client sélectionné
  const leasesForClient = selectedClientId
    ? safeLeases.filter(l => l.clientId === selectedClientId || l.client?.id === selectedClientId)
    : safeLeases

  const filteredClients = safeClients.filter(c => {
    if (!clientSearch) return true
    const s = clientSearch.toLowerCase()
    return `${c.prenom} ${c.nom}`.toLowerCase().includes(s) ||
           (c.telephone || '').includes(s)
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    
    // Validation préalable
    if (!formData.leaseId) {
      setError('Veuillez sélectionner un bail')
      toast.error('Veuillez sélectionner un bail')
      return
    }
    
    const montant = parseFloat(formData.montantVerse)
    if (!montant || montant <= 0) {
      setError('Le montant doit être supérieur à 0')
      toast.error('Le montant doit être supérieur à 0')
      return
    }
    
    setIsSubmitting(true)
    
    try {
      const payload = {
        leaseId: parseInt(formData.leaseId),
        montantVerse: montant,
        modePaiement: formData.modePaiement,
        notes: formData.notes || undefined
      }
      
      console.log('[PaymentModal] Envoi paiement:', payload)
      await createPayment(payload)
      toast.success('✅ Paiement enregistré avec succès')
      
      if (onSuccess) await onSuccess()
      onClose()
    } catch (error) {
      console.error('[PaymentModal] Erreur:', error)
      const message = error.response?.data?.message || error.response?.data?.details || 'Erreur lors de l\'enregistrement'
      setError(message)
      toast.error(`❌ ${message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  // 🛡️ Trouver le bail sélectionné avec sécurité
  const selectedLeaseData = safeLeases.find(l => l && l.id === parseInt(formData.leaseId))

  // 🔍 Filtrer les baux avec protection complète
  const filteredLeases = leasesForClient.filter(lease => {
    if (!lease || typeof lease !== 'object') return false
    if (!bailSearch) return true
    
    try {
      const search = bailSearch.toLowerCase()
      const clientName = `${lease.client?.prenom || ''} ${lease.client?.nom || ''}`.toLowerCase()
      const bailNum = (lease.numeroBail || '').toLowerCase()
      const phone = lease.client?.telephone || ''
      
      return clientName.includes(search) || bailNum.includes(search) || phone.includes(search)
    } catch (e) {
      return false
    }
  }).sort((a, b) => {
    // Trier par reste dû décroissant
    const resteA = a?.calculs?.resteDu || 0
    const resteB = b?.calculs?.resteDu || 0
    return resteB - resteA
  })

  // Sélectionner un bail avec validation
  const selectBail = (lease) => {
    if (!lease || !lease.id) {
      console.error('[PaymentModal] Bail invalide:', lease)
      return
    }
    
    setFormData({ 
      ...formData, 
      leaseId: String(lease.id),
      montantVerse: lease.calculs?.resteDu || ''
    })
    setBailSearch(`${lease.numeroBail || 'N/A'} - ${lease.client?.prenom || ''} ${lease.client?.nom || ''}`)
    setShowBailDropdown(false)
    setError(null)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b" style={{ borderColor: '#E8F5EC', background: 'linear-gradient(135deg, #0D3B1F 0%, #1A6B35 100%)' }}>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <CreditCard size={24} className="text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Nouveau Paiement</h2>
                <p className="text-white/80 text-sm">Enregistrer un encaissement</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
              <X size={24} className="text-white" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          {/* � AFFICHAGE DES ERREURS */}
          {error && (
            <div className="p-4 rounded-xl bg-red-50 border-2 border-red-200 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <span className="text-red-600 font-bold">!</span>
              </div>
              <div>
                <p className="font-bold text-red-800">Erreur</p>
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            </div>
          )}
          
          {/* 👤 SÉLECTION PAR CLIENT (optionnel) */}
          {safeClients.length > 0 && (
            <div className="relative">
              <label className="block text-sm font-bold mb-2" style={{ color: '#0D3B1F' }}>
                Filtrer par client (optionnel)
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2" size={16} style={{ color: '#6B7280' }} />
                <input
                  type="text"
                  value={clientSearch}
                  onChange={e => { setClientSearch(e.target.value); setShowClientDropdown(true); if (!e.target.value) { setSelectedClientId(null) } }}
                  onFocus={() => setShowClientDropdown(true)}
                  placeholder="Taper le nom du client pour filtrer les baux..."
                  className="w-full pl-9 pr-4 py-2.5 border-2 rounded-xl outline-none transition-all"
                  style={{ borderColor: selectedClientId ? '#1A6B35' : '#E8F5EC' }}
                />
                {selectedClientId && (
                  <button type="button" onClick={() => { setSelectedClientId(null); setClientSearch(''); setFormData({...formData, leaseId: '', montantVerse: ''}); setBailSearch('') }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500">
                    <X size={16} />
                  </button>
                )}
              </div>
              {showClientDropdown && clientSearch && filteredClients.length > 0 && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowClientDropdown(false)} />
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 rounded-xl shadow-xl max-h-48 overflow-y-auto z-50" style={{ borderColor: '#E8F5EC' }}>
                    {filteredClients.slice(0, 8).map(c => (
                      <button key={c.id} type="button"
                        onClick={() => { setSelectedClientId(c.id); setClientSearch(`${c.prenom} ${c.nom}`); setShowClientDropdown(false); setBailSearch(''); setFormData({...formData, leaseId: '', montantVerse: ''}) }}
                        className="w-full px-4 py-2.5 text-left hover:bg-[#E8F5EC] flex items-center gap-3 border-b last:border-0 transition-colors"
                        style={{ borderColor: '#F3F4F6' }}
                      >
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: '#1A6B35' }}>
                          {c.prenom?.[0]}{c.nom?.[0]}
                        </div>
                        <div>
                          <p className="font-medium text-sm" style={{ color: '#0D3B1F' }}>{c.prenom} {c.nom}</p>
                          <p className="text-xs" style={{ color: '#6B7280' }}>{c.telephone}</p>
                        </div>
                        <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ background: '#E8F5EC', color: '#1A6B35' }}>
                          {safeLeases.filter(l => l.clientId === c.id || l.client?.id === c.id).length} bail(s)
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* 🔍 RECHERCHE BAIL ULTRA-MODERNE */}
          <div className="relative">
            <label className="block text-sm font-bold mb-2 flex items-center gap-2" style={{ color: '#0D3B1F' }}>
              <User size={16} />
              Rechercher un bail (nom, n° ou téléphone) *
            </label>
            
            {loadingLeases ? (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 border-2" style={{ borderColor: '#E8F5EC' }}>
                <div className="w-5 h-5 border-2 border-[#1A6B35] border-t-transparent rounded-full animate-spin" />
                <span className="text-sm" style={{ color: '#6B7280' }}>Chargement des baux...</span>
              </div>
            ) : safeLeases.length === 0 ? (
              <div className="p-4 rounded-xl bg-yellow-50 border-2 border-yellow-200">
                <p className="text-sm" style={{ color: '#92400E' }}>
                  ⚠️ Aucun bail disponible pour le paiement. Vérifiez que des baux avec reste dû existent.
                </p>
              </div>
            ) : (
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2" size={20} style={{ color: '#6B7280' }} />
              <input
                ref={bailInputRef}
                type="text"
                value={bailSearch}
                onChange={(e) => {
                  setBailSearch(e.target.value)
                  setShowBailDropdown(true)
                  if (!e.target.value) {
                    setFormData({ ...formData, leaseId: '', montantVerse: '' })
                  }
                }}
                onFocus={() => setShowBailDropdown(true)}
                placeholder="Tapez le nom du client, n° du bail ou téléphone..."
                className="w-full pl-12 pr-4 py-3 border-2 rounded-xl outline-none focus:ring-2 focus:ring-[#1A6B35] transition-all"
                style={{ borderColor: '#E8F5EC' }}
              />
              {selectedLeaseData && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                    ✓ Sélectionné
                  </span>
                </div>
              )}
            
            {/* Dropdown des résultats */}
            {showBailDropdown && (
              <>
                <div 
                  className="fixed inset-0 z-40"
                  onClick={() => setShowBailDropdown(false)}
                />
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 rounded-xl shadow-2xl max-h-72 overflow-y-auto z-50" style={{ borderColor: '#E8F5EC' }}>
                  {filteredLeases.length === 0 ? (
                    <div className="p-6 text-center">
                      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                        <Search size={24} style={{ color: '#6B7280' }} />
                      </div>
                      <p className="text-sm font-medium" style={{ color: '#6B7280' }}>
                        {bailSearch ? 'Aucun bail trouvé' : 'Commencez à taper pour chercher'}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="px-4 py-2 bg-gray-50 border-b text-xs font-medium" style={{ color: '#6B7280' }}>
                        {filteredLeases.length} bail(s) trouvé(s) - Cliquez pour sélectionner
                      </div>
                      {filteredLeases.map((lease) => (
                        <button
                          key={lease.id}
                          type="button"
                          onClick={() => selectBail(lease)}
                          className="w-full px-4 py-3 text-left hover:bg-[#E8F5EC] border-b last:border-b-0 transition-colors"
                          style={{ borderColor: '#F3F4F6' }}
                        >
                          <div className="flex items-center gap-3">
                            {/* Avatar */}
                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ background: '#1A6B35' }}>
                              {lease.client?.prenom?.[0]}{lease.client?.nom?.[0]}
                            </div>
                            
                            {/* Infos */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold truncate" style={{ color: '#0D3B1F' }}>
                                  {lease.client?.prenom} {lease.client?.nom}
                                </span>
                                <span className="px-2 py-0.5 rounded text-xs font-medium shrink-0" style={{ background: '#DCFCE7', color: '#166534' }}>
                                  {lease.numeroBail}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-xs mt-1">
                                <span style={{ color: '#6B7280' }}>📞 {lease.client?.telephone}</span>
                                <span className="font-bold" style={{ color: lease.calculs?.resteDu > 0 ? '#DC2626' : '#10B981' }}>
                                  Reste: {formatCurrency(lease.calculs?.resteDu || 0)}
                                </span>
                              </div>
                            </div>
                            
                            {/* Check */}
                            {formData.leaseId === lease.id.toString() && (
                              <CheckCircle size={20} style={{ color: '#1A6B35' }} />
                            )}
                          </div>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </>
            )}
            </div>
            )}
          </div>

          {/* 📊 RÉSUMÉ DU BAIL SÉLECTIONNÉ */}
          {selectedLeaseData && (
            <div className="p-4 rounded-xl border-2" style={{ background: 'linear-gradient(135deg, #F9FAFB 0%, #E8F5EC 100%)', borderColor: '#1A6B35' }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold" style={{ background: '#1A6B35' }}>
                  {selectedLeaseData.client?.prenom?.[0]}{selectedLeaseData.client?.nom?.[0]}
                </div>
                <div>
                  <p className="font-bold" style={{ color: '#0D3B1F' }}>
                    {selectedLeaseData.client?.prenom} {selectedLeaseData.client?.nom}
                  </p>
                  <p className="text-sm" style={{ color: '#6B7280' }}>
                    {selectedLeaseData.numeroBail} • 📞 {selectedLeaseData.client?.telephone}
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-white text-center">
                  <p className="text-xs" style={{ color: '#6B7280' }}>Montant initial</p>
                  <p className="font-bold" style={{ color: '#0D3B1F' }}>{formatCurrency(selectedLeaseData.montantInitial)}</p>
                </div>
                <div className="p-3 rounded-lg bg-white text-center">
                  <p className="text-xs" style={{ color: '#6B7280' }}>Déjà payé</p>
                  <p className="font-bold" style={{ color: '#10B981' }}>{formatCurrency(selectedLeaseData.calculs?.totalPaye || 0)}</p>
                </div>
                <div className="p-3 rounded-lg bg-white text-center">
                  <p className="text-xs" style={{ color: '#6B7280' }}>Reste dû</p>
                  <p className="font-bold" style={{ color: selectedLeaseData.calculs?.resteDu > 0 ? '#DC2626' : '#10B981' }}>
                    {formatCurrency(selectedLeaseData.calculs?.resteDu || 0)}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#0D3B1F' }}>
                Montant versé (FCFA) *
              </label>
              <input
                type="number"
                min="0"
                step="any"
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
                <option value="CHEQUE">Chèque</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0D3B1F' }}>
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              rows={3}
              className="w-full px-4 py-2 border-2 rounded-lg outline-none"
              style={{ borderColor: '#E8F5EC' }}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-3 font-medium rounded-lg transition-colors disabled:opacity-50"
              style={{ background: '#F3F4F6', color: '#4B5563' }}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !formData.leaseId}
              className="flex-1 py-3 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ background: '#1A6B35' }}
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <CreditCard size={18} />
                  Enregistrer le paiement
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============================================
// MODAL - APERÇU DÉTAIL PAIEMENT
// ============================================
const PaymentDetailModal = ({ payment, onClose, onPrint }) => {
  const montantInit = payment.lease?.montantInitial || payment.lease?.calculs?.montantInitial || 0
  const totalPaye = payment.lease?.calculs?.totalPaye ?? payment.montantVerse ?? 0
  const resteDu = payment.lease?.calculs?.resteDu ?? Math.max(0, montantInit - totalPaye)
  const progression = montantInit > 0 ? Math.min(100, Math.round((totalPaye / montantInit) * 100)) : 0

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl overflow-hidden" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        {/* En-tête */}
        <div className="p-6" style={{ background: '#0D3B1F' }}>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: '#C8960C' }}>REÇU DE PAIEMENT</p>
              <h2 className="text-xl font-bold text-white">{payment.numeroFacture}</h2>
              <p className="text-sm mt-1" style={{ color: '#A7C5B4' }}>{formatDateTime(payment.datePaiement)}</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10">
              <X size={20} className="text-white" />
            </button>
          </div>
        </div>

        {/* Corps */}
        <div className="p-6 space-y-4">
          {/* Client */}
          <div className="flex items-start gap-3 p-4 rounded-xl" style={{ background: '#F0FDF4' }}>
            <User size={20} style={{ color: '#1A6B35' }} className="mt-0.5" />
            <div>
              <p className="text-xs font-medium mb-0.5" style={{ color: '#6B7280' }}>CLIENT</p>
              <p className="font-semibold" style={{ color: '#0D3B1F' }}>
                {payment.lease?.client?.prenom} {payment.lease?.client?.nom}
              </p>
              {payment.lease?.client?.telephone && (
                <p className="text-sm flex items-center gap-1 mt-0.5" style={{ color: '#6B7280' }}>
                  <Phone size={12} /> {formatPhone(payment.lease.client.telephone)}
                </p>
              )}
            </div>
          </div>

          {/* Bail */}
          <div className="flex items-start gap-3 p-4 rounded-xl" style={{ background: '#F9FAFB' }}>
            <Home size={20} style={{ color: '#6B7280' }} className="mt-0.5" />
            <div>
              <p className="text-xs font-medium mb-0.5" style={{ color: '#6B7280' }}>BAIL</p>
              <p className="font-semibold" style={{ color: '#374151' }}>{payment.lease?.numeroBail || '-'}</p>
              {payment.lease?.unite?.numeroPorte && (
                <p className="text-sm" style={{ color: '#6B7280' }}>Porte {payment.lease.unite.numeroPorte}</p>
              )}
            </div>
          </div>

          {/* Montant */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl text-center" style={{ background: '#DCFCE7' }}>
              <p className="text-xs font-medium mb-1" style={{ color: '#6B7280' }}>Versé</p>
              <p className="font-bold" style={{ color: '#10B981' }}>{formatCurrency(payment.montantVerse)}</p>
            </div>
            <div className="p-3 rounded-xl text-center" style={{ background: '#FEF3C7' }}>
              <p className="text-xs font-medium mb-1" style={{ color: '#6B7280' }}>Reste dû</p>
              <p className="font-bold" style={{ color: '#92400E' }}>{formatCurrency(resteDu)}</p>
            </div>
            <div className="p-3 rounded-xl text-center" style={{ background: '#DBEAFE' }}>
              <p className="text-xs font-medium mb-1" style={{ color: '#6B7280' }}>Progression</p>
              <p className="font-bold" style={{ color: '#1D4ED8' }}>{progression}%</p>
            </div>
          </div>

          {/* Barre de progression */}
          <div>
            <div className="h-3 rounded-full overflow-hidden" style={{ background: '#E8F5EC' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${progression}%`, background: progression >= 100 ? '#10B981' : '#1A6B35' }} />
            </div>
          </div>

          {/* Mode paiement */}
          <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: '#F9FAFB' }}>
            <CardIcon size={16} style={{ color: '#6B7280' }} />
            <span className="text-sm font-medium" style={{ color: '#374151' }}>Mode : {payment.modePaiement}</span>
          </div>

          {payment.notes && (
            <div className="p-3 rounded-xl" style={{ background: '#FFFBEB' }}>
              <p className="text-xs font-medium mb-1" style={{ color: '#92400E' }}>NOTES</p>
              <p className="text-sm" style={{ color: '#374151' }}>{payment.notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 flex gap-3 border-t" style={{ borderColor: '#E8F5EC' }}>
          <button
            onClick={onPrint}
            className="flex-1 flex items-center justify-center gap-2 py-3 font-medium rounded-xl transition-all"
            style={{ background: '#FEF3C7', color: '#92400E' }}
          >
            <Printer size={18} />
            Imprimer facture PDF
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 font-medium rounded-xl transition-all"
            style={{ background: '#F3F4F6', color: '#4B5563' }}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}

export default PaiementsPage
