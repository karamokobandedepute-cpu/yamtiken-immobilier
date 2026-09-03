import { useEffect, useState, useCallback } from 'react'
import { useRealtimeSync } from '../hooks/useRealtimeSync'
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Users,
  PieChart as PieChartIcon,
  BarChart3,
  FileText,
  Calendar,
  Wallet,
  Target,
  RefreshCw,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Activity,
  Radio,
  Bell
} from 'lucide-react'
import LiveClock from '../components/LiveClock'
// import DemoDataManager from '../components/DemoDataManager'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, LineChart, Line, ComposedChart,
  RadialBarChart, RadialBar
} from 'recharts'
import {
  fetchDashboardKPI,
  fetchRevenusCourbe,
  fetchOccupationParType,
  fetchRevenusParImmeuble,
  fetchRapportMensuel,
  fetchRapportAnnuel,
  fetchEtatCreances,
  fetchActivites,
  fetchStatistiquesMensuelles,
  fetchDroitsTerre,
  fetchClientsRetard,
  fetchLeases
} from '../utils/api'
import { formatCurrency, formatDate } from '../utils/formatters'
import toast from 'react-hot-toast'
import jsPDF from 'jspdf'
import { addPdfHeader, addPdfFooter, addWatermark } from '../utils/pdfUtils'
import { logDocGeneration } from '../utils/pdfLogger'
import { useAuthStore } from '../stores/authStore'

const COLORS_PIE = ['#0D3B1F', '#1A6B35', '#2D9E57', '#C8960C']

// addPdfHeader et addWatermark importés depuis pdfUtils (logo + filigrane intégrés)

