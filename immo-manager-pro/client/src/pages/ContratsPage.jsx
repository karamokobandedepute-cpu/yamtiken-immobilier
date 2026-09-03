import { useEffect, useState, useRef, useMemo } from 'react'
import { Plus, Search, Edit2, Trash2, FileText, CreditCard, Eye, X, CheckCircle, XCircle, User, Home, Calendar, Printer, Download, TableProperties, Users, ChevronDown, ChevronRight, Key } from 'lucide-react'
import { fetchLeases, deleteLease, updateLeaseStatut, fetchBuildings } from '../utils/api'
import api from '../utils/api'
import { formatDate, formatCurrency, formatPhone } from '../utils/formatters'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import jsPDF from 'jspdf'
import { addPdfHeader, addPdfFooter, addWatermark, addSectionTitle, addTable, addInfoCard, checkPageBreak, COLORS } from '../utils/pdfUtils'
import Pagination from '../components/Pagination'
import { exportToExcel } from '../utils/excelUtils'
import { logDocGeneration } from '../utils/pdfLogger'
import { useAuthStore } from '../stores/authStore'
import PrisePossessionModal from '../components/PrisePossessionModal'

const ContratsPage = () => {
  const navigate = useNavigate()
  const [leases, setLeases] = useState([])
  const [buildings, setBuildings] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatut, setFilterStatut] = useState('')
  const [showLeaseModal, setShowLeaseModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showPriseModal, setShowPriseModal] = useState(false)
  const [selectedLease, setSelectedLease] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 12
  const { user } = useAuthStore()
  const [refreshDetailTrigger, setRefreshDetailTrigger] = useState(0)
  const [groupByClient, setGroupByClient] = useState(false)
  const [collapsedClients, setCollapsedClients] = useState({})

  const toggleClient = (key) => setCollapsedClients(prev => ({ ...prev, [key]: !prev[key] }))

  const groupedLeases = useMemo(() => {
    const map = {}
    leases.forEach(lease => {
      const key = lease.clientId || lease.client?.id || 'unknown'
      if (!map[key]) map[key] = { client: lease.client, leases: [] }
      map[key].leases.push(lease)
    })
    return Object.values(map).sort((a, b) =>
      `${a.client?.nom || ''}`.localeCompare(`${b.client?.nom || ''}`)
    )
  }, [leases])

  useEffect(() => {
    setCurrentPage(1)
    loadLeases()
    loadBuildings()
  }, [searchTerm, filterStatut])

  // Rafraîchir quand on revient sur la page (après un paiement par exemple)
  useEffect(() => {
    const handleFocus = () => {
      loadLeases()
      setRefreshDetailTrigger(prev => prev + 1)
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [])

  const handleExportExcel = async () => {
    const headers = ['N° Bail', 'Client', 'Immeuble', 'Montant Initial', 'Caution', 'Date Début', 'Date Fin', 'Statut']
    const rows = leases.map(l => [
      l.numeroBail,
      l.client ? `${l.client.prenom} ${l.client.nom}` : '',
      l.building?.nom || '',
      l.montantInitial,
      l.caution || 0,
      l.dateDebut ? new Date(l.dateDebut).toLocaleDateString('fr-FR') : '',
      l.dateFin   ? new Date(l.dateFin).toLocaleDateString('fr-FR')   : '',
      l.statut
    ])
    const ok = await exportToExcel('CONTRATS', 'Contrats', headers, rows, 'LISTE DES CONTRATS')
    if (ok) logDocGeneration(user, 'EXCEL_GENERATED', `CONTRATS_${new Date().toISOString().slice(0,10)}.xlsx`, 'contrats')
  }

  const loadLeases = async () => {
    try {
      setLoading(true)
      const params = {}
      if (searchTerm) params.search = searchTerm
      if (filterStatut) params.statut = filterStatut
      
      const response = await fetchLeases(Object.keys(params).length > 0 ? params : undefined)
      setLeases(Array.isArray(response.data) ? response.data : (response.data?.data || []))
    } catch (error) {
      toast.error('Erreur lors du chargement des baux')
    } finally {
      setLoading(false)
    }
  }

  const loadBuildings = async () => {
    try {
      const response = await fetchBuildings()
      setBuildings(response.data.data || [])
    } catch (error) {
      console.error('Erreur chargement buildings:', error)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce bail ?')) return
    
    try {
      await deleteLease(id)
      toast.success('Bail supprimé avec succès')
      loadLeases()
    } catch (error) {
      toast.error('Erreur lors de la suppression')
    }
  }

  const handleStatutChange = async (id, statut) => {
    try {
      await updateLeaseStatut(id, statut)
      toast.success(`Bail ${statut.toLowerCase()} avec succès`)
      loadLeases()
    } catch (error) {
      toast.error('Erreur lors du changement de statut')
    }
  }

  const openLeaseModal = (lease = null) => {
    setSelectedLease(lease)
    setShowLeaseModal(true)
  }

  const openDetailModal = (lease) => {
    setSelectedLease(lease)
    setShowDetailModal(true)
  }

  const handleNouveauPaiement = (lease) => {
    // Naviguer vers la page paiements avec le bail pré-sélectionné
    navigate('/paiements', { state: { leaseId: lease.id, montantRestant: lease.calculs?.resteDu } })
  }

  /* ══════════════════════════════════════════════════════
     HELPERS TYPE DE BIEN — partagés par tous les PDF
  ══════════════════════════════════════════════════════ */
  const LEASE_TYPE_MAP = {
    STUDIO:'Studio', CHAMBRE_SALON:'Chambre Salon', CHAMBRE:'Chambre',
    MAGASIN:'Magasin', VILLA:'Villa', APPARTEMENT:'Appartement',
    BUREAU:'Bureau', DUPLEX:'Duplex', BOUTIQUE:'Boutique',
    ENTREPOT:'Entrepôt', PARKING:'Parking', HANGAR:'Hangar'
  }
  const LEASE_TYPE_COLORS = {
    'Studio':        { bg:[219,234,254], c:[29,78,216],   bar:[59,130,246]  },
    'Chambre Salon': { bg:[220,252,231], c:[22,101,52],   bar:[34,197,94]   },
    'Chambre':       { bg:[254,243,199], c:[146,64,14],   bar:[245,158,11]  },
    'Magasin':       { bg:[255,237,213], c:[154,52,18],   bar:[249,115,22]  },
    'Bureau':        { bg:[243,232,255], c:[107,33,168],  bar:[168,85,247]  },
    'Villa':         { bg:[254,226,226], c:[185,28,28],   bar:[239,68,68]   },
    'Duplex':        { bg:[240,253,244], c:[20,83,45],    bar:[22,163,74]   },
    'Boutique':      { bg:[255,241,242], c:[159,18,57],   bar:[244,63,94]   },
    'Appartement':   { bg:[240,249,255], c:[7,89,133],    bar:[14,165,233]  },
    'Entrepôt':      { bg:[248,250,252], c:[51,65,85],    bar:[100,116,139] },
    'Parking':       { bg:[243,244,246], c:[75,85,99],    bar:[107,114,128] },
    'Hangar':        { bg:[248,248,248], c:[64,64,64],    bar:[115,115,115] }
  }
  const DEFAULT_TYPE_COLOR = { bg:[243,244,246], c:[75,85,99], bar:[107,114,128] }

  const getLeaseType = (l) => {
    const raw = (l.unite?.type || l.unite?.typeUnite || l.typeUnite || '').toUpperCase()
    return LEASE_TYPE_MAP[raw] || (raw ? raw.charAt(0) + raw.slice(1).toLowerCase() : '—')
  }
  const getLeaseBatiment = (l) =>
    l.building?.nom || l.unite?.building?.nom || (l.buildingId ? `Immeuble #${l.buildingId}` : '—')
  const getLeasePorte = (l) =>
    l.unite?.numeroPorte || (l.uniteId ? `N°${l.uniteId}` : '—')

  // ============================================
  // GÉNÉRATION PDF FICHE CONTRAT
  // ============================================
  const generateContractPDF = (lease) => {
    try {
      const doc = new jsPDF('p', 'mm', 'a4')
      let y = 40

      const docW = doc.internal.pageSize.getWidth()
      const ML14 = 14
      addWatermark(doc)
      addPdfHeader(doc, 'FICHE CONTRAT', `N° ${lease.numeroBail} - ${formatDate(new Date())}`)

      // ── BANNIÈRE TYPE DE BIEN ─────────────────────────────
      const tName   = getLeaseType(lease)
      const tColors = LEASE_TYPE_COLORS[tName] || DEFAULT_TYPE_COLOR
      doc.setFillColor(...tColors.bar)
      doc.rect(ML14, y, 5, 18, 'F')
      doc.setFillColor(...tColors.bg)
      doc.roundedRect(ML14 + 5, y, docW - ML14 * 2 - 5, 18, 2, 2, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      doc.setTextColor(...tColors.c)
      doc.text(tName.toUpperCase(), ML14 + 11, y + 9)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(107, 114, 128)
      doc.text(getLeaseBatiment(lease), ML14 + 11, y + 15)
      doc.text(`Porte : ${getLeasePorte(lease)}`, docW - ML14 - 42, y + 15)
      y += 22

      // Section Informations générales
      y = addSectionTitle(doc, 'Informations générales', y)

      const infoData = [
        { label: 'Numéro de bail', value: lease.numeroBail },
        { label: 'Statut', value: lease.statut },
        { label: 'Date début', value: formatDate(lease.dateDebut) },
        { label: 'Date fin', value: lease.dateFin ? formatDate(lease.dateFin) : 'Non définie' }
      ]

      infoData.forEach((item, index) => {
        if (index % 2 === 0) {
          y = checkPageBreak(doc, y)
          addInfoCard(doc, item.label, item.value, 20, y, 80)
        } else {
          addInfoCard(doc, item.label, item.value, 110, y, 80)
          y += 18
        }
      })

      if (infoData.length % 2 === 1) y += 18

      // Section Client
      y += 5
      y = checkPageBreak(doc, y)
      y = addSectionTitle(doc, 'Informations client', y)

      const clientData = [
        ['Nom', `${lease.client?.prenom || ''} ${lease.client?.nom || ''}`],
        ['Téléphone', formatPhone(lease.client?.telephone)],
        ['Email', lease.client?.email || '-'],
        ['Numéro pièce', lease.client?.numeroPiece || '-']
      ]
      y = addTable(doc, ['Champ', 'Valeur'], clientData, y, [60, 120])

      // Section Financière
      y += 5
      y = checkPageBreak(doc, y)
      y = addSectionTitle(doc, 'Situation financière', y)

      const financeData = [
        ['Montant initial', formatCurrency(lease.montantInitial)],
        ['Total payé', formatCurrency(lease.calculs?.totalPaye || 0)],
        ['Reste dû', formatCurrency(lease.calculs?.resteDu || 0)],
        ['Progression', `${lease.calculs?.progression || 0}%`],
        ['Nombre de paiements', String(lease.calculs?.nbPaiements || 0)]
      ]
      y = addTable(doc, ['Description', 'Montant'], financeData, y, [80, 100])

      // Section Bien
      y += 5
      y = checkPageBreak(doc, y)
      y = addSectionTitle(doc, 'Bien loué', y)

      const bienData = [
        ['Type de bien',    getLeaseType(lease)],
        ['Immeuble',        getLeaseBatiment(lease)],
        ['N° Porte / Unité', getLeasePorte(lease)],
        ['Droits de terre', formatCurrency(lease.droitsTerre || 0)],
        ['Charges annexes', formatCurrency(lease.chargesAnnexes || 0)]
      ]
      y = addTable(doc, ['Élément', 'Détail'], bienData, y, [60, 120])

      // Historique des paiements
      if (lease.payments && lease.payments.length > 0) {
        y += 5
        y = checkPageBreak(doc, y)
        y = addSectionTitle(doc, `Historique des paiements (${lease.payments.length})`, y)

        const paymentsData = lease.payments.map(p => [
          p.numeroFacture,
          formatDate(p.datePaiement),
          formatCurrency(p.montantVerse),
          p.modePaiement
        ])
        y = addTable(doc, ['N° Facture', 'Date', 'Montant', 'Mode'], paymentsData, y, [45, 40, 40, 45])
      }

      addPdfFooter(doc)
      doc.save(`CONTRAT-${lease.numeroBail}.pdf`)
      logDocGeneration(user, 'PDF_GENERATED', `CONTRAT-${lease.numeroBail}.pdf`, 'contrats', { numeroBail: lease.numeroBail })
      toast.success('Fiche contrat PDF générée avec succès')
    } catch (error) {
      console.error('Erreur PDF:', error)
      toast.error('Erreur lors de la génération du PDF')
    }
  }

  // ============================================
  // EXPORT LISTE CONTRATS PDF
  // ============================================
  const exportContractsListPDF = () => {
    try {
      const doc = new jsPDF('p', 'mm', 'a4')
      let y = 40

      const statutLabel = filterStatut ? ` - Statut: ${filterStatut}` : ' - Tous les statuts'
      addWatermark(doc)
      addPdfHeader(doc, 'LISTE DES CONTRATS', `${leases.length} contrat(s)${statutLabel}`)

      if (leases.length === 0) {
        doc.setFontSize(12)
        doc.setTextColor('#9CA3AF')
        doc.text('Aucun contrat à afficher', doc.internal.pageSize.getWidth() / 2, y + 20, { align: 'center' })
      } else {
        // Résumé
        const actifs = leases.filter(l => l.statut === 'ACTIF').length
        const termines = leases.filter(l => l.statut === 'TERMINE').length
        const resilies = leases.filter(l => l.statut === 'RESILIE').length

        addInfoCard(doc, 'Actifs', actifs.toString(), 20, y, 50)
        addInfoCard(doc, 'Terminés', termines.toString(), 80, y, 50)
        addInfoCard(doc, 'Résiliés', resilies.toString(), 140, y, 50)
        y += 25

        // Tableau des contrats
        const data = leases.map(l => [
          l.numeroBail,
          `${l.client?.prenom || ''} ${l.client?.nom || ''}`,
          formatDate(l.dateDebut),
          formatCurrency(l.calculs?.resteDu || 0),
          l.statut
        ])

        y = addTable(doc, ['N° Bail', 'Client', 'Date début', 'Reste dû', 'Statut'], data, y, [35, 60, 35, 35, 25])
      }

      addPdfFooter(doc)
      doc.save(`LISTE-CONTRATS-${new Date().toISOString().slice(0, 10)}.pdf`)
      logDocGeneration(user, 'PDF_GENERATED', `LISTE-CONTRATS-${new Date().toISOString().slice(0,10)}.pdf`, 'contrats')
      toast.success('Liste des contrats exportée en PDF')
    } catch (error) {
      console.error('Erreur PDF:', error)
      toast.error('Erreur lors de l\'export PDF')
    }
  }

  const getStatutBadgeStyle = (statut) => {
    switch (statut) {
      case 'ACTIF':
        return { background: '#DCFCE7', color: '#166534' }
      case 'TERMINE':
        return { background: '#DBEAFE', color: '#1D4ED8' }
      case 'RESILIE':
        return { background: '#FEE2E2', color: '#DC2626' }
      default:
        return { background: '#F3F4F6', color: '#4B5563' }
    }
  }

  const getStatutLabel = (statut) => {
    const labels = { ACTIF: 'Actif', TERMINE: 'Terminé', RESILIE: 'Résilié' }
    return labels[statut] || statut
  }

  // ============================================
  // RELEVÉ CLIENT COMPACT (1-2 pages max)
  // ============================================
  const generateClientGroupPDF = async (client, clientLeases) => {
    const toastId = toast.loading('Préparation du relevé…')
    try {
      const detailed = await Promise.all(
        clientLeases.map(l => api.get(`/leases/${l.id}`).then(r => r.data).catch(() => l))
      )

      const doc   = new jsPDF('p', 'mm', 'a4')
      const W     = doc.internal.pageSize.getWidth()
      const ML    = 14
      let y       = 38

      const nomClient   = `${client?.prenom || ''} ${client?.nom || ''}`.trim()
      const totalMontant = detailed.reduce((s, l) => s + (l.montantInitial      || 0), 0)
      const totalPaye    = detailed.reduce((s, l) => s + (l.calculs?.totalPaye  || 0), 0)
      const totalReste   = detailed.reduce((s, l) => s + (l.calculs?.resteDu    || 0), 0)
      const totalPmts    = detailed.reduce((s, l) => s + (l.payments?.length    || 0), 0)

      addWatermark(doc)
      addPdfHeader(doc, 'RELEVÉ DE COMPTE CLIENT',
        `${nomClient}  ·  ${detailed.length} bail(s)  ·  ${totalPmts} paiement(s)`)

      /* ══ BLOC CLIENT ════════════════════════════════════ */
      doc.setFillColor(240, 253, 244)
      doc.roundedRect(ML, y, W - ML * 2, 20, 2, 2, 'F')
      doc.setFontSize(8)
      const col2 = W / 2 + 4
      const fields = [
        ['CLIENT :',   nomClient,               ML + 3,   y + 6],
        ['TÉL :',      client?.telephone || '—', ML + 3,   y + 14],
        ['EMAIL :',    client?.email     || '—', col2,     y + 6],
        ['N° PIÈCE :', client?.numeroPiece|| '—',col2,     y + 14]
      ]
      fields.forEach(([label, val, x, fy]) => {
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(13, 59, 31)
        doc.text(label, x, fy)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(55, 65, 81)
        doc.text(val, x + (label.length > 8 ? 22 : 16), fy)
      })
      y += 24

      /* ══ KPI BOXES ══════════════════════════════════════ */
      const bW = (W - ML * 2 - 6) / 3
      ;[
        { lbl: 'TOTAL CONTRATS',    val: formatCurrency(totalMontant), bg:[220,252,231], c:[22,101,52]  },
        { lbl: 'TOTAL PAYÉ',        val: formatCurrency(totalPaye),    bg:[219,234,254], c:[29,78,216]  },
        { lbl: 'RESTANT DÛ',        val: formatCurrency(totalReste),
          bg: totalReste > 0 ? [254,226,226] : [220,252,231],
          c:  totalReste > 0 ? [220,38,38]   : [22,101,52]  }
      ].forEach((b, i) => {
        const bx = ML + i * (bW + 3)
        doc.setFillColor(...b.bg)
        doc.roundedRect(bx, y, bW, 17, 2, 2, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7)
        doc.setTextColor(...b.c)
        doc.text(b.lbl, bx + bW / 2, y + 5.5, { align: 'center' })
        doc.setFontSize(10)
        doc.text(b.val, bx + bW / 2, y + 13, { align: 'center' })
      })
      y += 21

      /* ══ RÉSUMÉ TYPES DE BIENS (badges) ═════════════════ */
      const typeCount = {}
      detailed.forEach(l => {
        const t = getLeaseType(l)
        typeCount[t] = (typeCount[t] || 0) + 1
      })
      const typeEntries = Object.entries(typeCount).sort((a, b) => b[1] - a[1])

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.setTextColor(13, 59, 31)
      doc.text('BIENS LOUÉS :', ML, y + 7.5)
      let badgeX = ML + 30
      typeEntries.forEach(([typ, cnt]) => {
        const bc  = LEASE_TYPE_COLORS[typ] || DEFAULT_TYPE_COLOR
        const txt = `${cnt}×  ${typ}`
        const tw  = doc.getTextWidth(txt) + 9
        doc.setFillColor(...bc.bg)
        doc.roundedRect(badgeX, y, tw, 11, 2, 2, 'F')
        doc.setFillColor(...bc.bar)
        doc.rect(badgeX, y, 3, 11, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.setTextColor(...bc.c)
        doc.text(txt, badgeX + 5, y + 7.5)
        badgeX += tw + 3
      })
      y += 16

      /* ══ BLOCS BAUX COMPACTS — TYPE EN GRAS ══════════════ */
      y = addSectionTitle(doc, `DÉTAIL DES ${detailed.length} BAIL(S)`, y)

      const usableW = W - ML * 2
      for (const l of detailed) {
        y = checkPageBreak(doc, y)
        const typName = getLeaseType(l)
        const tClr    = LEASE_TYPE_COLORS[typName] || DEFAULT_TYPE_COLOR

        // Barre + fond coloré
        doc.setFillColor(...tClr.bar)
        doc.rect(ML, y, 3, 18, 'F')
        doc.setFillColor(...tClr.bg)
        doc.roundedRect(ML + 3, y, usableW - 3, 18, 1, 1, 'F')

        // TYPE — gras 9pt
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(...tClr.c)
        doc.text(typName.toUpperCase(), ML + 7, y + 7)
        const typeW = doc.getTextWidth(typName.toUpperCase())

        // N°Bail · Immeuble · Porte — inline après le type
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.setTextColor(107, 114, 128)
        doc.text(
          `   ${l.numeroBail || '—'}  ·  ${getLeaseBatiment(l)}  ·  Porte ${getLeasePorte(l)}`,
          ML + 7 + typeW, y + 7
        )

        // Statut — coin droit ligne 1
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7)
        doc.setTextColor(...tClr.c)
        const slbl = getStatutLabel(l.statut)
        doc.text(slbl, W - ML - doc.getTextWidth(slbl) - 3, y + 7)

        // Ligne financière (ligne 2)
        const fData = [
          { t: `Montant : ${formatCurrency(l.montantInitial)}`,       red: false },
          { t: `Payé : ${formatCurrency(l.calculs?.totalPaye || 0)}`, red: false },
          { t: `Reste : ${formatCurrency(l.calculs?.resteDu   || 0)}`,red: (l.calculs?.resteDu || 0) > 0 },
          { t: `${l.calculs?.progression || 0}%  ·  ${l.calculs?.nbPaiements || 0} pmt(s)`, red: false }
        ]
        const fW = (usableW - 10) / 4
        fData.forEach((fi, i) => {
          doc.setFont('helvetica', fi.red ? 'bold' : 'normal')
          doc.setFontSize(7)
          doc.setTextColor(...(fi.red ? [220, 38, 38] : [55, 65, 81]))
          doc.text(fi.t, ML + 7 + i * fW, y + 15)
        })

        y += 21
      }

      /* ══ TABLEAU PAIEMENTS FUSIONNÉ ═════════════════════ */
      const allPmts = detailed.flatMap(l =>
        (l.payments || []).map(p => ({ ...p, _bail: l.numeroBail }))
      )

      y += 5
      y = checkPageBreak(doc, y)
      y = addSectionTitle(doc,
        allPmts.length > 0
          ? `HISTORIQUE DES PAIEMENTS — ${allPmts.length} VERSEMENT(S)`
          : 'HISTORIQUE DES PAIEMENTS', y)

      if (allPmts.length > 0) {
        y = addTable(doc,
          ['N° Bail', 'N° Facture', 'Date', 'Montant versé', 'Mode', 'Agent'],
          allPmts.map(p => [
            p._bail || '—',
            p.numeroFacture  || '—',
            formatDate(p.datePaiement),
            formatCurrency(p.montantVerse),
            p.modePaiement   || '—',
            p.agent ? `${p.agent.prenom || ''} ${p.agent.nom || ''}`.trim() : '—'
          ]),
          y, [23, 32, 25, 30, 26, 40]
        )
      } else {
        doc.setFontSize(9)
        doc.setTextColor(156, 163, 175)
        doc.text('Aucun paiement enregistré pour ce client.', ML, y + 6)
        doc.setTextColor(0)
        y += 12
      }

      addPdfFooter(doc)
      const filename = `RELEVE-${nomClient.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0,10)}.pdf`
      doc.save(filename)
      logDocGeneration(user, 'PDF_GENERATED', filename, 'contrats',
        { client: nomClient, bails: detailed.length, paiements: totalPmts })
      toast.dismiss(toastId)
      toast.success(`✅ Relevé de ${nomClient} généré — ${detailed.length} baux · ${totalPmts} paiements`)
    } catch (err) {
      console.error('Erreur PDF relevé:', err)
      toast.dismiss(toastId)
      toast.error('Erreur lors de la génération du relevé')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#0D3B1F' }}>Gestion des Baux</h1>
          <p className="text-gray-500">Contrats de location et paiements échelonnés</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportContractsListPDF}
            className="flex items-center gap-2 px-4 py-2 font-medium rounded-lg transition-all"
            style={{ background: '#FEF3C7', color: '#92400E' }}
            title="Exporter la liste des contrats en PDF"
          >
            <Download size={18} />
            Export PDF
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
            onClick={() => openLeaseModal()}
            className="flex items-center gap-2 px-4 py-2 text-white font-medium rounded-lg transition-all"
            style={{ background: '#1A6B35' }}
          >
            <Plus size={18} />
            Nouveau bail
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
              placeholder="Rechercher par n° bail, nom client..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border-2 rounded-lg outline-none transition-all"
              style={{ borderColor: '#E8F5EC' }}
            />
          </div>
          <select
            value={filterStatut}
            onChange={(e) => setFilterStatut(e.target.value)}
            className="px-4 py-2 border-2 rounded-lg outline-none"
            style={{ borderColor: '#E8F5EC', minWidth: '160px' }}
          >
            <option value="">Tous les statuts</option>
            <option value="ACTIF">Actif</option>
            <option value="TERMINE">Terminé</option>
            <option value="RESILIE">Résilié</option>
          </select>
          <button
            onClick={() => setGroupByClient(g => !g)}
            className="flex items-center gap-2 px-4 py-2 font-medium rounded-lg transition-all border-2"
            style={groupByClient
              ? { background: '#0D3B1F', color: 'white', borderColor: '#0D3B1F' }
              : { background: 'white', color: '#0D3B1F', borderColor: '#0D3B1F' }}
            title="Regrouper les baux par client"
          >
            <Users size={16} />
            {groupByClient ? 'Vue liste' : 'Par client'}
          </button>
        </div>
      </div>

      {/* VUE GROUPÉE PAR CLIENT */}
      {groupByClient && !loading && (
        <div className="space-y-4">
          {groupedLeases.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 rounded-lg" style={{ background: 'white' }}>
              <Users size={40} style={{ color: '#9CA3AF' }} />
              <p className="mt-3" style={{ color: '#9CA3AF' }}>Aucun bail trouvé</p>
            </div>
          ) : groupedLeases.map(({ client: c, leases: cl }) => {
            const key = c?.id || 'unknown'
            const isOpen = collapsedClients[key] !== true
            const initials = `${c?.prenom?.[0] || ''}${c?.nom?.[0] || ''}` || '?'
            const tTotal = cl.reduce((s, l) => s + (l.montantInitial || 0), 0)
            const tPaye  = cl.reduce((s, l) => s + (l.calculs?.totalPaye || 0), 0)
            const tReste = cl.reduce((s, l) => s + (l.calculs?.resteDu || 0), 0)
            return (
              <div key={key} className="rounded-xl overflow-hidden" style={{ background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                {/* Header client */}
                <div className="flex items-center gap-4 px-5 py-4" style={{ background: 'linear-gradient(135deg,#F0FDF4,#DCFCE7)', borderBottom: isOpen ? '1px solid #E8F5EC' : 'none' }}>
                  <button onClick={() => toggleClient(key)} className="flex items-center gap-4 flex-1 text-left">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-white shrink-0"
                      style={{ background: 'linear-gradient(135deg,#0D3B1F,#1A6B35)' }}>
                      {initials}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-base" style={{ color: '#0D3B1F' }}>{c?.prenom} {c?.nom}</p>
                      <p className="text-xs" style={{ color: '#6B7280' }}>{c?.telephone || '—'}</p>
                    </div>
                    <div className="hidden md:flex items-center gap-6 text-xs">
                      <div className="text-center">
                        <p className="font-bold" style={{ color: '#0D3B1F' }}>{formatCurrency(tTotal)}</p>
                        <p style={{ color: '#9CA3AF' }}>Total</p>
                      </div>
                      <div className="text-center">
                        <p className="font-bold" style={{ color: '#10B981' }}>{formatCurrency(tPaye)}</p>
                        <p style={{ color: '#9CA3AF' }}>Payé</p>
                      </div>
                      <div className="text-center">
                        <p className="font-bold" style={{ color: tReste > 0 ? '#DC2626' : '#10B981' }}>{formatCurrency(tReste)}</p>
                        <p style={{ color: '#9CA3AF' }}>Reste dû</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-bold mx-3" style={{ background: '#DCFCE7', color: '#166534' }}>
                      {cl.length} bail{cl.length > 1 ? 's' : ''}
                    </span>
                    {isOpen ? <ChevronDown size={18} style={{ color: '#6B7280' }} /> : <ChevronRight size={18} style={{ color: '#6B7280' }} />}
                  </button>
                  {/* Bouton PDF groupé */}
                  <button
                    onClick={() => generateClientGroupPDF(c, cl)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold shrink-0"
                    style={{ background: '#C8960C', color: 'white' }}
                    title="Imprimer facture groupée de tous les baux de ce client"
                  >
                    <Printer size={14} />
                    Imprimer tout
                  </button>
                </div>
                {/* Baux du client */}
                {isOpen && (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead style={{ background: '#F9FAFB' }}>
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-semibold" style={{ color: '#6B7280' }}>N° Bail</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold" style={{ color: '#6B7280' }}>Dates</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold" style={{ color: '#6B7280' }}>Progression</th>
                          <th className="px-4 py-2 text-right text-xs font-semibold" style={{ color: '#6B7280' }}>Total</th>
                          <th className="px-4 py-2 text-right text-xs font-semibold" style={{ color: '#6B7280' }}>Reste dû</th>
                          <th className="px-4 py-2 text-center text-xs font-semibold" style={{ color: '#6B7280' }}>Statut</th>
                          <th className="px-4 py-2 text-center text-xs font-semibold" style={{ color: '#6B7280' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y" style={{ borderColor: '#E8F5EC' }}>
                        {cl.map(lease => (
                          <tr key={lease.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3">
                              <p className="font-bold text-sm" style={{ color: '#0D3B1F' }}>{lease.numeroBail}</p>
                              <p className="text-xs" style={{ color: '#9CA3AF' }}>{formatCurrency(lease.montantInitial)}</p>
                            </td>
                            <td className="px-4 py-3 text-xs" style={{ color: '#6B7280' }}>
                              {formatDate(lease.dateDebut)}{lease.dateFin ? ` → ${formatDate(lease.dateFin)}` : ''}
                            </td>
                            <td className="px-4 py-3">
                              <div className="w-28">
                                <div className="flex justify-between text-xs mb-1">
                                  <span style={{ color: '#6B7280' }}>{lease.calculs?.progression || 0}%</span>
                                </div>
                                <div className="h-1.5 rounded-full" style={{ background: '#E8F5EC' }}>
                                  <div className="h-full rounded-full" style={{ width: `${Math.min(parseFloat(lease.calculs?.progression || 0), 100)}%`, background: '#1A6B35' }} />
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right text-sm font-semibold" style={{ color: '#374151' }}>{formatCurrency(lease.montantInitial)}</td>
                            <td className="px-4 py-3 text-right text-sm font-bold" style={{ color: (lease.calculs?.resteDu || 0) > 0 ? '#DC2626' : '#10B981' }}>{formatCurrency(lease.calculs?.resteDu || 0)}</td>
                            <td className="px-4 py-3 text-center">
                              <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={getStatutBadgeStyle(lease.statut)}>{getStatutLabel(lease.statut)}</span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-1">
                                {!lease.dateEntree && (
                                  <button onClick={() => { setSelectedLease(lease); setShowPriseModal(true); }} className="p-1.5 rounded flex items-center justify-center relative group" style={{ background: '#10B981', color: 'white' }} title="Remise des clés">
                                    <Key size={13} />
                                    <span className="absolute -top-1 -right-1 flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span></span>
                                  </button>
                                )}
                                <button onClick={() => openDetailModal(lease)} className="p-1.5 rounded" style={{ background: '#DBEAFE', color: '#1D4ED8' }} title="Détails"><Eye size={13} /></button>
                                <button onClick={() => generateContractPDF(lease)} className="p-1.5 rounded" style={{ background: '#FEF3C7', color: '#92400E' }} title="PDF individuel"><Printer size={13} /></button>
                                <button onClick={() => handleNouveauPaiement(lease)} className="p-1.5 rounded" style={{ background: '#DCFCE7', color: '#166534' }} title="Paiement"><CreditCard size={13} /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Tableau des Baux */}
      <div className="rounded-lg overflow-hidden" style={{ background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: groupByClient ? 'none' : 'block' }}>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-transparent" style={{ borderColor: '#1A6B35' }} />
          </div>
        ) : leases.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64" style={{ color: '#9CA3AF' }}>
            <FileText size={48} className="mb-4" />
            <p>Aucun bail trouvé</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead style={{ background: '#F9FAFB' }}>
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold" style={{ color: '#374151' }}>N° Bail</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold" style={{ color: '#374151' }}>Client</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold" style={{ color: '#374151' }}>Dates</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold" style={{ color: '#374151' }}>Progression</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold" style={{ color: '#374151' }}>Reste dû</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold" style={{ color: '#374151' }}>Statut</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold" style={{ color: '#374151' }}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: '#E8F5EC' }}>
                {leases.slice((currentPage-1)*PAGE_SIZE, currentPage*PAGE_SIZE).map((lease) => (
                  <tr key={lease.id} className="hover:bg-gray-50 transition-colors">
                    {/* N° Bail */}
                    <td className="px-6 py-4">
                      <p className="font-bold" style={{ color: '#0D3B1F' }}>{lease.numeroBail}</p>
                      <p className="text-xs" style={{ color: '#6B7280' }}>
                        {formatCurrency(lease.montantInitial)} total
                      </p>
                    </td>
                    
                    {/* Client */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <User size={16} style={{ color: '#1A6B35' }} />
                        <span className="font-medium" style={{ color: '#374151' }}>
                          {lease.client?.prenom} {lease.client?.nom}
                        </span>
                      </div>
                      <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
                        {formatPhone(lease.client?.telephone)}
                      </p>
                    </td>
                    
                    {/* Dates */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm" style={{ color: '#374151' }}>
                        <Calendar size={14} style={{ color: '#6B7280' }} />
                        <span>Du {formatDate(lease.dateDebut)}</span>
                      </div>
                      {lease.dateFin && (
                        <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
                          au {formatDate(lease.dateFin)}
                        </p>
                      )}
                    </td>
                    
                    {/* Progression */}
                    <td className="px-6 py-4">
                      <div className="w-32">
                        <div className="flex justify-between text-xs mb-1">
                          <span style={{ color: '#6B7280' }}>{lease.calculs?.progression || 0}%</span>
                          <span style={{ color: '#374151' }}>{lease.calculs?.nbPaiements || 0} paiements</span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: '#E8F5EC' }}>
                          <div 
                            className="h-full rounded-full transition-all"
                            style={{ 
                              width: `${Math.min(parseFloat(lease.calculs?.progression || 0), 100)}%`,
                              background: lease.calculs?.progression >= 100 ? '#10B981' : '#1A6B35'
                            }}
                          />
                        </div>
                        <p className="text-xs mt-1" style={{ color: '#1A6B35' }}>
                          {formatCurrency(lease.calculs?.totalPaye || 0)} payés
                        </p>
                      </div>
                    </td>
                    
                    {/* Reste dû */}
                    <td className="px-6 py-4">
                      <p className="font-bold" style={{ 
                        color: lease.calculs?.resteDu > 0 ? '#DC2626' : '#10B981'
                      }}>
                        {formatCurrency(lease.calculs?.resteDu || 0)}
                      </p>
                    </td>
                    
                    {/* Statut */}
                    <td className="px-6 py-4">
                      <select
                        value={lease.statut}
                        onChange={(e) => handleStatutChange(lease.id, e.target.value)}
                        className="px-3 py-1 rounded-full text-xs font-medium border-0 cursor-pointer"
                        style={getStatutBadgeStyle(lease.statut)}
                      >
                        <option value="ACTIF">Actif</option>
                        <option value="TERMINE">Terminé</option>
                        <option value="RESILIE">Résilié</option>
                      </select>
                    </td>
                    
                    {/* Actions */}
                    <td className="px-2 py-3" style={{ whiteSpace: 'nowrap' }}>
                      <div className="flex items-center justify-center gap-1">
                        {/* Remise des clés */}
                        {!lease.dateEntree && (
                          <button
                            onClick={() => { setSelectedLease(lease); setShowPriseModal(true); }}
                            className="p-1.5 rounded flex items-center justify-center relative group"
                            style={{ background: '#10B981', color: 'white' }}
                            title="Valider la prise de possession"
                          >
                            <Key size={14} />
                            <span className="absolute -top-1 -right-1 flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                            </span>
                          </button>
                        )}
                        {/* Nouveau paiement */}
                        <button
                          onClick={() => handleNouveauPaiement(lease)}
                          className="p-1.5 rounded transition-colors hover:opacity-80"
                          style={{ background: '#DCFCE7', color: '#166534' }}
                          title="Nouveau paiement"
                        >
                          <CreditCard size={14} />
                        </button>

                        {/* Voir détails */}
                        <button
                          onClick={() => openDetailModal(lease)}
                          className="p-1.5 rounded transition-colors hover:opacity-80"
                          style={{ background: '#DBEAFE', color: '#1D4ED8' }}
                          title="Voir détails"
                        >
                          <Eye size={14} />
                        </button>

                        {/* Imprimer PDF */}
                        <button
                          onClick={() => generateContractPDF(lease)}
                          className="p-1.5 rounded transition-colors hover:opacity-80"
                          style={{ background: '#FEF3C7', color: '#92400E' }}
                          title="Imprimer fiche contrat PDF"
                        >
                          <Printer size={14} />
                        </button>

                        {/* Modifier */}
                        <button
                          onClick={() => openLeaseModal(lease)}
                          className="p-1.5 rounded transition-colors hover:opacity-80"
                          style={{ background: '#F3F4F6', color: '#4B5563' }}
                          title="Modifier le bail"
                        >
                          <Edit2 size={14} />
                        </button>

                        {/* Supprimer */}
                        <button
                          onClick={() => handleDelete(lease.id)}
                          className="p-1.5 rounded transition-colors hover:opacity-80"
                          style={{ background: '#FEE2E2', color: '#DC2626' }}
                          title="Supprimer le bail"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          currentPage={currentPage}
          totalPages={Math.ceil(leases.length / PAGE_SIZE)}
          onPageChange={setCurrentPage}
          totalItems={leases.length}
          pageSize={PAGE_SIZE}
        />
      </div>

      {/* Modal - Création/Édition Bail */}
      {showLeaseModal && (
        <LeaseFormModal
          lease={selectedLease}
          buildings={buildings}
          onClose={() => {
            setShowLeaseModal(false)
            setSelectedLease(null)
          }}
          onSuccess={() => {
            setShowLeaseModal(false)
            setSelectedLease(null)
            loadLeases()
          }}
        />
      )}

      {/* Modal - Prise de Possession (Remise des Clés) */}
      {showPriseModal && selectedLease && (
        <PrisePossessionModal
          lease={selectedLease}
          onClose={() => {
            setShowPriseModal(false)
            setSelectedLease(null)
          }}
          onSuccess={() => {
            setShowPriseModal(false)
            setSelectedLease(null)
            loadLeases()
          }}
        />
      )}

      {/* Modal - Détail Bail */}
      {showDetailModal && selectedLease && (
        <LeaseDetailModal 
          lease={selectedLease}
          onClose={() => setShowDetailModal(false)}
          onNouveauPaiement={() => handleNouveauPaiement(selectedLease)}
          onPrintPDF={() => generateContractPDF(selectedLease)}
          refreshTrigger={refreshDetailTrigger}
        />
      )}
    </div>
  )
}

// ============================================
// MODAL - DÉTAIL BAIL
// ============================================
const LeaseDetailModal = ({ lease, onClose, onNouveauPaiement, onPrintPDF, refreshTrigger }) => {
  const [leaseData, setLeaseData] = useState(lease)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (refreshTrigger > 0) loadLeaseDetails()
  }, [refreshTrigger])

  const loadLeaseDetails = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/leases/${lease.id}`)
      setLeaseData(response.data)
    } catch (error) {
      console.error('Erreur chargement bail:', error)
    } finally {
      setLoading(false)
    }
  }

  const progression = leaseData.calculs?.progression || 0
  const totalPaye = leaseData.calculs?.totalPaye || 0
  const resteDu = leaseData.calculs?.resteDu || 0

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl">
        {/* Header */}
        <div className="p-6 border-b" style={{ borderColor: '#E8F5EC' }}>
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold" style={{ color: '#0D3B1F' }}>Détail du Bail</h2>
              <p className="text-2xl font-bold mt-1" style={{ color: '#C8960C' }}>{leaseData.numeroBail}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={onNouveauPaiement}
                className="flex items-center gap-2 px-4 py-2 text-white font-medium rounded-lg"
                style={{ background: '#1A6B35' }}
              >
                <CreditCard size={16} />
                Nouveau paiement
              </button>
              <button
                onClick={onPrintPDF}
                className="flex items-center gap-2 px-4 py-2 text-white font-medium rounded-lg"
                style={{ background: '#C8960C' }}
              >
                <Printer size={16} />
                Imprimer PDF
              </button>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full" title="Fermer">
                <X size={24} style={{ color: '#6B7280' }} />
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Section Financière */}
          <div className="mb-6 p-6 rounded-xl" style={{ background: '#F9FAFB' }}>
            <h3 className="font-semibold mb-4" style={{ color: '#0D3B1F' }}>Situation financière</h3>
            
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div className="text-center p-3 rounded-lg" style={{ background: 'white' }}>
                <p className="text-lg font-bold" style={{ color: '#0D3B1F' }}>{formatCurrency(leaseData.montantInitial)}</p>
                <p className="text-xs" style={{ color: '#6B7280' }}>Montant initial</p>
              </div>
              <div className="text-center p-3 rounded-lg" style={{ background: 'white' }}>
                <p className="text-lg font-bold" style={{ color: '#10B981' }}>{formatCurrency(totalPaye)}</p>
                <p className="text-xs" style={{ color: '#6B7280' }}>Total payé</p>
              </div>
              <div className="text-center p-3 rounded-lg" style={{ background: 'white' }}>
                <p className="text-lg font-bold" style={{ color: resteDu > 0 ? '#DC2626' : '#10B981' }}>{formatCurrency(resteDu)}</p>
                <p className="text-xs" style={{ color: '#6B7280' }}>Reste dû</p>
              </div>
              <div className="text-center p-3 rounded-lg" style={{ background: 'white' }}>
                <p className="text-lg font-bold" style={{ color: '#C8960C' }}>{progression}%</p>
                <p className="text-xs" style={{ color: '#6B7280' }}>Progression</p>
              </div>
            </div>
            
            {/* Barre de progression */}
            <div className="h-4 rounded-full overflow-hidden" style={{ background: '#E8F5EC' }}>
              <div 
                className="h-full rounded-full transition-all"
                style={{ 
                  width: `${Math.min(parseFloat(progression), 100)}%`,
                  background: progression >= 100 ? '#10B981' : '#1A6B35'
                }}
              />
            </div>
          </div>

          {/* Informations */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2" style={{ color: '#0D3B1F' }}>
                <User size={18} />
                Client
              </h4>
              <p style={{ color: '#374151' }}><strong>{lease.client?.prenom} {lease.client?.nom}</strong></p>
              <p style={{ color: '#6B7280' }}>{formatPhone(lease.client?.telephone)}</p>
            </div>
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2" style={{ color: '#0D3B1F' }}>
                <Home size={18} />
                Bien loué
              </h4>
              <p style={{ color: '#374151' }}>Unité #{lease.uniteId}</p>
              <p style={{ color: '#6B7280' }}>Immeuble #{lease.buildingId}</p>
            </div>
          </div>

          {/* Historique des paiements */}
          <div>
            <h4 className="font-semibold mb-3" style={{ color: '#0D3B1F' }}>Historique des paiements ({leaseData.payments?.length || 0})</h4>
            
            {leaseData.payments && leaseData.payments.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border" style={{ borderColor: '#E8F5EC' }}>
                <table className="w-full">
                  <thead style={{ background: '#F9FAFB' }}>
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-medium" style={{ color: '#6B7280' }}>N° Facture</th>
                      <th className="px-4 py-2 text-left text-sm font-medium" style={{ color: '#6B7280' }}>Date</th>
                      <th className="px-4 py-2 text-left text-sm font-medium" style={{ color: '#6B7280' }}>Montant</th>
                      <th className="px-4 py-2 text-left text-sm font-medium" style={{ color: '#6B7280' }}>Mode</th>
                      <th className="px-4 py-2 text-left text-sm font-medium" style={{ color: '#6B7280' }}>Agent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: '#E8F5EC' }}>
                    {leaseData.payments.map((payment) => (
                      <tr key={payment.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm font-medium" style={{ color: '#C8960C' }}>{payment.numeroFacture}</td>
                        <td className="px-4 py-2 text-sm" style={{ color: '#374151' }}>{formatDate(payment.datePaiement)}</td>
                        <td className="px-4 py-2 text-sm font-semibold" style={{ color: '#10B981' }}>+{formatCurrency(payment.montantVerse)}</td>
                        <td className="px-4 py-2 text-sm" style={{ color: '#6B7280' }}>{payment.modePaiement}</td>
                        <td className="px-4 py-2 text-sm" style={{ color: '#6B7280' }}>{payment.agent?.prenom} {payment.agent?.nom}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center py-4" style={{ color: '#9CA3AF' }}>Aucun paiement enregistré</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// MODAL - FORMULAIRE BAIL (CRÉATION/ÉDITION)
// ============================================
const LeaseFormModal = ({ lease, buildings, onClose, onSuccess }) => {
  const isEditing = !!lease
  const [clients, setClients] = useState([])
  const [unites, setUnites] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingClients, setLoadingClients] = useState(true)
  const [loadingUnites, setLoadingUnites] = useState(false)
  const [clientSearch, setClientSearch] = useState('')
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const clientInputRef = useRef(null)
  
  const [formData, setFormData] = useState({
    clientId: '',
    buildingId: '',
    uniteId: '',
    dateDebut: new Date().toISOString().split('T')[0],
    dateFin: '',
    montantInitial: '',
    montantLoyer: '',
    caution: '',
    statut: 'ACTIF',
    notes: ''
  })

  // Charger les clients au montage
  useEffect(() => { loadClients() }, [])

  // Charger les unités quand l'immeuble change
  useEffect(() => {
    if (formData.buildingId) {
      loadUnites(formData.buildingId)
    } else {
      setUnites([])
    }
  }, [formData.buildingId])

  // Remplir le formulaire si édition
  useEffect(() => {
    if (lease) {
      setFormData({
        clientId: lease.clientId?.toString() || '',
        buildingId: lease.buildingId?.toString() || '',
        uniteId: lease.uniteId?.toString() || '',
        dateDebut: lease.dateDebut?.split('T')[0] || '',
        dateFin: lease.dateFin?.split('T')[0] || '',
        montantInitial: lease.montantInitial?.toString() || '',
        montantLoyer: lease.montantLoyer?.toString() || '',
        caution: lease.caution?.toString() || '',
        statut: lease.statut || 'ACTIF',
        notes: lease.notes || ''
      })
      // Pré-remplir la recherche client si on a les infos
      if (lease.client) {
        setClientSearch(`${lease.client.prenom} ${lease.client.nom} - ${lease.client.telephone}`)
      }
    } else {
      // Reset pour nouveau bail
      setClientSearch('')
    }
  }, [lease])

  const loadClients = async () => {
    try {
      setLoadingClients(true)
      const { data } = await api.get('/clients')
      console.log('Clients chargés:', data)
      // La réponse peut être { data: [...] } ou directement [...]
      const clientsList = Array.isArray(data) ? data : (data?.data || [])
      setClients(clientsList)
    } catch (error) {
      console.error('Erreur chargement clients:', error)
      toast.error('Impossible de charger les clients')
    } finally {
      setLoadingClients(false)
    }
  }

  const loadUnites = async (buildingId) => {
    try {
      setLoadingUnites(true)
      setFormData(prev => ({ ...prev, uniteId: '' }))
      const { data } = await api.get(`/buildings/${buildingId}/unites`)
      const list = data?.data || data || []
      setUnites(list)
    } catch (error) {
      console.error('Erreur chargement unités:', error)
      setUnites([])
    } finally {
      setLoadingUnites(false)
    }
  }

  // Filtrer les clients selon la recherche
  const filteredClients = clients.filter(client => {
    if (!clientSearch) return true
    const search = clientSearch.toLowerCase()
    return (
      client.prenom?.toLowerCase().includes(search) ||
      client.nom?.toLowerCase().includes(search) ||
      client.telephone?.includes(search)
    )
  })

  // Sélectionner un client
  const selectClient = (client) => {
    setFormData({ ...formData, clientId: client.id.toString() })
    setClientSearch(`${client.prenom} ${client.nom} - ${client.telephone}`)
    setShowClientDropdown(false)
  }

  // Client sélectionné (pour affichage)
  const selectedClient = clients.find(c => c.id.toString() === formData.clientId)

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.clientId || !formData.montantInitial) {
      toast.error('Client et montant initial sont requis')
      return
    }

    try {
      setLoading(true)
      const data = {
        ...formData,
        clientId: parseInt(formData.clientId),
        buildingId: formData.buildingId ? parseInt(formData.buildingId) : null,
        uniteId: formData.uniteId ? parseInt(formData.uniteId) : null,
        montantInitial: parseFloat(formData.montantInitial),
        montantLoyer: parseFloat(formData.montantLoyer) || 0,
        caution: parseFloat(formData.caution) || 0
      }

      if (isEditing) {
        await api.put(`/leases/${lease.id}`, data)
        toast.success('Bail modifié avec succès')
      } else {
        await api.post('/leases', data)
        toast.success('Bail créé avec succès')
      }
      onSuccess()
    } catch (error) {
      console.error('Erreur:', error)
      toast.error(error.response?.data?.message || 'Erreur lors de la sauvegarde')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl shadow-xl">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#E8F5EC', background: '#F9FAFB' }}>
          <h2 className="text-lg font-bold" style={{ color: '#0D3B1F' }}>
            {isEditing ? 'Modifier le bail' : 'Nouveau bail'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X size={20} style={{ color: '#6B7280' }} />
          </button>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Client avec recherche */}
          <div className="relative">
            <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>Client *</label>
            {loadingClients ? (
              <div className="flex items-center gap-2 text-gray-500 py-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-t-transparent" style={{ borderColor: '#1A6B35' }} />
                <span className="text-sm">Chargement...</span>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={18} style={{ color: '#6B7280' }} />
                  <input
                    ref={clientInputRef}
                    type="text"
                    value={clientSearch}
                    onChange={(e) => {
                      setClientSearch(e.target.value)
                      setShowClientDropdown(true)
                      if (!e.target.value) {
                        setFormData({ ...formData, clientId: '' })
                      }
                    }}
                    onFocus={() => setShowClientDropdown(true)}
                    placeholder="Tapez le nom du client..."
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2"
                    style={{ borderColor: '#E8F5EC' }}
                  />
                  {selectedClient && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-1 rounded text-xs" style={{ background: '#DCFCE7', color: '#166534' }}>
                      <CheckCircle size={12} />
                      Sélectionné
                    </div>
                  )}
                </div>
                
                {/* Dropdown des résultats */}
                {showClientDropdown && (
                  <>
                    <div 
                      className="fixed inset-0 z-40"
                      onClick={() => setShowClientDropdown(false)}
                    />
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto z-50" style={{ borderColor: '#E8F5EC' }}>
                      {filteredClients.length === 0 ? (
                        <div className="p-4 text-center text-sm" style={{ color: '#6B7280' }}>
                          {clientSearch ? 'Aucun client trouvé' : 'Commencez à taper pour chercher'}
                        </div>
                      ) : (
                        filteredClients.slice(0, 10).map((client) => (
                          <button
                            key={client.id}
                            type="button"
                            onClick={() => selectClient(client)}
                            className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b last:border-b-0 flex items-center gap-3"
                            style={{ borderColor: '#F3F4F6' }}
                          >
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium" style={{ background: '#1A6B35' }}>
                              {client.prenom?.[0]}{client.nom?.[0]}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium" style={{ color: '#374151' }}>
                                {client.prenom} {client.nom}
                              </p>
                              <p className="text-sm" style={{ color: '#6B7280' }}>
                                📞 {client.telephone}
                              </p>
                            </div>
                            {formData.clientId === client.id.toString() && (
                              <CheckCircle size={18} style={{ color: '#1A6B35' }} />
                            )}
                          </button>
                        ))
                      )}
                      {filteredClients.length > 10 && (
                        <div className="px-4 py-2 text-center text-xs" style={{ color: '#6B7280', background: '#F9FAFB' }}>
                          Et {filteredClients.length - 10} autres clients...
                        </div>
                      )}
                    </div>
                  </>
                )}
                
                {/* Message si aucun client sélectionné */}
                {!formData.clientId && !showClientDropdown && (
                  <p className="mt-1 text-sm" style={{ color: '#DC2626' }}>
                    Veuillez sélectionner un client
                  </p>
                )}
              </>
            )}
          </div>

          {/* Bâtiment et Unité */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>Immeuble</label>
              <select
                value={formData.buildingId}
                onChange={(e) => setFormData({ ...formData, buildingId: e.target.value, uniteId: '' })}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2"
                style={{ borderColor: '#E8F5EC' }}
              >
                <option value="">Sélectionnez</option>
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>{b.nom}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>
                Unité {loadingUnites && <span className="text-xs text-gray-400">(chargement...)</span>}
              </label>
              <select
                value={formData.uniteId}
                onChange={(e) => setFormData({ ...formData, uniteId: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2"
                style={{ borderColor: '#E8F5EC' }}
                disabled={!formData.buildingId || loadingUnites}
              >
                <option value="">{formData.buildingId ? 'Sélectionnez une unité' : 'Choisir immeuble d\'abord'}</option>
                {unites.map((u) => (
                  <option key={u.id} value={u.id}>
                    #{u.numeroPorte} — {u.typeUnite} ({u.statut === 'VACANT' ? '✅ Libre' : u.statut === 'OCCUPE' ? '🔴 Occupé' : '🟡 Réservé'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>Date de signature *</label>
              <input
                type="date"
                value={formData.dateDebut}
                onChange={(e) => setFormData({ ...formData, dateDebut: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2"
                style={{ borderColor: '#E8F5EC' }}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>Date de fin</label>
              <input
                type="date"
                value={formData.dateFin}
                disabled
                className="w-full px-4 py-2 border rounded-lg bg-gray-50 text-gray-400 cursor-not-allowed"
                style={{ borderColor: '#E8F5EC' }}
              />
              <p className="text-[10px] text-amber-600 mt-1 leading-tight">
                Sera calculée automatiquement lors de la <br/><b>Remise des clés</b>.
              </p>
            </div>
          </div>

          {/* Montants */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>Montant initial *</label>
              <input
                type="number"
                value={formData.montantInitial}
                onChange={(e) => setFormData({ ...formData, montantInitial: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2"
                style={{ borderColor: '#E8F5EC' }}
                placeholder="0"
                required
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>Loyer mensuel</label>
              <input
                type="number"
                value={formData.montantLoyer}
                onChange={(e) => setFormData({ ...formData, montantLoyer: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2"
                style={{ borderColor: '#E8F5EC' }}
                placeholder="0"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>Caution</label>
              <input
                type="number"
                value={formData.caution}
                onChange={(e) => setFormData({ ...formData, caution: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2"
                style={{ borderColor: '#E8F5EC' }}
                placeholder="0"
                min="0"
              />
            </div>
          </div>

          {/* Statut */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>Statut</label>
            <select
              value={formData.statut}
              onChange={(e) => setFormData({ ...formData, statut: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2"
              style={{ borderColor: '#E8F5EC' }}
            >
              <option value="ACTIF">Actif</option>
              <option value="TERMINE">Terminé</option>
              <option value="RESILIE">Résilié</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2"
              style={{ borderColor: '#E8F5EC' }}
              placeholder="Informations complémentaires..."
            />
          </div>

          {/* Boutons */}
          <div className="flex justify-end gap-3 pt-4 border-t" style={{ borderColor: '#E8F5EC' }}>
            <button
              type="button"
              onClick={onClose}
              title="Fermer"
              className="px-4 py-2 rounded-lg font-medium transition-colors"
              style={{ background: '#F3F4F6', color: '#4B5563' }}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg font-medium text-white transition-colors flex items-center gap-2"
              style={{ background: '#1A6B35' }}
            >
              {loading && <div className="animate-spin rounded-full h-4 w-4 border-2 border-t-transparent border-white" />}
              {isEditing ? 'Modifier' : 'Créer le bail'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ContratsPage
