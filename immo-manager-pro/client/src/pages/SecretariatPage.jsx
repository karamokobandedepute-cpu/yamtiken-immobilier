import { useEffect, useState, useRef } from 'react'
import { Plus, Search, Edit2, Trash2, CheckCircle, Clock, X, User, Phone, Mail, Calendar, MessageSquare, Building, FileText, Bell, AlertTriangle, TrendingUp, Check, Download, Printer } from 'lucide-react'
import { fetchVisites, fetchRelances, createVisite, updateVisite, deleteVisite, traiterRelance, fetchAlertesDashboard, marquerAlerteLue, traiterAlerte, fetchBuildings, fetchBiens, invalidateCacheFor } from '../utils/api'
import { formatDate, formatDateTime, getMotifVisiteLabel, getMotifVisiteBadgeStyle, getStatutRelanceLabel, getStatutRelanceBadgeStyle, getTypeAlerteLabel, getTypeAlerteBadgeStyle } from '../utils/formatters'
import toast from 'react-hot-toast'
import jsPDF from 'jspdf'
import { addPdfHeader, addPdfFooter, addWatermark, addSectionTitle, addTable, addInfoCard, checkPageBreak, generateOffrePDF, generateFicheClientOffre, COMPANY_INFO } from '../utils/pdfUtils'
import { logDocGeneration } from '../utils/pdfLogger'
import { useAuthStore } from '../stores/authStore'