const DashboardPage = () => {
  const { user } = useAuthStore()
  const [kpi, setKpi] = useState(null)
  const [revenusCourbe, setRevenusCourbe] = useState([])
  const [occupationType, setOccupationType] = useState([])
  const [revenusImmeuble, setRevenusImmeuble] = useState([])
  const [statsMensuelles, setStatsMensuelles] = useState(null)
  const [droitsTerre, setDroitsTerre] = useState(null)
  const [clientsRetard, setClientsRetard] = useState([])
  const [leases, setLeases] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [generatingPDF, setGeneratingPDF] = useState(null) // 'mensuel' | 'annuel' | 'creances' | null
  const [pulse, setPulse] = useState(false)
  
  // ✅ SYNCHRONISATION TEMPS RÉEL SUPABASE
  const { status: realtimeStatus, lastSync } = useRealtimeSync({ enabled: true })
  
  // ✅ MODE TEMPS RÉEL - États
  const [isRealtime, setIsRealtime] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [liveActivities, setLiveActivities] = useState([])
  const [unreadAlerts, setUnreadAlerts] = useState(0)

  // Chargement initial
  useEffect(() => {
    loadData()
    loadLiveActivities()
    
    // Auto-refresh toutes les 30 secondes si pas en mode temps réel
    const interval = !isRealtime ? setInterval(() => {
      refreshData()
    }, 30000) : null
    
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isRealtime])
  
  // 🔄 Rafraîchir quand Supabase Realtime détecte un changement
  useEffect(() => {
    if (lastSync) {
      console.log('[Dashboard] Changement détecté via Realtime, rafraîchissement...')
      loadData()
    }
  }, [lastSync])

  // Rafraîchir au retour sur la page
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadData()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  const loadData = async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true)
    else setLoading(true)
    try {
      const [kpiRes, courbeRes, occupationRes, immeubleRes, statsRes, dtRes, crRes, leasesRes] = await Promise.allSettled([
        fetchDashboardKPI(),
        fetchRevenusCourbe(),
        fetchOccupationParType(),
        fetchRevenusParImmeuble(),
        fetchStatistiquesMensuelles(),
        fetchDroitsTerre(),
        fetchClientsRetard(),
        fetchLeases()
      ])
      if (kpiRes.status === 'fulfilled') setKpi(kpiRes.value.data)
      if (courbeRes.status === 'fulfilled') setRevenusCourbe(courbeRes.value.data)
      if (occupationRes.status === 'fulfilled') setOccupationType(occupationRes.value.data)
      if (immeubleRes.status === 'fulfilled') setRevenusImmeuble(immeubleRes.value.data)
      if (statsRes.status === 'fulfilled') setStatsMensuelles(statsRes.value.data)
      if (dtRes.status === 'fulfilled') setDroitsTerre(dtRes.value.data)
      if (crRes.status === 'fulfilled') {
        const d = crRes.value.data?.data || crRes.value.data || []
        setClientsRetard(Array.isArray(d) ? d : [])
      }
      if (leasesRes.status === 'fulfilled') {
        const d = leasesRes.value.data?.data || leasesRes.value.data || []
        setLeases(Array.isArray(d) ? d : [])
      }
      setLastUpdate(new Date())
      setPulse(true); setTimeout(() => setPulse(false), 600)
    } catch (error) {
      console.error('Erreur dashboard:', error)
      toast.error('Erreur lors du chargement du dashboard')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }
  
  const refreshData = useCallback(async () => {
    try {
      const kpiRes = await fetchDashboardKPI()
      setKpi(kpiRes.data)
      setLastUpdate(new Date())
    } catch (error) {
      console.error('Erreur refresh:', error)
    }
  }, [])
  
  const loadLiveActivities = async () => {
    try {
      const res = await fetchActivites()
      const data = res.data?.data || res.data || []
      const activities = Array.isArray(data) ? data.slice(0, 5).map((a, i) => ({
        id: a.id || i,
        type: a.type || 'activity',
        message: a.message || a.description || a.action || '',
        time: a.createdAt ? new Date(a.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '',
        icon: a.type === 'payment' ? DollarSign : a.type === 'visit' ? Users : a.type === 'alert' ? AlertTriangle : FileText
      })) : []
      setLiveActivities(activities)
      setUnreadAlerts(activities.filter(a => a.type === 'alert').length)
    } catch {
      setLiveActivities([])
    }
  }
  
  // Toggle mode temps réel
  const toggleRealtime = () => {
    setIsRealtime(!isRealtime)
    toast.success(isRealtime ? 'Mode standard activé' : '🟢 Mode temps réel activé !')
  }

  // ============================================
  // PDF RAPPORT MENSUEL
  // ============================================
  const generateRapportMensuel = async () => {
    setGeneratingPDF('mensuel')
    try {
      const res = await fetchRapportMensuel()
      const data = res.data
      const doc = new jsPDF('p', 'mm', 'a4')
      const pw = doc.internal.pageSize.getWidth()

      // Filigrane + en-tête avec logo
      addWatermark(doc)
      addPdfHeader(doc, 'RAPPORT MENSUEL', data.periode.toUpperCase(), user)

      let y = 44

      // Tableau entrées/sorties
      doc.setTextColor('#0A2412')
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('RÉCAPITULATIF FINANCIER', 15, y)
      doc.setDrawColor('#C8960C')
      doc.setLineWidth(0.5)
      doc.line(15, y + 2, pw - 15, y + 2)
      y += 10

      const recapRows = [
        ['Entrées du mois', formatCurrency(data.entrees)],
        ['Nouveaux clients', String(data.nouveauxClients)],
        ['Clients actifs', String(data.clientsActifs)],
        ['Clients partis', String(data.clientsPartis)],
        ['Solde de caisse', formatCurrency(data.soldeCaisse)]
      ]

      recapRows.forEach(([label, val]) => {
        doc.setFillColor(y % 14 < 7 ? '#F9FAFB' : '#FFFFFF')
        doc.rect(15, y - 4, pw - 30, 8, 'F')
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.setTextColor('#0A2412')
        doc.text(label, 20, y)
        doc.setFont('helvetica', 'bold')
        doc.text(val, pw - 20, y, { align: 'right' })
        y += 8
      })

      // Graphique revenus par jour (simplifié en tableau)
      y += 10
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor('#0A2412')
      doc.text('REVENUS PAR JOUR', 15, y)
      doc.setDrawColor('#C8960C')
      doc.line(15, y + 2, pw - 15, y + 2)
      y += 8

      if (Array.isArray(data?.revenusParJour) && data.revenusParJour.length > 0) {
        // En-têtes tableau
        doc.setFillColor('#E8F5EC')
        doc.rect(15, y - 4, pw - 30, 8, 'F')
        doc.setTextColor('#0D3B1F')
        doc.setFontSize(9)
        doc.setFont('helvetica', 'bold')
        doc.text('Jour', 20, y)
        doc.text('Montant', pw - 20, y, { align: 'right' })
        y += 8

        doc.setTextColor('#0A2412')
        doc.setFont('helvetica', 'normal')
        data.revenusParJour.forEach((r) => {
          if (y > 270) { doc.addPage(); y = 20 }
          doc.text(`Jour ${r.jour}`, 20, y)
          doc.text(formatCurrency(r.montant), pw - 20, y, { align: 'right' })
          y += 6
        })
      }

      // Solde final
      y += 10
      doc.setFillColor('#E8F5EC')
      doc.rect(15, y - 4, pw - 30, 12, 'F')
      doc.setTextColor('#0D3B1F')
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text('SOLDE FINAL DE CAISSE', 20, y + 3)
      doc.setTextColor('#1A6B35')
      doc.setFontSize(13)
      doc.text(formatCurrency(data.soldeCaisse), pw - 20, y + 3, { align: 'right' })

      addPdfFooter(doc, 1, true, user)

      doc.save(`RAPPORT-MENSUEL-${data.periode}.pdf`)
      logDocGeneration(user, 'PDF_GENERATED', `RAPPORT-MENSUEL-${data.periode}.pdf`, 'dashboard')
      toast.success('Rapport mensuel généré')
    } catch (error) {
      toast.error('Erreur lors de la génération du rapport')
    } finally {
      setGeneratingPDF(null)
    }
  }

  // ============================================
  // PDF RAPPORT ANNUEL
  // ============================================
  const generateRapportAnnuel = async () => {
    setGeneratingPDF('annuel')
    try {
      const res = await fetchRapportAnnuel()
      const data = res.data
      const doc = new jsPDF('p', 'mm', 'a4')
      const pw = doc.internal.pageSize.getWidth()

      // Filigrane + en-tête avec logo
      addWatermark(doc)
      addPdfHeader(doc, 'RAPPORT ANNUEL', `Exercice ${data.annee}`, user)

      let y = 44

      // Bilan 12 mois
      doc.setTextColor('#0A2412')
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('BILAN MENSUEL', 15, y)
      doc.setDrawColor('#C8960C')
      doc.setLineWidth(0.5)
      doc.line(15, y + 2, pw - 15, y + 2)
      y += 8

      // En-têtes tableau
      doc.setFillColor('#E8F5EC')
      doc.rect(15, y - 4, pw - 30, 8, 'F')
      doc.setTextColor('#0D3B1F')
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.text('Mois', 20, y)
      doc.text('Montant', pw - 20, y, { align: 'right' })
      y += 8

      doc.setTextColor('#0A2412')
      doc.setFont('helvetica', 'normal')
      Array.isArray(data?.revenusMensuels) && data.revenusMensuels.forEach((r) => {
        doc.text(r.mois, 20, y)
        doc.text(formatCurrency(r.montant), pw - 20, y, { align: 'right' })
        y += 6
      })

      // Total annuel
      y += 4
      doc.setFillColor('#E8F5EC')
      doc.rect(15, y - 4, pw - 30, 10, 'F')
      doc.setTextColor('#0D3B1F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text('TOTAL ANNUEL', 20, y + 2)
      doc.text(formatCurrency(data.totalAnnuel), pw - 20, y + 2, { align: 'right' })
      y += 14

      // Taux de recouvrement
      doc.setTextColor('#0A2412')
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('TAUX DE RECOUVREMENT GLOBAL', 15, y)
      y += 6
      doc.setFontSize(20)
      doc.setTextColor('#1A6B35')
      doc.text(`${data.tauxRecouvrement}%`, 20, y)
      y += 14

      // Top 5 clients
      if (y > 220) { doc.addPage(); y = 20 }
      doc.setTextColor('#0A2412')
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('TOP 5 CLIENTS', 15, y)
      doc.setDrawColor('#C8960C')
      doc.line(15, y + 2, pw - 15, y + 2)
      y += 8

      Array.isArray(data?.topClients) && data.topClients.forEach((tc, i) => {
        if (!tc?.client) return
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor('#0A2412')
        doc.text(`${i + 1}. ${tc.client.prenom} ${tc.client.nom}`, 20, y)
        doc.setFont('helvetica', 'bold')
        doc.text(formatCurrency(tc.montant), pw - 20, y, { align: 'right' })
        y += 7
      })

      // Top 3 immeubles
      y += 8
      if (y > 240) { doc.addPage(); y = 20 }
      doc.setTextColor('#0A2412')
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('TOP 3 IMMEUBLES', 15, y)
      doc.setDrawColor('#C8960C')
      doc.line(15, y + 2, pw - 15, y + 2)
      y += 8

      Array.isArray(data?.topBuildings) && data.topBuildings.forEach((tb, i) => {
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor('#0A2412')
        doc.text(`${i + 1}. ${tb.nom}`, 20, y)
        doc.setFont('helvetica', 'bold')
        doc.text(formatCurrency(tb.revenus), pw - 20, y, { align: 'right' })
        y += 7
      })

      addPdfFooter(doc, 1, true, user)

      doc.save(`RAPPORT-ANNUEL-${data.annee}.pdf`)
      logDocGeneration(user, 'PDF_GENERATED', `RAPPORT-ANNUEL-${data.annee}.pdf`, 'dashboard')
      toast.success('Rapport annuel généré')
    } catch (error) {
      toast.error('Erreur lors de la génération du rapport annuel')
    } finally {
      setGeneratingPDF(null)
    }
  }

  // ============================================
  // PDF ÉTAT DES CRÉANCES
  // ============================================
  const generateEtatCreances = async () => {
    setGeneratingPDF('creances')
    try {
      const res = await fetchEtatCreances()
      const data = res.data
      const doc = new jsPDF('p', 'mm', 'a4')
      const pw = doc.internal.pageSize.getWidth()

      // Filigrane + en-tête avec logo
      addWatermark(doc)
      addPdfHeader(doc, 'ÉTAT DES CRÉANCES', `Au ${new Date().toLocaleDateString('fr-FR')}`)

      let y = 44

      // Résumé
      doc.setFillColor('#E8F5EC')
      doc.rect(15, y - 4, pw - 30, 20, 'F')
      doc.setTextColor('#0D3B1F')
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text(`Total créances: ${formatCurrency(data.totalCreances)}`, 20, y)
      y += 6
      doc.text(`Nombre de dossiers: ${data.nbCreances}`, 20, y)
      y += 6

      doc.setTextColor('#DC2626')
      doc.text(`Critiques (>30j): ${data.nbCritiques}`, 20, y)
      doc.setTextColor('#C8960C')
      doc.text(`Alertes (8-30j): ${data.nbAlertes}`, pw / 2, y)
      y += 12

      // Tableau créances
      doc.setTextColor('#0A2412')
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('DÉTAIL DES CRÉANCES', 15, y)
      doc.setDrawColor('#C8960C')
      doc.line(15, y + 2, pw - 15, y + 2)
      y += 8

      // En-têtes
      doc.setFillColor('#0D3B1F')
      doc.rect(15, y - 4, pw - 30, 8, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text('Client', 20, y)
      doc.text('N° Bail', 70, y)
      doc.text('Reste dû', 110, y)
      doc.text('Retard', 150, y)
      doc.text('Catégorie', 175, y)
      y += 8

      Array.isArray(data?.creances) && data.creances.forEach((c) => {
        if (y > 270) { doc.addPage(); y = 20 }

        // Couleur de ligne selon catégorie
        let bgColor = '#F0FDF4' // vert OK
        let textColor = '#166534'
        if (c.categorie === 'CRITIQUE') { bgColor = '#FEE2E2'; textColor = '#991B1B' }
        else if (c.categorie === 'ALERTE') { bgColor = '#FEF3C7'; textColor = '#92400E' }

        doc.setFillColor(bgColor)
        doc.rect(15, y - 4, pw - 30, 7, 'F')

        doc.setTextColor(textColor)
        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        doc.text(`${c.client.prenom} ${c.client.nom}`, 20, y)
        doc.text(c.numeroBail || '-', 70, y)
        doc.text(formatCurrency(c.resteDu), 110, y)
        doc.text(`${c.joursRetard}j`, 150, y)
        doc.setFont('helvetica', 'bold')
        doc.text(c.categorie, 175, y)
        y += 7
      })

      addPdfFooter(doc, null, true)

      doc.save(`ETAT-CREANCES-${new Date().toISOString().slice(0, 10)}.pdf`)
      logDocGeneration(user, 'PDF_GENERATED', `ETAT-CREANCES-${new Date().toISOString().slice(0,10)}.pdf`, 'dashboard')
      toast.success('État des créances généré')
    } catch (error) {
      toast.error('Erreur lors de la génération')
    } finally {
      setGeneratingPDF(null)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="animate-spin rounded-full h-14 w-14 border-4 border-t-transparent" style={{ borderColor: '#1A6B35' }} />
        <p className="text-sm animate-pulse" style={{ color: '#1A6B35' }}>Chargement du tableau de bord…</p>
      </div>
    )
  }

  // ── Données dérivées ──────────────────────────────────────────────────────
  const pieData = Array.isArray(occupationType) ? occupationType.map(t => ({
    name: t?.type || 'Autre', value: t?.occupees || 0, total: t?.total || 0
  })) : []

  // Statut des baux
  const bauxActifs   = leases.filter(l => l.statut === 'ACTIF').length
  const bauxExpires  = leases.filter(l => l.statut === 'EXPIRE').length
  const bauxResilies = leases.filter(l => l.statut === 'RESILIE').length
  const bauxStatutData = [
    { name: 'Actifs',   value: bauxActifs,   fill: '#1A6B35' },
    { name: 'Expirés',  value: bauxExpires,  fill: '#C8960C' },
    { name: 'Résiliés', value: bauxResilies, fill: '#DC2626' },
  ].filter(d => d.value > 0)

  // Droits de terre ce mois
  const dtEntries = droitsTerre?.entries || []
  const dtPayes   = dtEntries.filter(e => e.status === 'PAYÉ').length
  const dtPartiel = dtEntries.filter(e => e.status === 'PARTIEL').length
  const dtImpayes = dtEntries.filter(e => e.status === 'IMPAYÉ').length
  const dtPieData = [
    { name: 'Payé',    value: dtPayes,   fill: '#10B981' },
    { name: 'Partiel', value: dtPartiel, fill: '#F59E0B' },
    { name: 'Impayé',  value: dtImpayes, fill: '#EF4444' },
  ].filter(d => d.value > 0)

  // Attendu vs encaissé 12 mois
  const statsBarData = statsMensuelles?.statsMensuelles || []

  // Taux recouvrement radial
  const tauxRecouv = parseFloat(statsMensuelles?.tauxGlobal || kpi?.tauxOccupation || 0)
  const radialData = [{ name: 'Taux', value: tauxRecouv, fill: tauxRecouv >= 75 ? '#10B981' : tauxRecouv >= 50 ? '#F59E0B' : '#EF4444' }]

  // Droits de terre — totaux et par bâtiment
  const dtAttenduMois  = dtEntries.reduce((s, e) => s + (e.droitTerre || 0), 0)
  const dtEncaisseMois = dtEntries.reduce((s, e) => s + (e.payedThisMonth || 0), 0)
  const dtResteMois    = dtEntries.reduce((s, e) => s + (e.resteThisMonth || 0), 0)
  const dtParBatiment  = (droitsTerre?.grouped || []).map(g => ({
    nom:      g.building?.nom || 'Inconnu',
    attendu:  g.entries.reduce((s, e) => s + (e.droitTerre    || 0), 0),
    encaisse: g.entries.reduce((s, e) => s + (e.payedThisMonth|| 0), 0),
    reste:    g.entries.reduce((s, e) => s + (e.resteThisMonth|| 0), 0),
    portes:   g.entries.length,
    payes:    g.entries.filter(e => e.status === 'PAYÉ').length,
  }))

  // Top créanciers
  const topCreances = [...clientsRetard].sort((a, b) => (b.montantDu || 0) - (a.montantDu || 0)).slice(0, 5)

  const TOOLTIP_STYLE = { backgroundColor: '#fff', border: '1px solid #E8F5EC', borderRadius: '8px', color: '#0A2412' }
  const BOX = { background: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', borderRadius: '16px' }

  const KCard = ({ title, value, sub, icon: Icon, color, trend, pulse: p }) => (
    <div className={`p-4 rounded-2xl transition-all hover:shadow-lg hover:-translate-y-0.5 ${p ? 'ring-2 ring-green-400 ring-opacity-60' : ''}`}
      style={{ background: `linear-gradient(135deg, ${color}18 0%, ${color}08 100%)`, border: `1px solid ${color}30` }}>
      <div className="flex items-start justify-between mb-2">
        <div className="p-2 rounded-xl" style={{ background: `${color}22` }}>
          <Icon size={18} style={{ color }} />
        </div>
        {trend === 'up' && <ArrowUpRight size={14} style={{ color: '#10B981' }} />}
        {trend === 'down' && <ArrowDownRight size={14} style={{ color: '#DC2626' }} />}
      </div>
      <p className="text-xs font-medium mb-0.5 truncate" style={{ color: '#6B7280' }}>{title}</p>
      <p className="text-xl font-bold leading-tight" style={{ color: '#0A2412' }}>{value}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{sub}</p>}
    </div>
  )

  return (
    <div className="space-y-5">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#0D3B1F' }}>Dashboard Direction</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs" style={{ color: '#9CA3AF' }}>
              {lastUpdate ? `Mise à jour à ${lastUpdate.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}` : ''}
            </p>
          </div>
        </div>
        <LiveClock showSeconds showDate />
        <button onClick={() => loadData(true)} disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:shadow disabled:opacity-50"
          style={{ background: '#E8F5EC', color: '#1A6B35' }}>
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Actualisation…' : 'Actualiser'}
        </button>
      </div>

      {/* ── 10 KPI CARDS ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KCard title="Revenus du mois"      value={formatCurrency(kpi?.revenusMois||0)}     icon={DollarSign}  color="#1A6B35"  trend={null}   pulse={pulse}/>
        <KCard title="Revenus annuels"      value={formatCurrency(kpi?.revenusAnnee||0)}    icon={TrendingUp}  color="#0D3B1F"  trend="up"     pulse={pulse}/>
        <KCard title="Créances totales"     value={formatCurrency(kpi?.creancesTotales||0)} icon={AlertTriangle} color="#DC2626" trend={kpi?.creancesTotales>0?'down':null} pulse={pulse}/>
        <KCard title="Taux d'occupation"    value={`${kpi?.tauxOccupation||0}%`}            sub={`${kpi?.unitesOccupees||0}/${kpi?.unitesTotal||0} unités`} icon={Target} color="#2D9E57" trend={kpi?.tauxOccupation>=80?'up':null} pulse={pulse}/>
        <KCard title="Solde de caisse"      value={formatCurrency(kpi?.soldeCaisse||0)}     icon={Wallet}      color="#C8960C"  trend={null}   pulse={pulse}/>
        <KCard title="Prévision 30 jours"   value={formatCurrency(kpi?.prevision30j||0)}    icon={Calendar}    color="#6366F1"  trend={null}   pulse={pulse}/>
        <KCard title="Nouveaux clients"     value={kpi?.nouveauxClients||0}                sub="ce mois"    icon={Users}    color="#10B981" trend={kpi?.nouveauxClients>0?'up':null} pulse={pulse}/>
        <KCard title="Baux actifs"          value={bauxActifs}                              sub={`${leases.length} total`} icon={FileText} color="#3B82F6" trend={null} pulse={pulse}/>
        <KCard title="Baux expirant"        value={kpi?.bauxExpirant||0}                   sub="ce mois"    icon={Bell}     color="#F59E0B" trend={kpi?.bauxExpirant>0?'down':null} pulse={pulse}/>
        <KCard title="Taux recouvrement"    value={`${tauxRecouv}%`}                        sub="annuel"     icon={Activity} color="#8B5CF6" trend={tauxRecouv>=70?'up':'down'} pulse={pulse}/>
      </div>

      {/* ── DROITS DE TERRE KPI (bande rapide) ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl flex items-center gap-4" style={{ background:'linear-gradient(135deg,#ECFDF5,#D1FAE5)', border:'1px solid #6EE7B7' }}>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background:'#10B981' }}>
            <Zap size={20} className="text-white"/>
          </div>
          <div>
            <p className="text-xs font-medium" style={{ color:'#065F46' }}>DT attendus ce mois</p>
            <p className="text-2xl font-bold" style={{ color:'#047857' }}>{formatCurrency(dtAttenduMois)}</p>
            <p className="text-xs" style={{ color:'#6B7280' }}>{dtEntries.length} porte(s) active(s)</p>
          </div>
        </div>
        <div className="p-4 rounded-2xl flex items-center gap-4" style={{ background:'linear-gradient(135deg,#F0FDF4,#DCFCE7)', border:'1px solid #86EFAC' }}>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background:'#1A6B35' }}>
            <DollarSign size={20} className="text-white"/>
          </div>
          <div>
            <p className="text-xs font-medium" style={{ color:'#166534' }}>DT encaissés ce mois</p>
            <p className="text-2xl font-bold" style={{ color:'#1A6B35' }}>{formatCurrency(dtEncaisseMois)}</p>
            <p className="text-xs" style={{ color:'#6B7280' }}>{dtPayes} payé(s) / {dtEntries.length} porte(s)</p>
          </div>
        </div>
        <div className="p-4 rounded-2xl flex items-center gap-4" style={{ background:'linear-gradient(135deg,#FEF2F2,#FEE2E2)', border:`1px solid ${dtResteMois>0?'#FCA5A5':'#86EFAC'}` }}>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: dtResteMois>0?'#DC2626':'#10B981' }}>
            <AlertTriangle size={20} className="text-white"/>
          </div>
          <div>
            <p className="text-xs font-medium" style={{ color: dtResteMois>0?'#991B1B':'#166534' }}>DT reste à encaisser</p>
            <p className="text-2xl font-bold" style={{ color: dtResteMois>0?'#DC2626':'#10B981' }}>{formatCurrency(dtResteMois)}</p>
            <p className="text-xs" style={{ color:'#6B7280' }}>{dtImpayes} impayé(s) + {dtPartiel} partiel(s)</p>
          </div>
        </div>
      </div>

      {/* ── ROW 2 : Courbe 12 mois + Statut baux pie ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 p-5" style={BOX}>
          <h3 className="text-sm font-bold mb-3" style={{ color: '#0D3B1F' }}>📈 Revenus encaissés — 12 derniers mois</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={Array.isArray(revenusCourbe) ? revenusCourbe : []}>
                <defs>
                  <linearGradient id="gr1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#1A6B35" stopOpacity={0.35}/>
                    <stop offset="95%" stopColor="#1A6B35" stopOpacity={0.02}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0"/>
                <XAxis dataKey="mois" stroke="#9CA3AF" fontSize={11}/>
                <YAxis stroke="#9CA3AF" fontSize={11} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
                <Tooltip formatter={v=>[formatCurrency(v),'Encaissé']} contentStyle={TOOLTIP_STYLE}/>
                <Area type="monotone" dataKey="montant" stroke="#1A6B35" strokeWidth={2.5} fill="url(#gr1)" dot={{ r:3, fill:'#1A6B35' }} activeDot={{ r:5 }}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-5" style={BOX}>
          <h3 className="text-sm font-bold mb-3" style={{ color: '#0D3B1F' }}>🥧 Statut des baux</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={bauxStatutData} cx="50%" cy="45%" innerRadius={55} outerRadius={90}
                  paddingAngle={4} dataKey="value" nameKey="name"
                  label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                  {bauxStatutData.map((e,i) => <Cell key={i} fill={e.fill}/>)}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE}/>
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize:'11px' }}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── ROW 3 : Attendu vs Encaissé barres + Droits de Terre donut ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 p-5" style={BOX}>
          <h3 className="text-sm font-bold mb-3" style={{ color: '#0D3B1F' }}>📊 Attendu vs Encaissé — mois par mois</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={statsBarData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0"/>
                <XAxis dataKey="mois" stroke="#9CA3AF" fontSize={11}/>
                <YAxis stroke="#9CA3AF" fontSize={11} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
                <Tooltip formatter={v=>[formatCurrency(v)]} contentStyle={TOOLTIP_STYLE}/>
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize:'11px' }}/>
                <Bar dataKey="attendu"  name="Attendu"   fill="#E8F5EC" stroke="#1A6B35" strokeWidth={1} radius={[4,4,0,0]}/>
                <Bar dataKey="encaisse" name="Encaissé"  fill="#1A6B35" radius={[4,4,0,0]}/>
                <Line dataKey="taux" name="Taux %" yAxisId={0} type="monotone" stroke="#C8960C" strokeWidth={2} dot={false}/>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-5" style={BOX}>
          <h3 className="text-sm font-bold mb-1" style={{ color: '#0D3B1F' }}>🏡 Droits de Terre ce mois</h3>
          <p className="text-xs mb-3" style={{ color: '#9CA3AF' }}>{dtEntries.length} porte(s) active(s)</p>
          {dtEntries.length === 0 ? (
            <div className="flex items-center justify-center h-52" style={{ color: '#D1D5DB' }}>
              <p className="text-sm">Aucune donnée</p>
            </div>
          ) : (
            <>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={dtPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={72}
                      paddingAngle={4} dataKey="value" nameKey="name">
                      {dtPieData.map((e,i)=><Cell key={i} fill={e.fill}/>)}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-3 gap-1 mt-2">
                {[{l:'Payés',v:dtPayes,c:'#10B981'},{l:'Partiels',v:dtPartiel,c:'#F59E0B'},{l:'Impayés',v:dtImpayes,c:'#EF4444'}].map(x=>(
                  <div key={x.l} className="text-center p-2 rounded-lg" style={{ background:`${x.c}15` }}>
                    <p className="text-lg font-bold" style={{ color:x.c }}>{x.v}</p>
                    <p className="text-xs" style={{ color:'#6B7280' }}>{x.l}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── ROW DT : Droits de terre par bâtiment ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Graphique barres groupées */}
        <div className="p-5" style={BOX}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold" style={{ color: '#0D3B1F' }}>🏢 Droits de Terre par bâtiment — {new Date().toLocaleString('fr-FR',{month:'long',year:'numeric'})}</h3>
            <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background:'#DCFCE7', color:'#166534' }}>{dtParBatiment.length} bâtiment(s)</span>
          </div>
          {dtParBatiment.length === 0 ? (
            <div className="flex items-center justify-center h-52" style={{ color:'#D1D5DB' }}>
              <p className="text-sm">Aucun bâtiment avec droit de terre actif</p>
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dtParBatiment} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0"/>
                  <XAxis type="number" stroke="#9CA3AF" fontSize={10} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
                  <YAxis type="category" dataKey="nom" stroke="#9CA3AF" fontSize={10} width={100} tickLine={false}/>
                  <Tooltip
                    formatter={(v, name) => [formatCurrency(v), name]}
                    contentStyle={TOOLTIP_STYLE}/>
                  <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize:'10px' }}/>
                  <Bar dataKey="attendu"  name="Attendu"  fill="#DCFCE7" stroke="#1A6B35" strokeWidth={1} radius={[0,4,4,0]} barSize={16}/>
                  <Bar dataKey="encaisse" name="Encaissé" fill="#1A6B35"                                   radius={[0,4,4,0]} barSize={16}/>
                  <Bar dataKey="reste"    name="Reste dû" fill="#FCA5A5" stroke="#DC2626" strokeWidth={1}  radius={[0,4,4,0]} barSize={16}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Tableau détail par bâtiment */}
        <div className="p-5" style={BOX}>
          <h3 className="text-sm font-bold mb-3" style={{ color: '#0D3B1F' }}>📋 Détail par bâtiment</h3>
          {dtParBatiment.length === 0 ? (
            <div className="flex items-center justify-center h-52" style={{ color:'#D1D5DB' }}>
              <p className="text-sm">Aucune donnée</p>
            </div>
          ) : (
            <div className="space-y-2 overflow-y-auto" style={{ maxHeight:'240px' }}>
              {dtParBatiment.map((b, i) => {
                const taux = b.attendu > 0 ? Math.round((b.encaisse / b.attendu) * 100) : 0
                const barColor = taux >= 80 ? '#10B981' : taux >= 50 ? '#F59E0B' : '#EF4444'
                return (
                  <div key={i} className="p-3 rounded-xl" style={{ background:'#F9FAFB', border:'1px solid #F3F4F6' }}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-bold truncate max-w-[55%]" style={{ color:'#0D3B1F' }}>{b.nom}</p>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs" style={{ color:'#6B7280' }}>{b.payes}/{b.portes} payés</span>
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ background:`${barColor}20`, color:barColor }}>{taux}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden mb-1.5" style={{ background:'#E5E7EB' }}>
                      <div className="h-full rounded-full transition-all" style={{ width:`${Math.min(taux,100)}%`, background:barColor }}/>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span style={{ color:'#10B981' }}>✓ {formatCurrency(b.encaisse)}</span>
                      <span style={{ color:'#9CA3AF' }}>/{formatCurrency(b.attendu)}</span>
                      {b.reste > 0 && <span style={{ color:'#DC2626' }}>-{formatCurrency(b.reste)}</span>}
                    </div>
                  </div>
                )
              })}
              {/* Ligne totaux */}
              <div className="p-3 rounded-xl" style={{ background:'linear-gradient(135deg,#DCFCE7,#F0FDF4)', border:'1px solid #86EFAC' }}>
                <div className="flex justify-between items-center">
                  <p className="text-xs font-bold" style={{ color:'#166534' }}>TOTAL</p>
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ background:'#166534', color:'white' }}>
                    {dtAttenduMois > 0 ? Math.round((dtEncaisseMois/dtAttenduMois)*100) : 0}%
                  </span>
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="font-bold" style={{ color:'#1A6B35' }}>{formatCurrency(dtEncaisseMois)}</span>
                  <span style={{ color:'#9CA3AF' }}>/{formatCurrency(dtAttenduMois)}</span>
                  {dtResteMois > 0 && <span className="font-bold" style={{ color:'#DC2626' }}>-{formatCurrency(dtResteMois)}</span>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── ROW 4 : Revenus par immeuble + Taux recouvrement jauge + Créances top ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="p-5" style={BOX}>
          <h3 className="text-sm font-bold mb-3" style={{ color: '#0D3B1F' }}>🏢 Revenus par immeuble</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={Array.isArray(revenusImmeuble)?revenusImmeuble:[]} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0"/>
                <XAxis type="number" stroke="#9CA3AF" fontSize={10} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
                <YAxis type="category" dataKey="nom" stroke="#9CA3AF" fontSize={10} width={90}/>
                <Tooltip formatter={v=>[formatCurrency(v),'Revenus']} contentStyle={TOOLTIP_STYLE}/>
                <Bar dataKey="revenus" fill="#1A6B35" radius={[0,5,5,0]} barSize={18}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-5 flex flex-col items-center justify-center" style={BOX}>
          <h3 className="text-sm font-bold mb-1 self-start" style={{ color: '#0D3B1F' }}>🎯 Taux de recouvrement global</h3>
          <p className="text-xs self-start mb-4" style={{ color: '#9CA3AF' }}>Basé sur l'année en cours</p>
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart cx="50%" cy="50%" innerRadius="55%" outerRadius="90%"
                startAngle={220} endAngle={-40} data={[{ value: tauxRecouv, fill: radialData[0].fill }]}>
                <RadialBar dataKey="value" cornerRadius={8} background={{ fill: '#F3F4F6' }}/>
                <text x="50%" y="48%" textAnchor="middle" dominantBaseline="middle"
                  style={{ fontSize: '28px', fontWeight: 'bold', fill: radialData[0].fill }}>{tauxRecouv}%</text>
                <text x="50%" y="60%" textAnchor="middle" dominantBaseline="middle"
                  style={{ fontSize: '11px', fill: '#9CA3AF' }}>recouvré</text>
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
          <div className="w-full grid grid-cols-2 gap-2 mt-1">
            <div className="p-2 rounded-lg text-center" style={{ background: '#F0FDF4' }}>
              <p className="text-xs" style={{ color: '#6B7280' }}>Encaissé</p>
              <p className="text-sm font-bold" style={{ color: '#1A6B35' }}>{formatCurrency(statsMensuelles?.totalEncaisse||0)}</p>
            </div>
            <div className="p-2 rounded-lg text-center" style={{ background: '#FEF3C7' }}>
              <p className="text-xs" style={{ color: '#6B7280' }}>Attendu</p>
              <p className="text-sm font-bold" style={{ color: '#C8960C' }}>{formatCurrency(statsMensuelles?.totalAttendu||0)}</p>
            </div>
          </div>
        </div>

        <div className="p-5" style={BOX}>
          <h3 className="text-sm font-bold mb-3" style={{ color: '#0D3B1F' }}>⚠️ Top créances impayées</h3>
          {topCreances.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2" style={{ color: '#D1D5DB' }}>
              <Activity size={32}/>
              <p className="text-sm">Aucune créance</p>
            </div>
          ) : (
            <div className="space-y-2">
              {topCreances.map((c, i) => (
                <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-xl transition-all hover:bg-gray-50"
                  style={{ borderLeft: `3px solid ${i===0?'#DC2626':i===1?'#F59E0B':'#10B981'}` }}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: '#FEE2E2', color: '#DC2626' }}>{i+1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate" style={{ color: '#0D3B1F' }}>{c.client?.prenom} {c.client?.nom}</p>
                    <p className="text-xs" style={{ color: '#9CA3AF' }}>{c.bien?.numeroBail || ''}</p>
                  </div>
                  <p className="text-xs font-bold flex-shrink-0" style={{ color: '#DC2626' }}>{formatCurrency(c.montantDu||0)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── ROW 5 : Occupation par type + Activité récente + Rapports PDF ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="p-5" style={BOX}>
          <h3 className="text-sm font-bold mb-3" style={{ color: '#0D3B1F' }}>🏠 Occupation par type</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={75} paddingAngle={3}
                  dataKey="value" nameKey="name"
                  label={({ name, percent }) => percent>0.05?`${name}\n${(percent*100).toFixed(0)}%`:null}>
                  {pieData.map((_,i)=><Cell key={i} fill={COLORS_PIE[i%COLORS_PIE.length]}/>)}
                </Pie>
                <Tooltip formatter={(v,n,p)=>[`${v}/${p.payload.total}`,n]} contentStyle={TOOLTIP_STYLE}/>
                <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize:'10px' }}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-5" style={BOX}>
          <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: '#0D3B1F' }}>
            <Radio size={14} className="text-green-600 animate-pulse"/> Activité récente
          </h3>
          {liveActivities.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2" style={{ color: '#D1D5DB' }}>
              <Bell size={28}/>
              <p className="text-sm">Aucune activité</p>
            </div>
          ) : (
            <div className="space-y-2">
              {liveActivities.map((a,i) => (
                <div key={a.id||i} className="flex items-start gap-3 p-2.5 rounded-xl" style={{ background: '#F9FAFB' }}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#E8F5EC' }}>
                    <a.icon size={13} style={{ color: '#1A6B35' }}/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs leading-snug" style={{ color: '#374151' }}>{a.message}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{a.time}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-5" style={BOX}>
          <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: '#0D3B1F' }}>
            <Download size={14}/> Rapports imprimables
          </h3>
          <div className="space-y-2">
            {[
              { label:'Rapport mensuel', sub:'Entrées, clients, solde', key:'mensuel', fn:generateRapportMensuel },
              { label:'Rapport annuel', sub:'Bilan, top clients, taux', key:'annuel', fn:generateRapportAnnuel },
              { label:'État des créances', sub:'Clients avec solde coloré', key:'creances', fn:generateEtatCreances },
            ].map(r=>(
              <button key={r.key} onClick={r.fn} disabled={generatingPDF===r.key}
                className="w-full flex items-center gap-3 p-3 rounded-xl transition-all hover:shadow disabled:opacity-50"
                style={{ background: '#FFFBEB', border: '1px solid #FEF3C7' }}>
                <div className="p-2 rounded-lg flex-shrink-0" style={{ background: '#FEF3C7' }}>
                  <FileText size={14} style={{ color: '#C8960C' }}/>
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold" style={{ color: '#92400E' }}>{r.label}</p>
                  <p className="text-xs" style={{ color: '#9CA3AF' }}>{r.sub}</p>
                </div>
                {generatingPDF===r.key && <RefreshCw size={14} className="animate-spin ml-auto flex-shrink-0" style={{ color:'#C8960C' }}/>}
              </button>
            ))}
          </div>
          <div className="mt-4 p-3 rounded-xl" style={{ background: '#F0FDF4', border: '1px solid #DCFCE7' }}>
            <p className="text-xs font-semibold mb-1" style={{ color: '#166534' }}>⚡ Mise à jour auto</p>
            <p className="text-xs" style={{ color: '#4B5563' }}>Toutes les 30 secondes + synchronisation Supabase Realtime</p>
          </div>
        </div>
      </div>

    </div>
  )
}

export default DashboardPage