const SecretariatPage = () => {
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('tab') || 'visites'
  })
  
  const [visites, setVisites] = useState([])
  const [relances, setRelances] = useState([])
  const [alertesStats, setAlertesStats] = useState({ total: 0, nonLues: 0, alertes: [] })
  const [buildings, setBuildings] = useState([])
  const [biensLoading, setBiensLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  
  // Filtres
  const [searchTerm, setSearchTerm] = useState('')
  const [filterMotif, setFilterMotif] = useState('')
  const [filterDateDebut, setFilterDateDebut] = useState('')
  const [filterDateFin, setFilterDateFin] = useState('')
  
  // Modal
  const [showModal, setShowModal] = useState(false)
  const [selectedVisite, setSelectedVisite] = useState(null)

  // Dropdown Fiches Offre
  const [showFichesMenu, setShowFichesMenu] = useState(false)
  const [globalSearch, setGlobalSearch] = useState('')
  const [lastLoaded, setLastLoaded] = useState(null)

  // Auto-refresh + Notifications
  const [autoRefresh, setAutoRefresh] = useState(0)
  const [countdown, setCountdown] = useState(0)
  const [notifEnabled, setNotifEnabled] = useState(false)
  const autoRefreshRef = useRef(null)
  const countdownRef = useRef(null)
  const prevUrgentesRef = useRef(0)

  // Historique session + Plein écran
  const [actionHistory, setActionHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Statut serveur
  const [serverStatus, setServerStatus] = useState('checking')
  const serverCheckRef = useRef(null)

  const checkServerStatus = async () => {
    try {
      const res = await fetchVisites()
      setServerStatus(res ? 'online' : 'offline')
    } catch {
      setServerStatus('offline')
    }
  }

  useEffect(() => {
    checkServerStatus()
    serverCheckRef.current = setInterval(checkServerStatus, 60000)
    return () => clearInterval(serverCheckRef.current)
  }, [])

  const logAction = (type, label) => {
    setActionHistory(prev => [{ type, label, time: new Date() }, ...prev].slice(0, 30))
  }

  const handleGlobalSearch = (val) => {
    setGlobalSearch(val)
    if (!val) return
    if (activeTab === 'visites') {
      setSearchTerm(val)
    } else if (activeTab === 'relances') {
      // relances filtre local inside RelancesTab
    } else {
      setActiveTab('visites')
      setSearchTerm(val)
    }
  }

  // Modal de confirmation
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', icon: null, color: '', onConfirm: null })

  const openConfirm = ({ title, message, icon, color, onConfirm }) => {
    setConfirmModal({ open: true, title, message, icon, color, onConfirm })
  }
  const closeConfirm = () => setConfirmModal({ open: false, title: '', message: '', icon: null, color: '', onConfirm: null })

  useEffect(() => {
    loadData()
  }, [activeTab, searchTerm, filterMotif, filterDateDebut, filterDateFin])

  useEffect(() => {
    if (countdownRef.current) clearInterval(countdownRef.current)
    if (autoRefresh > 0) {
      const total = autoRefresh * 60
      setCountdown(total)
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            loadData()
            return total
          }
          return prev - 1
        })
      }, 1000)
    } else {
      setCountdown(0)
    }
    return () => { if (countdownRef.current) clearInterval(countdownRef.current) }
  }, [autoRefresh, activeTab])

  useEffect(() => {
    const handleKey = (e) => {
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if ((e.key === 'n' || e.key === 'N') && activeTab === 'visites') openModal()
      if (e.key === 'r' || e.key === 'R') loadData()
      if (e.key === 'Escape') {
        if (showModal) closeModal()
        if (confirmModal.open) closeConfirm()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [activeTab, showModal, confirmModal.open])

  const loadData = async () => {
    setLoading(true)
    try {
      if (activeTab === 'visites') {
        const params = {}
        if (searchTerm) params.search = searchTerm
        if (filterMotif) params.motif = filterMotif
        if (filterDateDebut) params.dateDebut = filterDateDebut
        if (filterDateFin) params.dateFin = filterDateFin
        const res = await fetchVisites(Object.keys(params).length > 0 ? params : undefined)
        const data = res.data?.data || res.data || []
        setVisites(Array.isArray(data) ? data : [])
      } else if (activeTab === 'relances') {
        const res = await fetchRelances()
        const data = res.data?.data || res.data || []
        setRelances(Array.isArray(data) ? data : [])
      } else if (activeTab === 'alertes') {
        const res = await fetchAlertesDashboard()
        const data = res.data?.data || res.data || {}
        setAlertesStats(data)
      }
    } catch (error) {
      console.error('[SecretariatPage] Erreur chargement:', error)
    } finally {
      setLoading(false)
      setLastLoaded(new Date())
    }
  }

  const loadBuildings = async () => {
    setBiensLoading(true)
    try {
      invalidateCacheFor('/biens')
      const response = await fetchBiens()
      const data = response.data?.data || response.data || []
      setBuildings(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Erreur chargement biens:', error)
      toast.error('Erreur chargement des biens')
    } finally {
      setBiensLoading(false)
    }
  }

  const handleDelete = (id) => {
    openConfirm({
      title: 'Supprimer la visite',
      message: 'Êtes-vous sûr de vouloir supprimer cette visite ? Cette action est irréversible.',
      icon: 'trash',
      color: '#DC2626',
      onConfirm: async () => {
        try {
          await deleteVisite(id)
          setVisites(prev => prev.filter(v => v.id !== id))
          logAction('delete', `Visite #${id} supprimée`)
          toast.success('✅ Visite supprimée avec succès')
        } catch (error) {
          console.error('Erreur suppression:', error)
          toast.error('Erreur lors de la suppression')
        }
      }
    })
  }
  
  const handlePrint = (visite) => {
    try {
      const doc = new jsPDF('p', 'mm', 'a4')
      const pw = doc.internal.pageSize.getWidth()
      addWatermark(doc)
      addPdfHeader(doc, 'FICHE VISITE', `N° ${visite.id} — ${formatDate(visite.dateVisite)}`, user)
      let y = 48

      // Infos visiteur
      doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor('#0D3B1F')
      doc.text('INFORMATIONS VISITEUR', 15, y); y += 6
      doc.setDrawColor('#C8960C'); doc.setLineWidth(0.4); doc.line(15, y, pw-15, y); y += 6
      const rows = [
        ['Nom & Prénom', `${visite.prenomVisiteur || ''} ${visite.nomVisiteur || ''}`],
        ['Contact', visite.contact || '-'],
        ['Email', visite.email || '-'],
        ['Date visite', formatDateTime ? formatDateTime(visite.dateVisite) : formatDate(visite.dateVisite)],
        ['Bien visité', visite.bienVisite ? `${visite.bienVisite.reference || ''} — ${visite.bienVisite.titre || ''}` : `Bien #${visite.bienVisiteId}`],
        ['Motif', getMotifVisiteLabel ? getMotifVisiteLabel(visite.motif) : visite.motif],
        ['Responsable', visite.responsable || '-'],
      ]
      rows.forEach(([label, val]) => {
        doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor('#374151')
        doc.setFillColor(y % 12 < 6 ? '#F9FAFB' : '#FFFFFF'); doc.rect(15, y-3.5, pw-30, 7, 'F')
        doc.setFont('helvetica','bold'); doc.text(label, 20, y)
        doc.setFont('helvetica','normal'); doc.text(String(val), 80, y); y += 8
      })

      // Compte-rendu
      if (visite.compteRendu) {
        y += 4
        doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor('#0D3B1F')
        doc.text('COMPTE-RENDU', 15, y); y += 6
        doc.setDrawColor('#C8960C'); doc.line(15, y, pw-15, y); y += 6
        doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor('#374151')
        const lines = doc.splitTextToSize(visite.compteRendu, pw-30)
        doc.text(lines, 15, y); y += lines.length * 5 + 4
      }

      // Relance
      if (visite.relanceSouhait) {
        y += 4
        doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor('#0D3B1F')
        doc.text('RELANCE PRÉVUE', 15, y); y += 6
        doc.setDrawColor('#C8960C'); doc.line(15, y, pw-15, y); y += 6
        doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor('#374151')
        doc.text(`Date : ${visite.dateRelance ? formatDate(visite.dateRelance) : '-'}`, 20, y); y += 7
        doc.text(`Statut : ${getStatutRelanceLabel ? getStatutRelanceLabel(visite.statutRelance) : visite.statutRelance}`, 20, y)
      }

      addPdfFooter(doc, 1, true, user)
      doc.save(`FICHE-VISITE-${visite.id}.pdf`)
      logDocGeneration(user, 'PDF_GENERATED', `FICHE-VISITE-${visite.id}.pdf`, 'secretariat')
      toast.success('✅ Fiche visite générée')
    } catch (err) {
      console.error('Erreur PDF visite:', err)
      toast.error('Erreur lors de la génération')
    }
  }

  const enableNotifications = async () => {
    if (!('Notification' in window)) {
      toast.error('Notifications non supportées par votre navigateur')
      return
    }
    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      setNotifEnabled(true)
      toast.success('✅ Notifications browser activées')
      new Notification('✅ YAMTIKEN Immobilier', { body: 'Vous recevrez des alertes critiques ici', icon: '/logo.png' })
    } else {
      toast.error('Permission notifications refusée')
    }
  }

  useEffect(() => {
    const total = alertesStats?.totalUrgentes || 0
    if (notifEnabled && total > 0 && total > prevUrgentesRef.current) {
      new Notification('⚠️ YAMTIKEN — Alertes urgentes', {
        body: `${total} alerte(s) urgente(s) nécessite(nt) votre attention`,
        icon: '/logo.png'
      })
    }
    prevUrgentesRef.current = total
  }, [alertesStats?.totalUrgentes, notifEnabled])

  const handleMarquerToutesAlertesLues = async () => {
    try {
      const alertes = alertesStats.alertes || []
      const nonLues = alertes.filter(a => !a.lue)
      if (nonLues.length === 0) {
        toast('Aucune alerte non lue à marquer')
        return
      }
      await Promise.all(nonLues.map(a => marquerAlerteLue(a.id)))
      toast.success(`✅ ${nonLues.length} alerte(s) marquées comme lues`)
      loadData()
    } catch (error) {
      console.error('Erreur marquage alertes:', error)
      toast.error('Erreur lors du marquage')
    }
  }

  const handleTraiterRelance = (id, nomVisiteur) => {
    openConfirm({
      title: 'Confirmer le traitement',
      message: `Marquer la relance de ${nomVisiteur || 'ce contact'} comme traitée ?`,
      icon: 'check',
      color: '#1A6B35',
      onConfirm: async () => {
        try {
          await traiterRelance(id)
          logAction('check', `Relance traitée : ${nomVisiteur || 'Contact'}`)
          toast.success('✅ Relance marquée comme traitée')
          loadData()
        } catch (error) {
          toast.error('Erreur lors du traitement')
        }
      }
    })
  }

  const openModal = (visite = null) => {
    setSelectedVisite(visite)
    setShowModal(true)
    loadBuildings()
  }

  const closeModal = () => {
    setShowModal(false)
    setSelectedVisite(null)
    loadData()
  }

  // ============================================
  // EXPORT REGISTRE VISITES PDF
  // ============================================
  const exportVisitesPDF = () => {
    try {
      const doc = new jsPDF('p', 'mm', 'a4')
      let y = 40

      const periode = filterDateDebut && filterDateFin
        ? `Du ${formatDate(filterDateDebut)} au ${formatDate(filterDateFin)}`
        : 'Période non définie'

      addWatermark(doc)
      addPdfHeader(doc, 'REGISTRE DES VISITES', `${visites.length} visite(s) - ${periode}`)

      if (visites.length === 0) {
        doc.setFontSize(12)
        doc.setTextColor('#9CA3AF')
        doc.text('Aucune visite à afficher', doc.internal.pageSize.getWidth() / 2, y + 20, { align: 'center' })
      } else {
        // Résumé par motif
        const parMotif = {}
        visites.forEach(v => {
          parMotif[v.motif] = (parMotif[v.motif] || 0) + 1
        })

        y = addSectionTitle(doc, 'Synthèse par motif', y)

        const motifData = Object.entries(parMotif).map(([motif, count]) => [
          getMotifVisiteLabel(motif),
          count.toString()
        ])
        y = addTable(doc, ['Motif', 'Nombre'], motifData, y, [80, 50])
        y += 10

        // Tableau des visites
        y = checkPageBreak(doc, y)
        y = addSectionTitle(doc, 'Liste des visites', y)

        const data = visites.map(v => [
          formatDate(v.dateVisite),
          `${v.prenomVisiteur || ''} ${v.nomVisiteur || ''}`.trim(),
          v.contact || '-',
          getMotifVisiteLabel(v.motif),
          v.responsable || '-'
        ])

        y = addTable(doc, ['Date', 'Visiteur', 'Contact', 'Motif', 'Responsable'], data, y, [30, 45, 40, 35, 40])
      }

      addPdfFooter(doc)
      doc.save(`REGISTRE-VISITES-${new Date().toISOString().slice(0, 10)}.pdf`)
      logDocGeneration(user, 'PDF_GENERATED', `REGISTRE-VISITES-${new Date().toISOString().slice(0,10)}.pdf`, 'secretariat')
      toast.success('Registre des visites exporté en PDF')
    } catch (error) {
      console.error('Erreur PDF:', error)
      toast.error('Erreur lors de l\'export PDF')
    }
  }

  // ============================================
  // EXPORT RAPPORT RELANCES PDF
  // ============================================
  const exportRelancesPDF = () => {
    try {
      const doc = new jsPDF('p', 'mm', 'a4')
      let y = 40

      const enAttente = relances.filter(r => r.statutRelance === 'EN_ATTENTE').length
      const effectuees = relances.filter(r => r.statutRelance === 'EFFECTUEE').length

      addWatermark(doc)
      addPdfHeader(doc, 'RAPPORT DES RELANCES', `${relances.length} relance(s) - ${enAttente} en attente`)

      // Résumé
      addInfoCard(doc, 'En attente', enAttente.toString(), 20, y, 50)
      addInfoCard(doc, 'Effectuées', effectuees.toString(), 80, y, 50)
      addInfoCard(doc, 'Annulées', (relances.length - enAttente - effectuees).toString(), 140, y, 50)
      y += 25

      if (relances.length === 0) {
        doc.setFontSize(12)
        doc.setTextColor('#9CA3AF')
        doc.text('Aucune relance à afficher', doc.internal.pageSize.getWidth() / 2, y + 20, { align: 'center' })
      } else {
        // Tableau des relances
        const data = relances.map(r => [
          formatDate(r.dateRelance),
          `${r.prenomVisiteur || ''} ${r.nomVisiteur || ''}`.trim() || `${r.client?.prenom || ''} ${r.client?.nom || ''}`.trim() || '-',
          r.contact || r.client?.telephone || '-',
          getMotifVisiteLabel(r.motif),
          getStatutRelanceLabel(r.statutRelance)
        ])

        y = addTable(doc, ['Date relance', 'Contact', 'Téléphone', 'Motif', 'Statut'], data, y, [30, 40, 40, 35, 35])
      }

      addPdfFooter(doc)
      doc.save(`RAPPORT-RELANCES-${new Date().toISOString().slice(0, 10)}.pdf`)
      logDocGeneration(user, 'PDF_GENERATED', `RAPPORT-RELANCES-${new Date().toISOString().slice(0,10)}.pdf`, 'secretariat')
      toast.success('Rapport des relances exporté en PDF')
    } catch (error) {
      console.error('Erreur PDF:', error)
      toast.error('Erreur lors de l\'export PDF')
    }
  }

  // ============================================
  // EXPORT SYNTHÈSE ALERTES PDF
  // ============================================
  const exportAlertesPDF = () => {
    try {
      const doc = new jsPDF('p', 'mm', 'a4')
      let y = 40

      addWatermark(doc)
      addPdfHeader(doc, 'SYNTHÈSE DES ALERTES', 'Tableau de bord des alertes automatiques')

      if (!alertesStats) {
        doc.setFontSize(12)
        doc.setTextColor('#9CA3AF')
        doc.text('Aucune donnée disponible', doc.internal.pageSize.getWidth() / 2, y + 20, { align: 'center' })
      } else {
        // KPIs
        y = addSectionTitle(doc, 'Indicateurs clés', y)

        const kpiData = [
          ['Alertes urgentes', `${alertesStats.totalUrgentes || 0}`],
          ['Alertes non lues', `${alertesStats.nonLues || 0}`],
          ['En retard de paiement', `${alertesStats.clientsRetard || 0}`],
          ['Baux expirant', `${alertesStats.bauxExpirant || 0}`]
        ]
        y = addTable(doc, ['Indicateur', 'Valeur'], kpiData, y, [80, 50])
      }

      addPdfFooter(doc)
      doc.save(`SYNTHESE-ALERTES-${new Date().toISOString().slice(0, 10)}.pdf`)
      logDocGeneration(user, 'PDF_GENERATED', `SYNTHESE-ALERTES-${new Date().toISOString().slice(0,10)}.pdf`, 'secretariat')
      toast.success('Synthèse des alertes exportée en PDF')
    } catch (error) {
      console.error('Erreur PDF:', error)
      toast.error('Erreur lors de l\'export PDF')
    }
  }

  // ============================================
  // RÉSUMÉ HEBDOMADAIRE PDF
  // ============================================
  const exportResumeSemainePDF = () => {
    try {
      const today = new Date()
      const dayOfWeek = today.getDay()
      const monday = new Date(today)
      monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
      monday.setHours(0, 0, 0, 0)
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      sunday.setHours(23, 59, 59, 999)

      const weekVisites = visites.filter(v => {
        const d = new Date(v.dateVisite)
        return d >= monday && d <= sunday
      })

      const doc = new jsPDF('p', 'mm', 'a4')
      addWatermark(doc)
      addPdfHeader(doc, 'RÉSUMÉ HEBDOMADAIRE',
        `Semaine du ${formatDate(monday)} au ${formatDate(sunday)}`, user)
      let y = 48
      const pw = doc.internal.pageSize.getWidth()

      // KPIs semaine
      y = addSectionTitle(doc, 'Indicateurs de la semaine', y)
      const motifs = ['DECOUVERTE', 'NEGOCIATION', 'RECLAMATION', 'AUTRE']
      const kpiRows = [
        ['Total visites', `${weekVisites.length}`],
        ['Avec relance souhaitée', `${weekVisites.filter(v => v.relanceSouhait).length}`],
        ['Taux relance', weekVisites.length ? `${Math.round(weekVisites.filter(v => v.relanceSouhait).length / weekVisites.length * 100)}%` : '0%'],
        ...motifs.map(m => [getMotifVisiteLabel(m), `${weekVisites.filter(v => v.motif === m).length}`])
      ]
      y = addTable(doc, ['Indicateur', 'Valeur'], kpiRows, y, [120, 40])
      y += 6

      // Liste des visites
      if (weekVisites.length > 0) {
        y = checkPageBreak(doc, y, 20)
        y = addSectionTitle(doc, `Détail des visites (${weekVisites.length})`, y)
        const rows = weekVisites.map(v => [
          formatDate(v.dateVisite),
          `${v.prenomVisiteur || ''} ${v.nomVisiteur || ''}`.trim(),
          v.contact || '',
          getMotifVisiteLabel(v.motif),
          v.responsable || ''
        ])
        y = addTable(doc, ['Date', 'Visiteur', 'Contact', 'Motif', 'Responsable'], rows, y, [28, 45, 35, 30, 32])
      } else {
        doc.setFontSize(11); doc.setTextColor('#9CA3AF')
        doc.text('Aucune visite cette semaine', pw / 2, y + 10, { align: 'center' })
      }

      addPdfFooter(doc)
      const filename = `RESUME-SEMAINE-${monday.toISOString().slice(0,10)}.pdf`
      doc.save(filename)
      logDocGeneration(user, 'PDF_GENERATED', filename, 'secretariat')
      logAction('export', `Résumé semaine généré (${weekVisites.length} visites)`)
      toast.success(`✅ Résumé semaine généré (${weekVisites.length} visite(s))`)
    } catch (error) {
      console.error('Erreur PDF résumé:', error)
      toast.error("Erreur lors de la génération du résumé")
    }
  }

  // ============================================
  // EXPORT CSV VISITES
  // ============================================
  const exportVisitesCSV = () => {
    try {
      const headers = ['Date', 'Heure', 'Nom', 'Prénom', 'Contact', 'Email', 'Bien', 'Motif', 'Responsable', 'Relance', 'Date relance', 'Statut relance']
      const rows = visites.map(v => [
        formatDate(v.dateVisite),
        new Date(v.dateVisite).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        v.nomVisiteur || '',
        v.prenomVisiteur || '',
        v.contact || '',
        v.email || '',
        v.bienVisite?.reference || v.bienVisite?.titre || `Bien #${v.bienVisiteId}` || '',
        getMotifVisiteLabel(v.motif),
        v.responsable || '',
        v.relanceSouhait ? 'Oui' : 'Non',
        v.dateRelance ? formatDate(v.dateRelance) : '',
        v.statutRelance ? getStatutRelanceLabel(v.statutRelance) : ''
      ])
      const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
        .join('\n')
      const BOM = '\uFEFF'
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `REGISTRE-VISITES-${new Date().toISOString().slice(0, 10)}.csv`
      link.click()
      URL.revokeObjectURL(url)
      toast.success('✅ Export CSV généré (compatible Excel)')
    } catch (error) {
      console.error('Erreur CSV:', error)
      toast.error('Erreur lors de l\'export CSV')
    }
  }

  // ============================================
  // EXPORT CSV RELANCES
  // ============================================
  const exportRelancesCSV = () => {
    try {
      const headers = ['Date relance', 'Nom', 'Prénom', 'Contact', 'Motif', 'Statut', 'Compte-rendu']
      const rows = relances.map(r => [
        r.dateRelance ? formatDate(r.dateRelance) : '',
        r.nomVisiteur || r.client?.nom || '',
        r.prenomVisiteur || r.client?.prenom || '',
        r.contact || r.client?.telephone || '',
        getMotifVisiteLabel(r.motif),
        getStatutRelanceLabel(r.statutRelance),
        r.compteRendu || ''
      ])
      const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
        .join('\n')
      const BOM = '\uFEFF'
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `RELANCES-${new Date().toISOString().slice(0, 10)}.csv`
      link.click()
      URL.revokeObjectURL(url)
      toast.success('✅ Export CSV relances généré (compatible Excel)')
    } catch (error) {
      console.error('Erreur CSV relances:', error)
      toast.error("Erreur lors de l'export CSV")
    }
  }

  // ============================================
  // GÉNÉRER FICHE OFFRE COMMERCIALE VIERGE
  // ============================================
  const handleGenerateOffre = () => {
    try {
      generateOffrePDF('complet')
      toast.success('Fiche offre commerciale générée')
    } catch (error) {
      console.error('Erreur:', error)
      toast.error('Erreur lors de la génération')
    }
  }

  // Générer fiche offre module sociale seul
  const handleGenerateModuleSociale = () => {
    try {
      generateOffrePDF('moduleSociale')
      toast.success('Fiche Module Sociale générée')
    } catch (error) {
      console.error('Erreur:', error)
      toast.error('Erreur lors de la génération')
    }
  }

  // Générer fiche droit de terre seul
  const handleGenerateDroitTerre = () => {
    try {
      generateOffrePDF('droitTerre')
      toast.success('Fiche Droit de Terre générée')
    } catch (error) {
      console.error('Erreur:', error)
      toast.error('Erreur lors de la génération')
    }
  }

  // Onglet actif style
  const getTabStyle = (tabName) => {
    const isActive = activeTab === tabName
    return {
      borderBottom: `3px solid ${isActive ? '#1A6B35' : 'transparent'}`,
      color: isActive ? '#1A6B35' : '#6B7280',
      fontWeight: isActive ? '600' : '400',
      padding: '12px 24px',
      cursor: 'pointer',
      transition: 'all 0.2s'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold" style={{ color: '#0D3B1F' }}>Secrétariat & Visites</h1>
          </div>
          <p className="text-gray-500">Gestion des visites, relances et alertes automatiques</p>
          <div className="mt-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={15} style={{ color: '#9CA3AF' }} />
            <input
              type="text"
              placeholder="Recherche globale (nom, contact, bien…)"
              value={globalSearch}
              onChange={e => handleGlobalSearch(e.target.value)}
              className="pl-9 pr-8 py-1.5 border rounded-lg outline-none text-sm"
              style={{ borderColor: '#E8F5EC', width: '280px', background: '#FAFAFA' }}
            />
            {globalSearch && (
              <button
                onClick={() => { setGlobalSearch(''); setSearchTerm('') }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {/* Boutons Fiches Offre YAMTIKEN BEHEMOTH */}
          {showFichesMenu && (
            <div className="fixed inset-0 z-40" onClick={() => setShowFichesMenu(false)} />
          )}
          <div className="relative">
            <button
              onClick={() => setShowFichesMenu(v => !v)}
              className="flex items-center gap-2 px-4 py-2 font-medium rounded-lg transition-all"
              style={{ background: showFichesMenu ? '#C8E6D0' : '#E8F5EC', color: '#0D3B1F' }}
              title="Fiches commerciales YAMTIKEN BEHEMOTH"
            >
              <FileText size={18} />
              Fiches Offre
              <span className="text-xs" style={{ color: '#6B7280' }}>{showFichesMenu ? '▲' : '▼'}</span>
            </button>
            {/* Menu dropdown des fiches */}
            {showFichesMenu && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
                <div className="p-2">
                  <p className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase">YAMTIKEN BEHEMOTH</p>
                  <button
                    onClick={() => { handleGenerateOffre(); setShowFichesMenu(false) }}
                    className="w-full text-left px-3 py-2 rounded hover:bg-gray-50 text-sm flex items-center gap-2"
                  >
                    <FileText size={14} style={{ color: '#C8960C' }} />
                    Offre Complète
                  </button>
                  <button
                    onClick={() => { handleGenerateModuleSociale(); setShowFichesMenu(false) }}
                    className="w-full text-left px-3 py-2 rounded hover:bg-gray-50 text-sm flex items-center gap-2"
                  >
                    <Building size={14} style={{ color: '#1A6B35' }} />
                    Module Sociale (Gros Œuvre)
                  </button>
                  <button
                    onClick={() => { handleGenerateDroitTerre(); setShowFichesMenu(false) }}
                    className="w-full text-left px-3 py-2 rounded hover:bg-gray-50 text-sm flex items-center gap-2"
                  >
                    <TrendingUp size={14} style={{ color: '#0D3B1F' }} />
                    Droit de Terre
                  </button>
                  <div className="border-t my-1"></div>
                  <p className="px-3 py-1 text-xs text-gray-400">{COMPANY_INFO.phones[0]}</p>
                </div>
              </div>
            )}
          </div>

          {/* Bouton Export PDF selon l'onglet */}
          {activeTab === 'visites' && (
            <>
              <button
                onClick={exportVisitesCSV}
                className="flex items-center gap-2 px-4 py-2 font-medium rounded-lg transition-all"
                style={{ background: '#EEF2FF', color: '#3730A3' }}
                title="Exporter en CSV (compatible Excel)"
              >
                <Download size={18} />
                CSV
              </button>
              <button
                onClick={exportResumeSemainePDF}
                className="flex items-center gap-2 px-4 py-2 font-medium rounded-lg transition-all"
                style={{ background: '#EDE9FE', color: '#5B21B6' }}
                title="Générer le résumé hebdomadaire PDF"
              >
                <Download size={18} />
                Semaine
              </button>
              <button
                onClick={exportVisitesPDF}
                className="flex items-center gap-2 px-4 py-2 font-medium rounded-lg transition-all"
                style={{ background: '#FEF3C7', color: '#92400E' }}
                title="Exporter le registre des visites PDF"
              >
                <Download size={18} />
                PDF
              </button>
            </>
          )}
          {activeTab === 'relances' && (
            <>
              <button
                onClick={exportRelancesCSV}
                className="flex items-center gap-2 px-4 py-2 font-medium rounded-lg transition-all"
                style={{ background: '#EEF2FF', color: '#3730A3' }}
                title="Exporter les relances en CSV (compatible Excel)"
              >
                <Download size={18} />
                CSV
              </button>
              <button
                onClick={exportRelancesPDF}
                className="flex items-center gap-2 px-4 py-2 font-medium rounded-lg transition-all"
                style={{ background: '#FEF3C7', color: '#92400E' }}
                title="Exporter le rapport des relances PDF"
              >
                <Download size={18} />
                PDF
              </button>
            </>
          )}
          {activeTab === 'alertes' && (
            <button
              onClick={exportAlertesPDF}
              className="flex items-center gap-2 px-4 py-2 font-medium rounded-lg transition-all"
              style={{ background: '#FEF3C7', color: '#92400E' }}
              title="Exporter la synthèse des alertes PDF"
            >
              <Download size={18} />
              Export PDF
            </button>
          )}
          {activeTab === 'visites' && (
            <button
              onClick={() => openModal()}
              className="flex items-center gap-2 px-4 py-2 text-white font-medium rounded-lg transition-all"
              style={{ background: '#1A6B35' }}
            >
              <Plus size={18} />
              Enregistrer une visite
            </button>
          )}
        </div>
      </div>

      {/* Onglets */}
      <div className="border-b flex items-center justify-between" style={{ borderColor: '#E8F5EC' }}>
        <div className="flex">
          <button
            onClick={() => setActiveTab('visites')}
            style={getTabStyle('visites')}
            className="flex items-center gap-2"
          >
            <FileText size={18} />
            Registre Visites
            <span className="ml-2 px-2 py-0.5 rounded-full text-xs" style={{ background: '#E8F5EC', color: '#1A6B35' }}>
              {visites.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('relances')}
            style={getTabStyle('relances')}
            className="flex items-center gap-2"
          >
            <Clock size={18} />
            Relances
            <span className="ml-2 px-2 py-0.5 rounded-full text-xs" style={{ background: '#FEF3C7', color: '#92400E' }}>
              {relances.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('alertes')}
            style={getTabStyle('alertes')}
            className="flex items-center gap-2"
          >
            <Bell size={18} />
            Alertes Automatiques
            {alertesStats?.nonLues > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-red-500 text-white animate-pulse">
                {alertesStats.nonLues}
              </span>
            )}
          </button>
        </div>
        <div className="flex items-center gap-2 pr-4">
          {/* Auto-refresh select + countdown */}
          <div className="flex items-center gap-1.5">
            <select
              value={autoRefresh}
              onChange={e => setAutoRefresh(Number(e.target.value))}
              className="text-xs border rounded px-2 py-1 outline-none"
              style={{ borderColor: '#E8F5EC', color: '#6B7280', background: '#FAFFF8' }}
              title="Auto-rafraîchissement"
            >
              <option value={0}>⏹ Off</option>
              <option value={1}>↻ 1 min</option>
              <option value={5}>↻ 5 min</option>
              <option value={10}>↻ 10 min</option>
            </select>
            {autoRefresh > 0 && countdown > 0 && (
              <span
                className="font-mono text-xs px-1.5 py-0.5 rounded"
                style={{ background: countdown < 30 ? '#FEF3C7' : '#E8F5EC', color: countdown < 30 ? '#92400E' : '#1A6B35' }}
                title="Prochain rafraîchissement dans"
              >
                {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}
              </span>
            )}
          </div>

          {/* Notification toggle */}
          <button
            onClick={notifEnabled ? () => { setNotifEnabled(false); toast('Notifications désactivées') } : enableNotifications}
            className="px-2 py-1 rounded text-xs font-medium transition-colors"
            style={{ background: notifEnabled ? '#DCFCE7' : '#F3F4F6', color: notifEnabled ? '#166534' : '#6B7280' }}
            title={notifEnabled ? 'Désactiver les notifications' : 'Activer les notifications browser'}
          >
            {notifEnabled ? '🔔 Notif ON' : '🕕 Notif OFF'}
          </button>

          {/* Historique session */}
          <div className="relative">
            <button
              onClick={() => setShowHistory(v => !v)}
              className="px-2 py-1 rounded text-xs font-medium transition-colors relative"
              style={{ background: showHistory ? '#E8F5EC' : '#F3F4F6', color: showHistory ? '#1A6B35' : '#6B7280' }}
              title="Historique des actions de la session"
            >
              📜
              {actionHistory.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white flex items-center justify-center" style={{ background: '#1A6B35', fontSize: '9px' }}>
                  {actionHistory.length}
                </span>
              )}
            </button>
            {showHistory && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowHistory(false)} />
                <div className="absolute right-0 top-full mt-1 w-72 bg-white rounded-lg shadow-xl border border-gray-100 z-50 overflow-hidden">
                  <div className="px-3 py-2 flex items-center justify-between" style={{ background: '#F9FAFB', borderBottom: '1px solid #E8F5EC' }}>
                    <span className="text-xs font-semibold" style={{ color: '#0D3B1F' }}>Historique session ({actionHistory.length})</span>
                    <button onClick={() => { setActionHistory([]); setShowHistory(false) }} className="text-xs" style={{ color: '#9CA3AF' }}>Vider</button>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {actionHistory.length === 0 ? (
                      <p className="text-xs text-center py-4" style={{ color: '#9CA3AF' }}>Aucune action cette session</p>
                    ) : actionHistory.map((a, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: '#F3F4F6' }}>
                        <span className="text-base">{a.type === 'delete' ? '🗑️' : a.type === 'check' ? '✅' : a.type === 'create' ? '➕' : '✏️'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs truncate" style={{ color: '#374151' }}>{a.label}</p>
                          <p className="text-xs" style={{ color: '#9CA3AF' }}>{a.time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Aide raccourcis clavier */}
          <div className="relative group">
            <button
              className="px-2 py-1 rounded text-xs transition-colors"
              style={{ background: '#F3F4F6', color: '#9CA3AF' }}
              title="Raccourcis clavier disponibles"
            >
              ⌨
            </button>
            <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-lg shadow-xl border border-gray-100 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all p-3 text-xs" style={{ color: '#374151' }}>
              <p className="font-semibold mb-2" style={{ color: '#0D3B1F' }}>Raccourcis clavier</p>
              <div className="space-y-1">
                <div className="flex justify-between"><span style={{ color: '#6B7280' }}>Nouvelle visite</span><kbd className="px-1.5 py-0.5 rounded font-mono" style={{ background: '#F3F4F6' }}>N</kbd></div>
                <div className="flex justify-between"><span style={{ color: '#6B7280' }}>Rafraîchir</span><kbd className="px-1.5 py-0.5 rounded font-mono" style={{ background: '#F3F4F6' }}>R</kbd></div>
                <div className="flex justify-between"><span style={{ color: '#6B7280' }}>Fermer modal</span><kbd className="px-1.5 py-0.5 rounded font-mono" style={{ background: '#F3F4F6' }}>Esc</kbd></div>
              </div>
            </div>
          </div>

          {/* Horodatage */}
          {lastLoaded && (
            <div className="flex items-center gap-1 text-xs" style={{ color: '#9CA3AF' }}>
              <span>Mis à jour :</span>
              <span className="font-medium" style={{ color: '#6B7280' }}>
                {lastLoaded.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <button
                onClick={loadData}
                className="ml-1 px-2 py-0.5 rounded text-xs transition-colors"
                style={{ background: '#E8F5EC', color: '#1A6B35' }}
                title="Rafraîchir (raccourci: R)"
              >
                ↻
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Contenu selon l'onglet */}
      <div className="rounded-lg overflow-hidden" style={{ background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        {activeTab === 'visites' && (
          <VisitesTab 
            visites={visites}
            loading={loading}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            filterMotif={filterMotif}
            setFilterMotif={setFilterMotif}
            filterDateDebut={filterDateDebut}
            setFilterDateDebut={setFilterDateDebut}
            filterDateFin={filterDateFin}
            setFilterDateFin={setFilterDateFin}
            onEdit={openModal}
            onDelete={handleDelete}
            onPrint={handlePrint}
            onRefresh={loadData}
            isFullscreen={isFullscreen}
            onToggleFullscreen={() => setIsFullscreen(v => !v)}
            onLogAction={logAction}
          />
        )}

        {activeTab === 'relances' && (
          <RelancesTab 
            relances={relances}
            loading={loading}
            onTraiter={(id, nomVisiteur) => handleTraiterRelance(id, nomVisiteur)}
            onRefresh={loadData}
          />
        )}

        {activeTab === 'alertes' && (
          <AlertesTab 
            alertesStats={alertesStats}
            loading={loading}
            onRefresh={loadData}
            onMarquerToutesLues={handleMarquerToutesAlertesLues}
          />
        )}
      </div>

      {/* Modal Confirmation */}
      {confirmModal.open && (
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          icon={confirmModal.icon}
          color={confirmModal.color}
          onConfirm={() => { confirmModal.onConfirm(); closeConfirm() }}
          onCancel={closeConfirm}
        />
      )}

      {/* Modal Visite */}
      {showModal && (
        <VisiteModal 
          visite={selectedVisite}
          buildings={buildings}
          biensLoading={biensLoading}
          onClose={closeModal}
          onSuccess={(isNew) => {
            logAction(isNew ? 'create' : 'edit', isNew ? 'Nouvelle visite enregistrée' : `Visite modifiée`)
            loadData()
          }}
        />
      )}
    </div>
  )
}

// ============================================
// ONGLET 1: REGISTRE VISITES
// ============================================
const PAGE_SIZE = 20

const VisitesTab = ({ 
  visites, 
  loading, 
  searchTerm, setSearchTerm,
  filterMotif, setFilterMotif,
  filterDateDebut, setFilterDateDebut,
  filterDateFin, setFilterDateFin,
  onEdit, onDelete, onPrint,
  onRefresh,
  isFullscreen, onToggleFullscreen, onLogAction
}) => {
  const [sortCol, setSortCol] = useState('dateVisite')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [quickFilter, setQuickFilter] = useState('')

  const applyQuickFilter = (key) => {
    setQuickFilter(key)
    const today = new Date()
    const fmt = d => d.toISOString().slice(0, 10)
    if (key === 'today') {
      setFilterDateDebut(fmt(today))
      setFilterDateFin(fmt(today))
    } else if (key === 'week') {
      const mon = new Date(today)
      const day = today.getDay()
      mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1))
      const sun = new Date(mon)
      sun.setDate(mon.getDate() + 6)
      setFilterDateDebut(fmt(mon))
      setFilterDateFin(fmt(sun))
    } else if (key === 'month') {
      setFilterDateDebut(fmt(new Date(today.getFullYear(), today.getMonth(), 1)))
      setFilterDateFin(fmt(new Date(today.getFullYear(), today.getMonth() + 1, 0)))
    } else {
      setFilterDateDebut('')
      setFilterDateFin('')
    }
  }

  const toggleSelect = (id) => setSelectedIds(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  const toggleAll = () => {
    if (selectedIds.size === pagedVisites.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(pagedVisites.map(v => v.id)))
    }
  }
  const clearSelection = () => setSelectedIds(new Set())

  const printSelection = () => {
    const selected = visites.filter(v => selectedIds.has(v.id))
    if (!selected.length || !onPrint) return
    selected.forEach(v => onPrint(v))
    if (onLogAction) onLogAction('print', `${selected.length} fiche(s) imprimée(s)`)
    clearSelection()
  }

  const exportSelectionCSV = () => {
    const selected = visites.filter(v => selectedIds.has(v.id))
    if (!selected.length) return
    const headers = ['Date', 'Heure', 'Nom', 'Prénom', 'Contact', 'Email', 'Bien', 'Motif', 'Responsable']
    const rows = selected.map(v => [
      formatDate(v.dateVisite),
      new Date(v.dateVisite).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      v.nomVisiteur || '', v.prenomVisiteur || '',
      v.contact || '', v.email || '',
      v.bienVisite?.reference || v.bienVisite?.titre || `Bien #${v.bienVisiteId}` || '',
      getMotifVisiteLabel(v.motif), v.responsable || ''
    ])
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
      .join('\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `SELECTION-${selected.length}-VISITES-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    if (onLogAction) onLogAction('export', `${selected.length} visite(s) exportée(s) CSV`)
  }

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
    setPage(1)
  }

  const sortedVisites = [...visites].sort((a, b) => {
    let va, vb
    if (sortCol === 'dateVisite') {
      va = new Date(a.dateVisite).getTime()
      vb = new Date(b.dateVisite).getTime()
    } else if (sortCol === 'visiteur') {
      va = `${a.prenomVisiteur || ''} ${a.nomVisiteur || ''}`.toLowerCase()
      vb = `${b.prenomVisiteur || ''} ${b.nomVisiteur || ''}`.toLowerCase()
    } else if (sortCol === 'motif') {
      va = a.motif || ''
      vb = b.motif || ''
    } else if (sortCol === 'responsable') {
      va = (a.responsable || '').toLowerCase()
      vb = (b.responsable || '').toLowerCase()
    } else {
      va = a[sortCol] || ''
      vb = b[sortCol] || ''
    }
    if (va < vb) return sortDir === 'asc' ? -1 : 1
    if (va > vb) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  const totalPages = Math.max(1, Math.ceil(sortedVisites.length / PAGE_SIZE))
  const pagedVisites = sortedVisites.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const SortArrow = ({ col }) => {
    if (sortCol !== col) return <span style={{ color: '#D1D5DB', marginLeft: 3 }}>⇅</span>
    return <span style={{ color: '#1A6B35', marginLeft: 3 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const ThSort = ({ col, children }) => (
    <th
      className="px-6 py-3 text-left text-sm font-semibold cursor-pointer select-none transition-colors hover:bg-green-50"
      style={{ color: sortCol === col ? '#1A6B35' : '#374151' }}
      onClick={() => handleSort(col)}
    >
      <span className="flex items-center gap-0.5">{children}<SortArrow col={col} /></span>
    </th>
  )

  return (
    <div className={isFullscreen ? 'fixed inset-0 z-50 bg-white overflow-auto flex flex-col' : ''}>
      {/* Barre plein écran */}
      {isFullscreen && (
        <div className="flex items-center justify-between px-5 py-2 border-b" style={{ borderColor: '#E8F5EC', background: '#F9FAFB' }}>
          <span className="text-sm font-semibold" style={{ color: '#0D3B1F' }}>Registre Visites — Plein écran</span>
          <button onClick={onToggleFullscreen} className="p-1.5 rounded transition-colors" style={{ background: '#FEE2E2', color: '#DC2626' }} title="Quitter le plein écran (Esc)">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Barre de sélection multiple */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-5 py-2 border-b" style={{ background: '#FFFBEB', borderColor: '#FDE68A' }}>
          <span className="text-sm font-medium" style={{ color: '#92400E' }}>
            {selectedIds.size} visite(s) sélectionnée(s)
          </span>
          <button
            onClick={printSelection}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white"
            style={{ background: '#1A6B35' }}
          >
            <Printer size={14} /> Imprimer la sélection
          </button>
          <button
            onClick={exportSelectionCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
            style={{ background: '#EEF2FF', color: '#3730A3' }}
          >
            <Download size={14} /> CSV sélection
          </button>
          <button
            onClick={clearSelection}
            className="px-3 py-1.5 rounded-lg text-sm"
            style={{ background: '#F3F4F6', color: '#6B7280' }}
          >
            Annuler
          </button>
        </div>
      )}

      {/* Filtres */}
      <div className="p-4 border-b" style={{ borderColor: '#E8F5EC' }}>
        {/* Filtres rapides */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-xs font-medium" style={{ color: '#6B7280' }}>Période :</span>
          {[['today', "Aujourd'hui"], ['week', 'Cette semaine'], ['month', 'Ce mois'], ['', 'Tout']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => applyQuickFilter(key)}
              className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
              style={{
                background: quickFilter === key ? '#1A6B35' : '#E8F5EC',
                color: quickFilter === key ? 'white' : '#1A6B35'
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={18} style={{ color: '#6B7280' }} />
            <input
              type="text"
              placeholder="Rechercher par nom, contact..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border-2 rounded-lg outline-none"
              style={{ borderColor: '#E8F5EC' }}
            />
          </div>
          <select
            value={filterMotif}
            onChange={(e) => setFilterMotif(e.target.value)}
            className="px-4 py-2 border-2 rounded-lg outline-none"
            style={{ borderColor: '#E8F5EC', minWidth: '150px' }}
          >
            <option value="">Tous motifs</option>
            <option value="DECOUVERTE">Découverte</option>
            <option value="NEGOCIATION">Négociation</option>
            <option value="RECLAMATION">Réclamation</option>
            <option value="AUTRE">Autre</option>
          </select>
          <input
            type="date"
            placeholder="Du"
            value={filterDateDebut}
            onChange={(e) => setFilterDateDebut(e.target.value)}
            className="px-4 py-2 border-2 rounded-lg outline-none"
            style={{ borderColor: '#E8F5EC' }}
          />
          <input
            type="date"
            placeholder="Au"
            value={filterDateFin}
            onChange={(e) => setFilterDateFin(e.target.value)}
            className="px-4 py-2 border-2 rounded-lg outline-none"
            style={{ borderColor: '#E8F5EC' }}
          />
          {onToggleFullscreen && (
            <button
              onClick={onToggleFullscreen}
              className="p-2 rounded-lg transition-colors ml-auto"
              style={{ background: '#E8F5EC', color: '#1A6B35' }}
              title={isFullscreen ? 'Quitter plein écran' : 'Plein écran'}
            >
              {isFullscreen ? '⛶' : '⛶'}
            </button>
          )}
        </div>
      </div>

      {/* KPI Stats */}
      {!loading && visites.length > 0 && (
        <div className="px-5 py-3 border-b flex flex-wrap items-center gap-3" style={{ borderColor: '#E8F5EC', background: '#FAFFF8' }}>
          <div className="flex items-center gap-1.5 text-sm">
            <FileText size={14} style={{ color: '#1A6B35' }} />
            <span className="font-bold" style={{ color: '#0D3B1F' }}>{visites.length}</span>
            <span style={{ color: '#6B7280' }}>visite(s)</span>
          </div>
          <span style={{ color: '#E8F5EC' }}>|</span>
          {['DECOUVERTE', 'NEGOCIATION', 'RECLAMATION', 'AUTRE'].map(motif => {
            const count = visites.filter(v => v.motif === motif).length
            if (!count) return null
            const st = getMotifVisiteBadgeStyle(motif)
            return (
              <span key={motif} className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: st.background, color: st.color }}>
                {getMotifVisiteLabel(motif)}: <strong>{count}</strong>
              </span>
            )
          })}
          <span style={{ color: '#E8F5EC' }}>|</span>
          <div className="flex items-center gap-1.5 text-sm ml-auto">
            <Clock size={13} style={{ color: '#1A6B35' }} />
            <span style={{ color: '#6B7280' }}>
              Taux relance :&nbsp;
              <strong style={{ color: '#1A6B35' }}>
                {Math.round(visites.filter(v => v.relanceSouhait).length / visites.length * 100)}%
              </strong>
              &nbsp;({visites.filter(v => v.relanceSouhait).length}/{visites.length})
            </span>
          </div>
        </div>
      )}

      {/* Tableau */}
      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-transparent" style={{ borderColor: '#1A6B35' }} />
          <p className="text-gray-500 text-sm">Chargement des visites...</p>
        </div>
      ) : visites.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64" style={{ color: '#9CA3AF' }}>
          <FileText size={48} className="mb-4" />
          <p>Aucune visite trouvée</p>
          {onRefresh && (
            <button 
              onClick={onRefresh}
              className="mt-4 px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 text-sm font-medium"
            >
              Rafraîchir
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead style={{ background: '#F9FAFB' }}>
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={pagedVisites.length > 0 && selectedIds.size === pagedVisites.length}
                    onChange={toggleAll}
                    className="cursor-pointer"
                    title="Sélectionner tout"
                  />
                </th>
                <ThSort col="dateVisite">Date/Heure</ThSort>
                <ThSort col="visiteur">Visiteur</ThSort>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: '#374151' }}>Contact</th>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: '#374151' }}>Bien</th>
                <ThSort col="motif">Motif</ThSort>
                <ThSort col="responsable">Responsable</ThSort>
                <th className="px-6 py-3 text-left text-sm font-semibold" style={{ color: '#374151' }}>Relance</th>
                <th className="px-6 py-3 text-center text-sm font-semibold" style={{ color: '#374151' }}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: '#E8F5EC' }}>
              {pagedVisites.map((visite) => {
                const motifStyle = getMotifVisiteBadgeStyle(visite.motif)
                return (
                  <tr
                    key={visite.id}
                    className="hover:bg-gray-50"
                    title={visite.compteRendu ? `Compte-rendu : ${visite.compteRendu.substring(0, 200)}${visite.compteRendu.length > 200 ? '…' : ''}` : undefined}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(visite.id)}
                        onChange={() => toggleSelect(visite.id)}
                        className="cursor-pointer"
                        onClick={e => e.stopPropagation()}
                      />
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-1.5">
                        <div>
                          <p className="text-sm font-medium" style={{ color: '#374151' }}>
                            {formatDate(visite.dateVisite)}
                          </p>
                          <p className="text-xs" style={{ color: '#6B7280' }}>
                            {new Date(visite.dateVisite).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        {visite.compteRendu && (
                          <MessageSquare size={13} style={{ color: '#9CA3AF', flexShrink: 0 }} title={visite.compteRendu} />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <User size={16} style={{ color: '#1A6B35' }} />
                        <span className="font-medium" style={{ color: '#0D3B1F' }}>
                          {visite.prenomVisiteur} {visite.nomVisiteur}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="text-sm" style={{ color: '#374151' }}>
                        <Phone size={14} className="inline mr-1" />
                        {visite.contact}
                      </div>
                      {visite.email && (
                        <div className="text-xs" style={{ color: '#6B7280' }}>
                          <Mail size={12} className="inline mr-1" />
                          {visite.email}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-1 text-sm" style={{ color: '#374151' }}>
                        <Building size={14} />
                        {visite.bienVisite?.reference || visite.bienVisite?.titre || `Bien #${visite.bienVisiteId}`}
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <span 
                        className="px-2 py-1 rounded text-xs font-medium"
                        style={{ background: motifStyle.background, color: motifStyle.color }}
                      >
                        {getMotifVisiteLabel(visite.motif)}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <p className="text-sm" style={{ color: '#374151' }}>{visite.responsable || '-'}</p>
                    </td>
                    <td className="px-6 py-3">
                      {visite.relanceSouhait ? (
                        <div>
                          <span 
                            className="px-2 py-1 rounded text-xs font-medium"
                            style={getStatutRelanceBadgeStyle(visite.statutRelance)}
                          >
                            {getStatutRelanceLabel(visite.statutRelance)}
                          </span>
                          {visite.dateRelance && (
                            <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
                              {formatDate(visite.dateRelance)}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs" style={{ color: '#9CA3AF' }}>-</span>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => onEdit(visite)}
                          className="p-2 rounded transition-colors"
                          style={{ background: '#DBEAFE', color: '#1D4ED8' }}
                          title="Modifier"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => onPrint && onPrint(visite)}
                          className="p-2 rounded transition-colors"
                          style={{ background: '#F0FDF4', color: '#166534' }}
                          title="Imprimer fiche PDF"
                        >
                          <Printer size={15} />
                        </button>
                        <button
                          onClick={() => onDelete(visite.id)}
                          className="p-2 rounded transition-colors"
                          style={{ background: '#FEE2E2', color: '#DC2626' }}
                          title="Supprimer"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t" style={{ borderColor: '#E8F5EC' }}>
            <p className="text-sm" style={{ color: '#6B7280' }}>
              {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, sortedVisites.length)} sur {sortedVisites.length} visites
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="px-2 py-1 rounded text-sm disabled:opacity-30 transition-colors"
                style={{ background: '#E8F5EC', color: '#1A6B35' }}
              >
                «
              </button>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 rounded text-sm disabled:opacity-30 transition-colors"
                style={{ background: '#E8F5EC', color: '#1A6B35' }}
              >
                ‹ Préc.
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 2, totalPages - 4))
                const p = start + i
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className="w-8 h-8 rounded text-sm font-medium transition-colors"
                    style={{ background: page === p ? '#1A6B35' : '#F3F4F6', color: page === p ? 'white' : '#374151' }}
                  >
                    {p}
                  </button>
                )
              })}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 rounded text-sm disabled:opacity-30 transition-colors"
                style={{ background: '#E8F5EC', color: '#1A6B35' }}
              >
                Suiv. ›
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                className="px-2 py-1 rounded text-sm disabled:opacity-30 transition-colors"
                style={{ background: '#E8F5EC', color: '#1A6B35' }}
              >
                »
              </button>
            </div>
          </div>
        )}
        </div>
      )}
    </div>
  )
}

// ============================================
// ONGLET 2: RELANCES
// ============================================
const RelancesTab = ({ relances, loading, onTraiter, onRefresh }) => {
  const [searchRelance, setSearchRelance] = useState('')
  const [filterStatut, setFilterStatut] = useState('')

  const getUrgenceColor = (dateRelance) => {
    const today = new Date()
    const relanceDate = new Date(dateRelance)
    const diffDays = Math.floor((relanceDate - today) / (1000 * 60 * 60 * 24))
    if (diffDays < 0) return '#DC2626'
    if (diffDays === 0) return '#C8960C'
    if (diffDays <= 3) return '#F59E0B'
    return '#1A6B35'
  }

  const enRetardCount = relances.filter(r => {
    const diff = Math.floor((new Date(r.dateRelance) - new Date()) / (1000 * 60 * 60 * 24))
    return diff < 0 && r.statutRelance === 'EN_ATTENTE'
  }).length

  const sortedRelances = [...relances]
    .filter(r => {
      const nom = `${r.prenomVisiteur || ''} ${r.nomVisiteur || ''} ${r.contact || ''}`.toLowerCase()
      const matchSearch = !searchRelance || nom.includes(searchRelance.toLowerCase())
      const matchStatut = !filterStatut || r.statutRelance === filterStatut
      return matchSearch && matchStatut
    })
    .sort((a, b) => new Date(a.dateRelance) - new Date(b.dateRelance))

  return (
    <div className="p-6">
      {/* Header + filtres */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold" style={{ color: '#0D3B1F' }}>Relances à effectuer</h2>
          {enRetardCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white animate-pulse">
              {enRetardCount} en retard
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={15} style={{ color: '#6B7280' }} />
            <input
              type="text"
              placeholder="Rechercher un contact..."
              value={searchRelance}
              onChange={e => setSearchRelance(e.target.value)}
              className="pl-9 pr-4 py-1.5 border-2 rounded-lg outline-none text-sm"
              style={{ borderColor: '#E8F5EC', minWidth: '180px' }}
            />
          </div>
          <select
            value={filterStatut}
            onChange={e => setFilterStatut(e.target.value)}
            className="px-3 py-1.5 border-2 rounded-lg outline-none text-sm"
            style={{ borderColor: '#E8F5EC' }}
          >
            <option value="">Tous statuts</option>
            <option value="EN_ATTENTE">En attente</option>
            <option value="EFFECTUEE">Effectuée</option>
            <option value="ANNULEE">Annulée</option>
          </select>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors"
              style={{ background: '#E8F5EC', color: '#1A6B35' }}
              title="Rafraîchir"
            >
              ↻ Rafraîchir
            </button>
          )}
        </div>
      </div>

      {/* KPI Relances */}
      {!loading && relances.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-5 px-4 py-3 rounded-xl" style={{ background: '#FAFFF8', border: '1px solid #E8F5EC' }}>
          {[
            { label: 'En attente', count: relances.filter(r => r.statutRelance === 'EN_ATTENTE').length, color: '#C8960C', bg: '#FEF3C7' },
            { label: 'En retard', count: enRetardCount, color: '#DC2626', bg: '#FEE2E2' },
            { label: 'Effectu\u00e9es', count: relances.filter(r => r.statutRelance === 'EFFECTUEE').length, color: '#1A6B35', bg: '#DCFCE7' },
            { label: 'Annul\u00e9es', count: relances.filter(r => r.statutRelance === 'ANNULEE').length, color: '#6B7280', bg: '#F3F4F6' },
          ].map(item => item.count > 0 ? (
            <span key={item.label} className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold" style={{ background: item.bg, color: item.color }}>
              <strong>{item.count}</strong> {item.label}
            </span>
          ) : null)}
          <span className="ml-auto text-xs" style={{ color: '#6B7280' }}>
            Total : <strong style={{ color: '#0D3B1F' }}>{relances.length}</strong> relance(s)
          </span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-transparent" style={{ borderColor: '#1A6B35' }} />
          <p className="text-gray-500 text-sm">Chargement des relances...</p>
        </div>
      ) : sortedRelances.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64" style={{ color: '#9CA3AF' }}>
          <CheckCircle size={48} className="mb-4" style={{ color: '#10B981' }} />
          <p>{searchRelance || filterStatut ? 'Aucune relance correspondant aux filtres' : 'Aucune relance en attente'}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedRelances.map((relance) => {
            const urgenceColor = getUrgenceColor(relance.dateRelance)
            const today = new Date()
            const relanceDate = new Date(relance.dateRelance)
            const diffDays = Math.floor((relanceDate - today) / (1000 * 60 * 60 * 24))
            
            let urgenceLabel = `Dans ${diffDays} jours`
            if (diffDays < 0) urgenceLabel = `En retard de ${Math.abs(diffDays)} jours`
            if (diffDays === 0) urgenceLabel = "Aujourd'hui"
            if (diffDays === 1) urgenceLabel = "Demain"

            return (
              <div 
                key={relance.id}
                className="p-4 rounded-lg border-l-4 flex items-center justify-between"
                style={{ 
                  background: 'white',
                  borderLeftColor: urgenceColor,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ background: `${urgenceColor}20` }}
                    >
                      <Clock size={20} style={{ color: urgenceColor }} />
                    </div>
                    <div>
                      <p className="font-semibold" style={{ color: '#0D3B1F' }}>
                        {relance.prenomVisiteur} {relance.nomVisiteur}
                      </p>
                      <p className="text-sm" style={{ color: '#6B7280' }}>
                        <Phone size={12} className="inline mr-1" />
                        {relance.contact}
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-2 ml-13 pl-12">
                    <span 
                      className="px-2 py-1 rounded text-xs font-medium"
                      style={getMotifVisiteBadgeStyle(relance.motif)}
                    >
                      {getMotifVisiteLabel(relance.motif)}
                    </span>
                    {relance.compteRendu && (
                      <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
                        <MessageSquare size={12} className="inline mr-1" />
                        {relance.compteRendu.substring(0, 100)}...
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-right mr-6">
                  <p className="font-bold" style={{ color: urgenceColor }}>
                    {formatDate(relance.dateRelance)}
                  </p>
                  <p className="text-xs" style={{ color: urgenceColor }}>
                    {urgenceLabel}
                  </p>
                </div>

                <button
                  onClick={() => onTraiter(relance.id, `${relance.prenomVisiteur || ''} ${relance.nomVisiteur || ''}`.trim())}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all"
                  style={{ 
                    background: '#DCFCE7', 
                    color: '#166534',
                    border: '1px solid #166534'
                  }}
                >
                  <CheckCircle size={16} />
                  Marquer traité
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ============================================
// ONGLET 3: ALERTES AUTOMATIQUES
// ============================================
const AlertesTab = ({ alertesStats, loading, onRefresh, onMarquerToutesLues }) => {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-transparent" style={{ borderColor: '#1A6B35' }} />
        <p className="text-gray-500 text-sm">Chargement des alertes...</p>
      </div>
    )
  }

  if (!alertesStats) {
    return (
      <div className="flex flex-col items-center justify-center h-64" style={{ color: '#9CA3AF' }}>
        <AlertTriangle size={48} className="mb-4" />
        <p>Erreur lors du chargement des alertes</p>
        {onRefresh && (
          <button 
            onClick={onRefresh}
            className="mt-4 px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 text-sm font-medium"
          >
            Rafraîchir
          </button>
        )}
      </div>
    )
  }

  const alertesItems = [
    {
      type: 'PAIEMENT_ECHEANCE',
      icon: TrendingUp,
      count: alertesStats.paiementsEcheance,
      label: 'Paiements à échéance (≤ 7 jours)',
      color: '#DC2626',
      bgColor: '#FEE2E2'
    },
    {
      type: 'BAIL_EXPIRATION',
      icon: Building,
      count: alertesStats.bauxExpiration,
      label: 'Baux expirant (≤ 30 jours)',
      color: '#C8960C',
      bgColor: '#FEF3C7'
    },
    {
      type: 'RELANCE_VISITE',
      icon: Clock,
      count: alertesStats.relancesAujourdHui,
      label: 'Relances visites prévues aujourd\'hui',
      color: '#1A6B35',
      bgColor: '#DCFCE7'
    }
  ]

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h2 className="text-lg font-semibold" style={{ color: '#0D3B1F' }}>Alertes automatiques</h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm" style={{ color: '#6B7280' }}>
            <Bell size={16} />
            <span>Générées à 6h, email à 7h</span>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={{ background: '#E8F5EC', color: '#1A6B35' }}
            >
              ↻ Rafraîchir
            </button>
          )}
          {alertesStats.totalNonLues > 0 && onMarquerToutesLues && (
            <button
              onClick={onMarquerToutesLues}
              className="px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 text-white transition-colors"
              style={{ background: '#1A6B35' }}
            >
              <CheckCircle size={15} />
              Tout marquer lu
            </button>
          )}
        </div>
      </div>

      {/* Total alertes non lues */}
      <div 
        className="mb-6 p-4 rounded-lg flex items-center justify-between"
        style={{ background: alertesStats.totalNonLues > 0 ? '#FEE2E2' : '#DCFCE7' }}
      >
        <div className="flex items-center gap-3">
          <AlertTriangle size={24} style={{ color: alertesStats.totalNonLues > 0 ? '#DC2626' : '#10B981' }} />
          <div>
            <p className="font-semibold" style={{ color: alertesStats.totalNonLues > 0 ? '#DC2626' : '#10B981' }}>
              {alertesStats.totalNonLues} alerte{alertesStats.totalNonLues > 1 ? 's' : ''} non lue{alertesStats.totalNonLues > 1 ? 's' : ''}
            </p>
            <p className="text-sm" style={{ color: '#6B7280' }}>
              Total urgentes: {alertesStats.totalUrgentes}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {alertesStats.totalNonLues > 0 && (
            <span className="animate-pulse px-3 py-1 rounded-full text-xs font-medium bg-red-500 text-white">
              Action requise
            </span>
          )}
        </div>
      </div>

      {/* Cartes d'alertes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {alertesItems.map((item) => {
          const Icon = item.icon
          return (
            <div 
              key={item.type}
              className="p-6 rounded-lg"
              style={{ background: item.bgColor }}
            >
              <div className="flex items-center justify-between mb-4">
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ background: 'white' }}
                >
                  <Icon size={24} style={{ color: item.color }} />
                </div>
                <span 
                  className="text-3xl font-bold"
                  style={{ color: item.color }}
                >
                  {item.count}
                </span>
              </div>
              <p className="font-medium" style={{ color: '#0D3B1F' }}>{item.label}</p>
              {item.count > 0 && (
                <p className="text-sm mt-2" style={{ color: item.color }}>
                  Nécessite votre attention
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Message informatif */}
      <div className="mt-6 p-4 rounded-lg" style={{ background: '#F9FAFB' }}>
        <p className="text-sm" style={{ color: '#6B7280' }}>
          <strong style={{ color: '#0D3B1F' }}>À propos des alertes automatiques :</strong><br />
          Le système génère automatiquement des alertes chaque matin à 6h pour les paiements à échéance, les baux expirant et les relances de visites. Un email récapitulatif est envoyé à 7h au responsable configuré dans les paramètres.
        </p>
      </div>
    </div>
  )
}

// ============================================
// MODAL - FORMULAIRE VISITE
// ============================================
const VisiteModal = ({ visite, buildings, biensLoading, onClose, onSuccess }) => {
  const [isSaving, setIsSaving] = useState(false)
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const currentTime = now.toTimeString().slice(0, 5)
  const [formData, setFormData] = useState({
    dateVisite: visite?.dateVisite ? new Date(visite.dateVisite).toISOString().split('T')[0] : today,
    heureVisite: visite?.dateVisite ? new Date(visite.dateVisite).toTimeString().slice(0, 5) : currentTime,
    nomVisiteur: visite?.nomVisiteur || '',
    prenomVisiteur: visite?.prenomVisiteur || '',
    contact: visite?.contact || '',
    email: visite?.email || '',
    bienVisiteId: visite?.bienVisiteId || '',
    motif: visite?.motif || 'DECOUVERTE',
    responsable: visite?.responsable || '',
    compteRendu: visite?.compteRendu || '',
    relanceSouhait: visite?.relanceSouhait || false,
    dateRelance: visite?.dateRelance ? new Date(visite.dateRelance).toISOString().split('T')[0] : '',
    statutRelance: visite?.statutRelance || 'EN_ATTENTE'
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSaving(true)

    if (!formData.bienVisiteId && buildings.length > 0) {
      toast.error('⚠️ Veuillez sélectionner un bien visité')
      setIsSaving(false)
      return
    }
    
    try {
      const dateHeure = formData.heureVisite
        ? new Date(`${formData.dateVisite}T${formData.heureVisite}:00`).toISOString()
        : new Date(`${formData.dateVisite}T00:00:00`).toISOString()
      const payload = { ...formData, dateVisite: dateHeure }
      delete payload.heureVisite
      if (visite) {
        await updateVisite(visite.id, payload)
        toast.success('✅ Visite modifiée avec succès')
      } else {
        await createVisite(payload)
        toast.success('✅ Visite enregistrée avec succès')
      }
      
      if (onSuccess) await onSuccess()
      onClose()
    } catch (error) {
      console.error('Erreur enregistrement visite:', error)
      toast.error('❌ Erreur lors de l\'enregistrement')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
        <div className="p-6 border-b" style={{ borderColor: '#E8F5EC' }}>
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold" style={{ color: '#0D3B1F' }}>
              {visite ? 'Modifier la visite' : 'Enregistrer une visite'}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
              <X size={24} style={{ color: '#6B7280' }} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Date + Heure visite */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#0D3B1F' }}>Date de la visite</label>
              <input
                type="date"
                value={formData.dateVisite}
                onChange={(e) => setFormData({...formData, dateVisite: e.target.value})}
                className="w-full px-4 py-2 border-2 rounded-lg outline-none"
                style={{ borderColor: '#E8F5EC' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#0D3B1F' }}>Heure</label>
              <input
                type="time"
                value={formData.heureVisite}
                onChange={(e) => setFormData({...formData, heureVisite: e.target.value})}
                className="w-full px-4 py-2 border-2 rounded-lg outline-none"
                style={{ borderColor: '#E8F5EC' }}
              />
            </div>
          </div>
          {/* Visiteur */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#0D3B1F' }}>Nom <span style={{color:'#DC2626'}}>*</span></label>
              <input
                type="text"
                required
                value={formData.nomVisiteur}
                onChange={(e) => setFormData({...formData, nomVisiteur: e.target.value})}
                className="w-full px-4 py-2 border-2 rounded-lg outline-none"
                style={{ borderColor: '#E8F5EC' }}
                placeholder="Nom du visiteur"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#0D3B1F' }}>Prénom <span style={{color:'#DC2626'}}>*</span></label>
              <input
                type="text"
                required
                value={formData.prenomVisiteur}
                onChange={(e) => setFormData({...formData, prenomVisiteur: e.target.value})}
                className="w-full px-4 py-2 border-2 rounded-lg outline-none"
                style={{ borderColor: '#E8F5EC' }}
                placeholder="Prénom du visiteur"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#0D3B1F' }}>Contact <span style={{color:'#DC2626'}}>*</span></label>
              <input
                type="tel"
                required
                value={formData.contact}
                onChange={(e) => setFormData({...formData, contact: e.target.value})}
                className="w-full px-4 py-2 border-2 rounded-lg outline-none"
                style={{ borderColor: '#E8F5EC' }}
                placeholder="+225 07 00 00 00"
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
                placeholder="email@exemple.com (optionnel)"
              />
            </div>
          </div>

          {/* Bien et Motif */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#0D3B1F' }}>
                Bien visité
                {buildings.length > 0 && <span style={{color:'#DC2626'}}> *</span>}
              </label>
              {biensLoading ? (
                <div className="w-full px-4 py-2 border-2 rounded-lg text-sm flex items-center gap-2" style={{ borderColor: '#E8F5EC', color: '#6B7280' }}>
                  <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#1A6B35' }} />
                  Chargement des biens…
                </div>
              ) : buildings.length > 0 ? (
                <select
                  required
                  value={formData.bienVisiteId}
                  onChange={(e) => setFormData({...formData, bienVisiteId: e.target.value})}
                  className="w-full px-4 py-2 border-2 rounded-lg outline-none"
                  style={{ borderColor: formData.bienVisiteId ? '#1A6B35' : '#E8F5EC' }}
                >
                  <option value="">-- Sélectionner un bien --</option>
                  {buildings.map((bien) => (
                    <option key={bien.id} value={bien.id}>
                      {[bien.reference, bien.titre].filter(Boolean).join(' — ') || `Bien #${bien.id}`}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="w-full px-4 py-2 border-2 rounded-lg text-sm flex items-center gap-2" style={{ borderColor: '#FEF3C7', background: '#FFFBEB', color: '#92400E' }}>
                  <AlertTriangle size={14} />
                  Aucun bien disponible — champ ignoré
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#0D3B1F' }}>
                Motif *
              </label>
              <select
                value={formData.motif}
                onChange={(e) => setFormData({...formData, motif: e.target.value})}
                className="w-full px-4 py-2 border-2 rounded-lg outline-none"
                style={{ borderColor: '#E8F5EC' }}
              >
                <option value="DECOUVERTE">Découverte</option>
                <option value="NEGOCIATION">Négociation</option>
                <option value="RECLAMATION">Réclamation</option>
                <option value="AUTRE">Autre</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0D3B1F' }}>
              Responsable
            </label>
            <input
              type="text"
              value={formData.responsable}
              onChange={(e) => setFormData({...formData, responsable: e.target.value})}
              className="w-full px-4 py-2 border-2 rounded-lg outline-none"
              style={{ borderColor: '#E8F5EC' }}
              placeholder="Agent en charge de la visite"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0D3B1F' }}>
              Compte-rendu
            </label>
            <textarea
              value={formData.compteRendu}
              onChange={(e) => setFormData({...formData, compteRendu: e.target.value})}
              rows={3}
              className="w-full px-4 py-2 border-2 rounded-lg outline-none"
              style={{ borderColor: '#E8F5EC' }}
              placeholder="Résumé de la visite..."
            />
          </div>

          {/* Relance */}
          <div className="p-4 rounded-lg" style={{ background: '#F9FAFB' }}>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.relanceSouhait}
                onChange={(e) => setFormData({...formData, relanceSouhait: e.target.checked})}
                className="w-4 h-4"
                style={{ accentColor: '#1A6B35' }}
              />
              <span className="font-medium" style={{ color: '#0D3B1F' }}>Relance souhaitée</span>
            </label>

            {formData.relanceSouhait && (
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#0D3B1F' }}>
                    Date de relance
                  </label>
                  <input
                    type="date"
                    value={formData.dateRelance}
                    onChange={(e) => setFormData({...formData, dateRelance: e.target.value})}
                    className="w-full px-4 py-2 border-2 rounded-lg outline-none"
                    style={{ borderColor: '#E8F5EC' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: '#0D3B1F' }}>
                    Statut
                  </label>
                  <select
                    value={formData.statutRelance}
                    onChange={(e) => setFormData({...formData, statutRelance: e.target.value})}
                    className="w-full px-4 py-2 border-2 rounded-lg outline-none"
                    style={{ borderColor: '#E8F5EC' }}
                  >
                    <option value="EN_ATTENTE">En attente</option>
                    <option value="EFFECTUEE">Effectuée</option>
                    <option value="ANNULEE">Annulée</option>
                  </select>
                </div>
              </div>
            )}
          </div>

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
                visite ? 'Enregistrer' : 'Créer'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============================================
// MODAL - CONFIRMATION D'OPÉRATION
// ============================================
const ConfirmModal = ({ title, message, icon, color, onConfirm, onCancel }) => {
  const iconMap = {
    trash: <Trash2 size={28} style={{ color }} />,
    check: <CheckCircle size={28} style={{ color }} />,
    alert: <AlertTriangle size={28} style={{ color }} />
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div 
        className="bg-white w-full max-w-md rounded-2xl overflow-hidden"
        style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
      >
        {/* Bande couleur en haut */}
        <div className="h-1.5 w-full" style={{ background: color }} />

        <div className="p-6">
          {/* Icône + Titre */}
          <div className="flex items-center gap-4 mb-4">
            <div 
              className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: `${color}18` }}
            >
              {iconMap[icon] || iconMap.alert}
            </div>
            <div>
              <h3 className="text-lg font-bold" style={{ color: '#0D3B1F' }}>{title}</h3>
              <p className="text-sm mt-1" style={{ color: '#6B7280' }}>{message}</p>
            </div>
          </div>

          {/* Séparateur */}
          <div className="border-t my-4" style={{ borderColor: '#E8F5EC' }} />

          {/* Boutons */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 font-medium rounded-lg transition-colors text-sm"
              style={{ background: '#F3F4F6', color: '#4B5563' }}
            >
              Annuler
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 py-2.5 font-medium rounded-lg transition-colors text-sm text-white flex items-center justify-center gap-2"
              style={{ background: color }}
            >
              {iconMap[icon]}
              Confirmer
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SecretariatPage
