import { useEffect, useState, useRef, useCallback } from 'react'
import { Plus, Search, Edit2, Trash2, Eye, Users, X, Phone, Mail, MapPin, FileDown, User, Calendar, Flag, Briefcase, CreditCard, TableProperties, FileText, Building2, Info, ChevronDown, ChevronRight, Printer, TrendingUp } from 'lucide-react'
import { fetchClients, deleteClient, createClient, updateClient, generateClientPDF, fetchReferrers, fetchBuildings, fetchUnitesByBuilding, createUnite, invalidateCacheFor, fetchLeases } from '../utils/api'
import { formatPhone, formatCurrency, getClientTypeLabel, getClientTypeBadgeStyle, formatDate } from '../utils/formatters'
import { safeMap, safeFilter, safeFind, safeGet, extractApiData, getErrorMessage } from '../utils/safetyHelpers'
import toast from 'react-hot-toast'
import Pagination from '../components/Pagination'
import { exportToExcel } from '../utils/excelUtils'
import { logDocGeneration } from '../utils/pdfLogger'
import { useAuthStore } from '../stores/authStore'
import jsPDF from 'jspdf'
import { addPdfHeader, addPdfFooter, addWatermark, addSectionTitle, addInfoCard, addTable, checkPageBreak } from '../utils/pdfUtils'
import api from '../utils/api'

// Photos relatives /uploads : en prod avec API absolue, préfixer l’origine backend
const BACKEND_ORIGIN = (() => {
  const base = import.meta.env.VITE_API_URL || ''
  if (!base || base.startsWith('/')) return ''
  return base.replace(/\/api\/?$/, '')
})()

const getPhotoUrl = (photoUrl) => {
  if (!photoUrl) return null
  if (photoUrl.startsWith('http')) return photoUrl
  const normalized = photoUrl.replace(/\\/g, '/')
  const path = normalized.startsWith('/') ? normalized : `/${normalized}`
  if (BACKEND_ORIGIN && path.startsWith('/uploads')) {
    return `${BACKEND_ORIGIN}${path}`
  }
  return path
}

const ClientsPage = () => {
  const { user } = useAuthStore()
  const [clients, setClients] = useState([])
  const [referrers, setReferrers] = useState([])
  const [loading, setLoading] = useState(true) // true = spinner au chargement initial
  const [initialLoad, setInitialLoad] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const PAGE_SIZE = 15
  const [expandedClientId, setExpandedClientId] = useState(null)
  const [leasesCache, setLeasesCache] = useState({})
  const [leasesLoadingId, setLeasesLoadingId] = useState(null)

  const toggleClient = async (clientId) => {
    if (expandedClientId === clientId) {
      setExpandedClientId(null)
      return
    }
    setExpandedClientId(clientId)
    if (!leasesCache[clientId]) {
      setLeasesLoadingId(clientId)
      try {
        const res = await fetchLeases({ clientId, limit: 100 })
        const data = res.data?.data || res.data || []
        setLeasesCache(prev => ({ ...prev, [clientId]: Array.isArray(data) ? data : [] }))
      } catch {}
      finally { setLeasesLoadingId(null) }
    }
  }

  // Modals
  const [showClientModal, setShowClientModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedClient, setSelectedClient] = useState(null)

  // Chargement initial immédiat
  useEffect(() => {
    invalidateCacheFor('/clients')
    loadReferrers()
    loadClients() // Chargement immédiat au montage
  }, [])

  // Debounce searchTerm : attend 300ms après la dernière frappe
  const debounceRef = useRef(null)
  useEffect(() => {
    if (initialLoad) {
      setInitialLoad(false)
      return // Skip le premier render
    }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setCurrentPage(1)
      loadClients()
    }, searchTerm ? 300 : 0)   // Réduit à 300ms
    return () => clearTimeout(debounceRef.current)
  }, [searchTerm, filterType])

  const loadClients = useCallback(async () => {
    setLoading(true) // Activer spinner pendant chargement
    try {
      const params = {}
      if (currentPage > 1) {
        params.page = currentPage
        params.limit = 50 // or PAGE_SIZE, but if undefined we just don't pass it
      }
      if (searchTerm) params.search = searchTerm
      if (filterType) params.type = filterType
      
      const fetchParams = Object.keys(params).length > 0 ? params : undefined
      const response = await fetchClients(fetchParams)
      
      const sortClientsByBalanceDesc = (clientsArray) => {
        return [...clientsArray].sort((a, b) => {
          const soldeA = Number(a.balance?.solde) || 0;
          const soldeB = Number(b.balance?.solde) || 0;
          return soldeB - soldeA; // Descending: highest unpaid first, zero/soldé last
        });
      };
      
      if (response.data?.pagination) {
        setClients(sortClientsByBalanceDesc(response.data.data || []))
        setTotalPages(response.data.pagination.totalPages || 1)
      } else {
        setClients(sortClientsByBalanceDesc(response.data?.data || response.data || []))
        setTotalPages(1)
      }
      
      setLoading(false) // Marquer comme chargé
    } catch (error) {
      console.error('Erreur chargement clients:', error)
      toast.error('Erreur lors du chargement des clients')
      setLoading(false)
    }
  }, [searchTerm, filterType, currentPage])

  const loadReferrers = async () => {
    try {
      const response = await fetchReferrers()
      setReferrers(response.data?.data || response.data || [])
    } catch (error) {
      console.error('Erreur chargement témoins:', error)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce client ?')) return
    
    try {
      await deleteClient(id)
      toast.success('Client supprimé avec succès')
      loadClients()
    } catch (error) {
      toast.error('Erreur lors de la suppression')
    }
  }

  const handleExportPDF = async (clientData) => {
    const toastId = toast.loading('Génération PDF...');
    try {
      // 1. Récupérer les données client depuis l'API
      const response = await generateClientPDF(clientData.id);
      const client = response.data?.client || response.data;

      if (!client) {
        toast.error('Données client introuvables', { id: toastId });
        return;
      }

      // 2. Créer le document PDF
      const doc = new jsPDF('p', 'mm', 'a4');
      const pw = doc.internal.pageSize.getWidth();
      const ph = doc.internal.pageSize.getHeight();

      // 3. En-tête premium vert (inline — sans logo pour éviter les erreurs d'image)
      doc.setFillColor(13, 59, 31); // #0D3B1F
      doc.rect(0, 0, pw, 36, 'F');

      doc.setFillColor(200, 150, 12); // #C8960C gold bar
      doc.rect(0, 34, pw, 2, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('YAMTIKEN BEHEMOTH', pw / 2, 13, { align: 'center' });

      doc.setFontSize(11);
      doc.setTextColor(200, 150, 12);
      doc.text('FICHE CLIENT', pw / 2, 21, { align: 'center' });

      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'normal');
      const fullName = `${client.prenom || ''} ${client.nom || ''}`.trim();
      doc.text(fullName, pw / 2, 29, { align: 'center' });

      // Date d'impression
      const now = new Date();
      const printDate = now.toLocaleDateString('fr-FR') + ' à ' + now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      doc.setFontSize(7);
      doc.text(`Imprimé le ${printDate}`, pw - 10, 30, { align: 'right' });

      // 4. Corps du document
      let y = 46;

      // Helper titre de section
      const sectionTitle = (title) => {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(13, 59, 31);
        doc.text(title.toUpperCase(), 15, y);
        doc.setDrawColor(200, 150, 12);
        doc.setLineWidth(0.5);
        doc.line(15, y + 2, pw - 15, y + 2);
        y += 10;
      };

      // Helper ligne label/valeur
      const field = (label, value, xOffset = 0) => {
        const xLabel = 18 + xOffset;
        const xValue = 70 + xOffset;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(label + ' :', xLabel, y);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(13, 59, 31);
        doc.text(String(value || '-'), xValue, y);
        y += 8;
      };

      // Vérification saut de page
      const checkBreak = () => {
        if (y > ph - 50) { doc.addPage(); y = 20; }
      };

      // ── Section 1 : Informations personnelles ──
      sectionTitle('Informations Personnelles');
      field('Type', getClientTypeLabel(client.type));
      field('Nom', client.nom);
      field('Prénom', client.prenom);
      field('Nationalité', client.nationalite || 'Ivoirienne');
      field('Date de naissance', client.dateNaissance ? formatDate(client.dateNaissance) : '-');
      field('Profession', client.profession || '-');
      y += 4;
      checkBreak();

      // ── Section 2 : Contact ──
      sectionTitle('Contact');
      field('Téléphone', formatPhone(client.telephone));
      if (client.telephone2) field('Téléphone 2', formatPhone(client.telephone2));
      field('Email', client.email || '-');
      field('Adresse', client.adresse || '-');
      y += 4;
      checkBreak();

      // ── Section 3 : Pièce d'identité ──
      sectionTitle("Pièce d'Identité");
      field('Numéro', client.numeroPiece || '-');
      y += 4;
      checkBreak();

      // ── Section 4 : Apporteur ──
      if (client.temoin) {
        sectionTitle("Apporteur d'Affaires");
        field('Nom', `${client.temoin.prenom || ''} ${client.temoin.nom || ''}`.trim());
        field('Contact', client.temoin.contact || '-');
        y += 4;
      }

      // 5. Pied de page
      doc.setFillColor(13, 59, 31);
      doc.rect(0, ph - 20, pw, 20, 'F');
      doc.setTextColor(200, 150, 12);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text('UNE TRANSPARENCE TOTALE POUR VOTRE ACQUISITION', pw / 2, ph - 14, { align: 'center' });
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'normal');
      doc.text('+225 07 59 11 37 22  |  +225 07 22 56 87 91', pw / 2, ph - 9, { align: 'center' });
      doc.text(`Généré le ${printDate}`, pw / 2, ph - 4, { align: 'center' });

      // 6. Ouvrir le PDF
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      window.open(pdfUrl, '_blank');

      try { logDocGeneration(user, 'PDF_GENERATED', `fiche_${client.prenom}_${client.nom}.pdf`, 'clients', { clientId: client.id }); } catch (_) {}
      toast.success('Fiche PDF générée avec succès !', { id: toastId });

    } catch (error) {
      console.error('Erreur PDF:', error);
      toast.error(`Erreur PDF : ${error.message}`, { id: toastId });
    }
  }

  const openClientModal = (client = null) => {
    setSelectedClient(client)
    setShowClientModal(true)
  }

  const openDetailModal = (client) => {
    setSelectedClient(client)
    setShowDetailModal(true)
  }

  const handleExportExcel = async () => {
    const headers = ['Nom', 'Prénom', 'Type', 'Téléphone', 'Email', 'Adresse', 'Profession', 'Solde dû']
    const rows = safeMap(clients, c => [
      c.nom || 'N/A', 
      c.prenom || 'N/A',
      getClientTypeLabel(c.type),
      formatPhone(c.telephone),
      c.email || '',
      c.adresse || '',
      c.profession || '',
      c.balance?.solde || 0
    ])
    const ok = await exportToExcel('CLIENTS', 'Clients', headers, rows, 'LISTE DES CLIENTS')
    if (ok) logDocGeneration(user, 'EXCEL_GENERATED', `CLIENTS_${new Date().toISOString().slice(0,10)}.xlsx`, 'clients')
  }

  const closeModals = (shouldRefresh = false) => {
    setShowClientModal(false)
    setShowDetailModal(false)
    setSelectedClient(null)
    if (shouldRefresh) loadClients()
  }

  const paginatedClients = clients.length > PAGE_SIZE 
    ? clients.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE) 
    : clients

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#0D3B1F' }}>Clients & Souscripteurs</h1>
          <p className="text-gray-500">Gestion des clients et apporteurs</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 font-medium rounded-lg transition-all border-2"
            style={{ background: 'white', color: '#1A6B35', borderColor: '#1A6B35' }}
          >
            <TableProperties size={18} />
            Excel
          </button>
          <button
            onClick={() => openClientModal()}
            className="flex items-center gap-2 px-4 py-2 text-white font-medium rounded-lg transition-all"
            style={{ background: '#1A6B35' }}
          >
            <Plus size={18} />
            Nouveau client
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
              placeholder="Rechercher par nom, téléphone, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border-2 rounded-lg outline-none transition-all"
              style={{ borderColor: '#E8F5EC' }}
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 border-2 rounded-lg outline-none"
            style={{ borderColor: '#E8F5EC', minWidth: '160px' }}
          >
            <option value="">Tous les types</option>
            <option value="SOUSCRIPTEUR">Souscripteurs</option>
            <option value="CLIENT">Clients</option>
          </select>
        </div>
      </div>

      {/* ═══ LISTE ACCORDÉON CLIENTS ═══ */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-64 rounded-2xl" style={{ background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-transparent" style={{ borderColor: '#1A6B35' }} />
          </div>
        ) : clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 rounded-2xl" style={{ background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <Users size={48} className="mb-4" style={{ color: '#D1D5DB' }} />
            <p style={{ color: '#9CA3AF' }}>Aucun client trouvé</p>
            <button onClick={loadClients} className="mt-4 px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium">Rafraîchir</button>
          </div>
        ) : (
          safeMap(paginatedClients, (client) => {
            const badgeStyle = getClientTypeBadgeStyle(client?.type)
            const isOpen = expandedClientId === client.id
            const leases = leasesCache[client.id] || []
            const isLoadingLeases = leasesLoadingId === client.id
            const solde = client.balance?.solde || 0
            const nbBaux = Number(client.nbBaux || 0)
            const totalPaye = client.balance?.totalPaye || 0
            const montantInitial = client.balance?.montantInitial || 0
            const taux = montantInitial > 0 ? Math.min(100, Math.round((totalPaye / montantInitial) * 100)) : 0
            const initials = `${client.prenom?.[0] || ''}${client.nom?.[0] || ''}`
            return (
              <div key={client.id} className="rounded-2xl overflow-hidden transition-all duration-200"
                style={{ background: 'white', boxShadow: isOpen ? '0 4px 20px rgba(26,107,53,0.12)' : '0 1px 4px rgba(0,0,0,0.08)', border: isOpen ? '2px solid #C8E6D4' : '2px solid transparent' }}>

                {/* ── Ligne principal du client ── */}
                <div className="flex items-center gap-4 px-5 py-4">

                  {/* Avatar */}
                  <div className="w-13 h-13 shrink-0 rounded-full overflow-hidden flex items-center justify-center text-white font-bold text-sm"
                    style={{ width: 52, height: 52, background: client.photoUrl ? 'transparent' : 'linear-gradient(135deg,#0D3B1F,#1A6B35)', border: '2px solid #C8E6D4' }}>
                    {client.photoUrl
                      ? <img src={getPhotoUrl(client.photoUrl)} alt="" className="w-full h-full object-cover" />
                      : initials || <User size={22} />}
                  </div>

                  {/* Infos principales */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold truncate" style={{ color: '#0D3B1F', fontSize: 15 }}>{client.prenom} {client.nom}</span>
                      <span className="px-2 py-0.5 rounded text-xs font-semibold shrink-0"
                        style={{ background: badgeStyle.background, color: badgeStyle.color }}>
                        {getClientTypeLabel(client.type)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="flex items-center gap-1 text-xs" style={{ color: '#6B7280' }}>
                        <Phone size={11} />{formatPhone(client.telephone)}
                      </span>
                      {client.email && <span className="text-xs truncate" style={{ color: '#6B7280' }}>{client.email}</span>}
                    </div>
                  </div>

                  {/* Badge nb baux */}
                  <div className="shrink-0 text-center px-3">
                    <div className="text-2xl font-black" style={{ color: nbBaux > 0 ? '#1A6B35' : '#9CA3AF' }}>{nbBaux}</div>
                    <div className="text-xs" style={{ color: '#6B7280' }}>bail{nbBaux > 1 ? 's' : ''}</div>
                  </div>

                  {/* Solde dû */}
                  <div className="shrink-0 text-right px-3">
                    <div className="font-bold text-sm" style={{ color: solde > 0 ? '#DC2626' : '#10B981' }}>{formatCurrency(solde)}</div>
                    <div className="text-xs" style={{ color: '#6B7280' }}>solde dû</div>
                  </div>

                  {/* Actions */}
                  <div className="shrink-0 flex items-center gap-1.5">
                    <button onClick={() => openClientModal(client)} className="p-2 rounded-lg transition-colors" style={{ background: '#DCFCE7', color: '#166534' }} title="Modifier"><Edit2 size={15} /></button>
                    <button onClick={() => openDetailModal(client)} className="p-2 rounded-lg transition-colors" style={{ background: '#DBEAFE', color: '#1D4ED8' }} title="Fiche détail"><Eye size={15} /></button>
                    <button onClick={() => handleDelete(client.id)} className="p-2 rounded-lg transition-colors" style={{ background: '#FEE2E2', color: '#DC2626' }} title="Supprimer"><Trash2 size={15} /></button>
                    <button
                      onClick={() => toggleClient(client.id)}
                      className="p-2 rounded-lg transition-all font-medium flex items-center gap-1 text-xs"
                      style={{ background: isOpen ? '#0D3B1F' : '#F3F4F6', color: isOpen ? 'white' : '#374151', minWidth: 36 }}
                      title={isOpen ? 'Réduire' : 'Voir les baux'}
                    >
                      {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                  </div>
                </div>

                {/* ── Zone dépliée : baux du client ── */}
                {isOpen && (
                  <div className="border-t" style={{ borderColor: '#E8F5EC', background: '#F7FCF9' }}>
                    {/* Header zone baux */}
                    <div className="flex items-center justify-between px-5 py-3">
                      <div className="flex items-center gap-2">
                        <FileText size={16} style={{ color: '#1A6B35' }} />
                        <span className="font-semibold text-sm" style={{ color: '#0D3B1F' }}>Baux de {client.prenom} {client.nom}</span>
                        {leases.length > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: '#DCFCE7', color: '#166534' }}>{leases.length}</span>
                        )}
                      </div>
                      {leases.length > 0 && (
                        <button
                          onClick={() => {
                            const win = window.open('', '_blank')
                            const totalMontant = leases.reduce((s,l) => s + (l.montantInitial || 0), 0)
                            const totalPayé = leases.reduce((s,l) => s + (l.calculs?.totalPaye || 0), 0)
                            const totalReste = Math.max(0, totalMontant - totalPayé)
                            win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Baux — ${client.prenom} ${client.nom}</title><style>*{margin:0;padding:0;box-sizing:border-box;font-family:Arial,sans-serif}body{background:#fff;color:#1a1a1a;padding:32px}h1{font-size:20px;color:#0D3B1F;margin-bottom:4px}.sub{color:#6b7280;font-size:13px;margin-bottom:24px}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:28px}.card{background:#F0FDF4;border:1px solid #C8E6D4;border-radius:10px;padding:14px;text-align:center}.card .v{font-size:18px;font-weight:800;color:#0D3B1F}.card .l{font-size:11px;color:#6b7280;margin-top:2px}table{width:100%;border-collapse:collapse;font-size:13px}thead th{background:#0D3B1F;color:white;padding:10px 12px;text-align:left}tbody tr:nth-child(even){background:#F7FCF9}td{padding:9px 12px;border-bottom:1px solid #E8F5EC}.badge{padding:3px 8px;border-radius:20px;font-size:11px;font-weight:700}.actif{background:#DCFCE7;color:#166534}.expire{background:#FEF3C7;color:#92400E}.resilie{background:#FEE2E2;color:#DC2626}.prog-bar{height:6px;background:#E8F5EC;border-radius:4px;overflow:hidden}.prog-fill{height:100%;background:#1A6B35;border-radius:4px}.footer{margin-top:24px;text-align:center;font-size:11px;color:#9CA3AF;border-top:1px solid #E8F5EC;padding-top:14px}@media print{body{padding:20px}}</style></head><body><h1>📋 Récapitulatif des Baux</h1><p class="sub">${client.prenom} ${client.nom} &nbsp;|&nbsp; ${formatPhone(client.telephone)} &nbsp;|&nbsp; Imprimé le ${new Date().toLocaleDateString('fr-FR')}</p><div class="summary"><div class="card"><div class="v">${leases.length}</div><div class="l">Bail(s) total</div></div><div class="card"><div class="v" style="color:#10B981">${new Intl.NumberFormat('fr-FR').format(totalPayé)} FCFA</div><div class="l">Total payé</div></div><div class="card"><div class="v" style="color:${totalReste>0?'#DC2626':'#10B981'}">${new Intl.NumberFormat('fr-FR').format(totalReste)} FCFA</div><div class="l">Reste dû global</div></div></div><table><thead><tr><th>N° Bail</th><th>Statut</th><th>Montant initial</th><th>Payé</th><th>Reste dû</th><th>Progression</th><th>Période</th></tr></thead><tbody>${leases.map(l=>{const tp=l.calculs?.totalPaye||0;const rd=Math.max(0,(l.montantInitial||0)-tp);const pct=l.montantInitial>0?Math.min(100,Math.round((tp/l.montantInitial)*100)):0;const sc={ACTIF:'actif',EXPIRE:'expire',RESILIE:'resilie'}[l.statut]||'';return`<tr><td><strong>${l.numeroBail||'—'}</strong></td><td><span class="badge ${sc}">${l.statut||'—'}</span></td><td>${new Intl.NumberFormat('fr-FR').format(l.montantInitial||0)} FCFA</td><td style="color:#10B981;font-weight:700">${new Intl.NumberFormat('fr-FR').format(tp)} FCFA</td><td style="color:${rd>0?'#DC2626':'#10B981'};font-weight:700">${new Intl.NumberFormat('fr-FR').format(rd)} FCFA</td><td><div class="prog-bar"><div class="prog-fill" style="width:${pct}%"></div></div><small>${pct}%</small></td><td style="font-size:11px;color:#6b7280">${l.dateDebut?new Date(l.dateDebut).toLocaleDateString('fr-FR'):''} ${l.dateFin?'→ '+new Date(l.dateFin).toLocaleDateString('fr-FR'):''}</td></tr>`}).join('')}</tbody></table><div class="footer">YAMTIKEN IMMOBILIER — Document généré automatiquement — ${new Date().toLocaleString('fr-FR')}</div></body></html>`)
                            win.document.close()
                            win.focus()
                            setTimeout(() => win.print(), 400)
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors"
                          style={{ background: '#C8960C' }}
                        >
                          <Printer size={13} /> Imprimer tout
                        </button>
                      )}
                    </div>

                    {isLoadingLeases ? (
                      <div className="flex items-center gap-2 px-5 pb-5 text-sm" style={{ color: '#6B7280' }}>
                        <div className="w-4 h-4 border-2 border-[#1A6B35] border-t-transparent rounded-full animate-spin" />
                        Chargement des baux...
                      </div>
                    ) : leases.length === 0 ? (
                      <div className="px-5 pb-5 text-sm" style={{ color: '#9CA3AF' }}>Aucun bail enregistré</div>
                    ) : (
                      <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {leases.map((lease) => {
                          const tp = lease.calculs?.totalPaye || 0
                          const rd = Math.max(0, (lease.montantInitial || 0) - tp)
                          const pct = lease.montantInitial > 0 ? Math.min(100, Math.round((tp / lease.montantInitial) * 100)) : 0
                          const sc = { ACTIF: { bg: '#DCFCE7', c: '#166534' }, EN_COURS: { bg: '#DBEAFE', c: '#1D4ED8' }, EXPIRE: { bg: '#FEF3C7', c: '#92400E' }, RESILIE: { bg: '#FEE2E2', c: '#DC2626' } }[lease.statut] || { bg: '#F3F4F6', c: '#6B7280' }
                          return (
                            <div key={lease.id} className="rounded-xl overflow-hidden border" style={{ background: 'white', borderColor: '#E8F5EC' }}>
                              <div className="flex items-center justify-between px-4 py-2.5" style={{ background: 'linear-gradient(135deg,#F0FDF4,#E8F5EC)' }}>
                                <div className="flex items-center gap-2">
                                  <FileText size={13} style={{ color: '#1A6B35' }} />
                                  <span className="font-bold text-xs" style={{ color: '#0D3B1F' }}>{lease.numeroBail}</span>
                                </div>
                                <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: sc.bg, color: sc.c }}>{lease.statut}</span>
                              </div>
                              <div className="px-4 py-3">
                                <div className="grid grid-cols-3 gap-2 mb-2 text-center">
                                  <div><p className="text-xs" style={{ color: '#6B7280' }}>Initial</p><p className="text-xs font-bold" style={{ color: '#0D3B1F' }}>{formatCurrency(lease.montantInitial)}</p></div>
                                  <div><p className="text-xs" style={{ color: '#6B7280' }}>Payé</p><p className="text-xs font-bold" style={{ color: '#10B981' }}>{formatCurrency(tp)}</p></div>
                                  <div><p className="text-xs" style={{ color: '#6B7280' }}>Reste</p><p className="text-xs font-bold" style={{ color: rd > 0 ? '#DC2626' : '#10B981' }}>{formatCurrency(rd)}</p></div>
                                </div>
                                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#E8F5EC' }}>
                                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 100 ? '#10B981' : '#1A6B35' }} />
                                </div>
                                <p className="text-right text-xs mt-1" style={{ color: '#6B7280' }}>{pct}%</p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={clients.length}
          pageSize={PAGE_SIZE}
        />
      </div>

      {/* Modal - Formulaire Client */}
      {showClientModal && (
        <ClientModal 
          client={selectedClient}
          referrers={referrers}
          onClose={(saved) => closeModals(saved)}
          onSuccess={loadClients}
        />
      )}

      {/* Modal - Vue Détail */}
      {showDetailModal && selectedClient && (
        <DetailModal 
          client={selectedClient}
          onClose={() => closeModals(false)}
          onEdit={() => {
            setShowDetailModal(false)
            openClientModal(selectedClient)
          }}
        />
      )}
    </div>
  )
}

// ============================================
// MODAL - FORMULAIRE CLIENT AVEC UPLOADS
// ============================================
const ClientModal = ({ client, referrers, onClose, onSuccess }) => {
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState({
    type: client?.type || 'CLIENT',
    nom: client?.nom || '',
    prenom: client?.prenom || '',
    nationalite: client?.nationalite || 'Ivoirienne',
    dateNaissance: client?.dateNaissance ? new Date(client.dateNaissance).toISOString().split('T')[0] : '',
    telephone: client?.telephone || '',
    telephone2: client?.telephone2 || '',
    email: client?.email || '',
    adresse: client?.adresse || '',
    profession: client?.profession || '',
    numeroPiece: client?.numeroPiece || '',
    temoinId: client?.temoinId || ''
  })
  
  
  // États pour la sélection du patrimoine et de l'unité
  const [buildings, setBuildings] = useState([])
  const [unites, setUnites] = useState([])
  const [selectedBuilding, setSelectedBuilding] = useState(client?.buildingId?.toString() || '')
  const [selectedUnite, setSelectedUnite] = useState(client?.uniteId?.toString() || '')
  const [loadingBuildings, setLoadingBuildings] = useState(true) // true par défaut pour skeleton
  const [loadingUnites, setLoadingUnites] = useState(false) // État de chargement des unités
  const [errorBuildings, setErrorBuildings] = useState(null)
  const [retryCount, setRetryCount] = useState(0)
  const [showQuickUniteModal, setShowQuickUniteModal] = useState(false) // Modal création unité rapide

  // Charger les buildings au montage avec retry automatique
  const loadBuildings = async (isRetry = false) => {
    setLoadingBuildings(true)
    setErrorBuildings(null)
    console.log('[ClientModal] 🔄 Chargement des buildings...', isRetry ? '(retry)' : '')
    console.log('[ClientModal] URL API:', '/buildings')
    
    try {
      const response = await fetchBuildings() // Charger tous les patrimoines
      console.log('📦 [ClientModal] === RÉPONSE API COMPLÈTE ===')
      console.log('📦 [ClientModal] Type:', typeof response)
      console.log('📦 [ClientModal] Response:', response)
      console.log('📦 [ClientModal] response.data:', response?.data)
      console.log('📦 [ClientModal] response.data.data:', response?.data?.data)
      
      // EXTRACTION ULTRA-ROBUSTE - Tester TOUS les formats possibles
      let buildingsData = []
      
      // Format 1 : { data: { data: [...], pagination: {...} } } (axios wrapping)
      if (response?.data?.data && Array.isArray(response.data.data)) {
        buildingsData = response.data.data
        console.log('✅ [ClientModal] Format 1: response.data.data (axios + API wrapper)')
      }
      // Format 2 : { data: [...], pagination: {...} } (API direct)
      else if (response?.data && Array.isArray(response.data)) {
        buildingsData = response.data
        console.log('✅ [ClientModal] Format 2: response.data (API direct)')
      }
      // Format 3 : [...] (tableau direct)
      else if (Array.isArray(response)) {
        buildingsData = response
        console.log('✅ [ClientModal] Format 3: response (tableau direct)')
      }
      // Format 4 : { buildings: [...] }
      else if (response?.buildings && Array.isArray(response.buildings)) {
        buildingsData = response.buildings
        console.log('✅ [ClientModal] Format 4: response.buildings')
      }
      // Format 5 : { data: { buildings: [...] } }
      else if (response?.data?.buildings && Array.isArray(response.data.buildings)) {
        buildingsData = response.data.buildings
        console.log('✅ [ClientModal] Format 5: response.data.buildings')
      }
      else {
        console.error('❌ [ClientModal] FORMAT NON RECONNU !')
        console.error('❌ Type:', typeof response)
        console.error('❌ Clés:', response ? Object.keys(response) : 'null')
        console.error('❌ response.data clés:', response?.data ? Object.keys(response.data) : 'null')
        buildingsData = []
      }
      
      console.log('🏢 [ClientModal] === RÉSULTAT EXTRACTION ===')
      console.log('🏢 [ClientModal] Nombre:', buildingsData.length)
      
      if (buildingsData.length > 0) {
        console.log('🏢 [ClientModal] Premier:', buildingsData[0])
        console.log('🏢 [ClientModal] Noms:', buildingsData.map(b => b.nom || b.name || 'Sans nom').join(', '))
      } else {
        console.warn('⚠️ [ClientModal] AUCUN PATRIMOINE TROUVÉ')
      }
      
      // FORCER la mise à jour avec un nouveau tableau
      setBuildings([...buildingsData])
      setRetryCount(0)
      
      if (buildingsData.length === 0) {
        setErrorBuildings('Aucun patrimoine trouvé. Créez-en un dans la page Patrimoine.')
      }
    } catch (err) {
      console.error('[ClientModal] ❌ ERREUR lors du chargement:', err)
      console.error('[ClientModal] Message d\'erreur:', err.message)
      console.error('[ClientModal] Réponse serveur:', err.response?.data)
      console.error('[ClientModal] Status:', err.response?.status)
      
      const errorMsg = err.response?.data?.message || err.message || 'Erreur de connexion au serveur'
      setErrorBuildings(errorMsg)
      setBuildings([])
      
      // Auto-retry jusqu'à 3 fois
      if (retryCount < 3 && !err.response?.status) {
        // Retry seulement si c'est une erreur réseau (pas 401, 403, etc.)
        console.log(`[ClientModal] 🔄 Retry ${retryCount + 1}/3 dans ${(retryCount + 1)}s...`)
        setTimeout(() => {
          setRetryCount(prev => prev + 1)
          loadBuildings(true)
        }, 1000 * (retryCount + 1)) // Délai croissant
      }
    } finally {
      setLoadingBuildings(false)
    }
  }

  // Chargement initial FORCÉ à chaque ouverture du modal
  useEffect(() => {
    console.log('🚀 [ClientModal] Modal ouvert - Chargement FORCÉ des patrimoines')
    console.log('🚀 [ClientModal] Client en édition:', client?.id || 'Nouveau')
    
    // TOUJOURS charger les buildings à l'ouverture
    loadBuildings().then(() => {
      // Si on édite un client avec un patrimoine, pré-sélectionner
      if (client?.buildingId) {
        console.log('🎯 [ClientModal] Pré-sélection building:', client.buildingId)
        setSelectedBuilding(client.buildingId.toString())
      }
      if (client?.uniteId) {
        console.log('🎯 [ClientModal] Pré-sélection unité:', client.uniteId)
        setSelectedUnite(client.uniteId.toString())
      }
    })
  }, [])

  // Charger les unités quand un building est sélectionné
  useEffect(() => {
    const loadUnites = async () => {
      if (!selectedBuilding) {
        console.log('⚠️ [ClientModal] Aucun building sélectionné, reset unités')
        setUnites([])
        setSelectedUnite('')
        setLoadingUnites(false)
        return
      }
      
      // FORCER le chargement immédiat
      setLoadingUnites(true)
      setUnites([]) // Reset pour forcer le re-render
      
      try {
        console.log('🔄 [ClientModal] === CHARGEMENT FORCÉ DES UNITÉS ===')
        console.log('🔄 [ClientModal] Building ID:', selectedBuilding)
        console.log('🔄 [ClientModal] Timestamp:', Date.now())
        
        // Petit délai pour s'assurer que le state est à jour
        await new Promise(resolve => setTimeout(resolve, 100))
        
        const response = await fetchUnitesByBuilding(selectedBuilding)
        console.log('📦 [ClientModal] === RÉPONSE API UNITÉS ===')
        console.log('📦 [ClientModal] Type:', typeof response)
        console.log('📦 [ClientModal] Response:', response)
        console.log('📦 [ClientModal] response.data:', response?.data)
        console.log('📦 [ClientModal] response.data.data:', response?.data?.data)
        
        // EXTRACTION ULTRA-ROBUSTE - Tous les formats possibles
        let unitesData = []
        
        // Format 1: { data: { data: [...], count: X } }
        if (response?.data?.data && Array.isArray(response.data.data)) {
          unitesData = response.data.data
          console.log('✅ [ClientModal] Format 1: response.data.data')
        }
        // Format 2: { data: [...], count: X }
        else if (response?.data && Array.isArray(response.data)) {
          unitesData = response.data
          console.log('✅ [ClientModal] Format 2: response.data')
        }
        // Format 3: [...]
        else if (Array.isArray(response)) {
          unitesData = response
          console.log('✅ [ClientModal] Format 3: response direct')
        }
        // Format 4: { unites: [...] }
        else if (response?.unites && Array.isArray(response.unites)) {
          unitesData = response.unites
          console.log('✅ [ClientModal] Format 4: response.unites')
        }
        // Format 5: { data: { unites: [...] } }
        else if (response?.data?.unites && Array.isArray(response.data.unites)) {
          unitesData = response.data.unites
          console.log('✅ [ClientModal] Format 5: response.data.unites')
        }
        else {
          console.error('❌ [ClientModal] FORMAT UNITÉS NON RECONNU !')
          console.error('❌ Type:', typeof response)
          console.error('❌ Clés:', response ? Object.keys(response) : 'null')
          unitesData = []
        }
        
        console.log('🏠 [ClientModal] === RÉSULTAT EXTRACTION UNITÉS ===')
        console.log('🏠 [ClientModal] Nombre:', unitesData.length)
        
        if (unitesData.length > 0) {
          console.log('🏠 [ClientModal] Première unité:', unitesData[0])
          console.log('🏠 [ClientModal] Portes:', unitesData.map(u => u.numeroPorte || u.numero || 'Sans numéro').join(', '))
          console.log('🏠 [ClientModal] Statuts:', unitesData.map(u => u.statut).join(', '))
        } else {
          console.warn('⚠️ [ClientModal] AUCUNE UNITÉ TROUVÉE pour building', selectedBuilding)
        }
        
        // FORCER mise à jour avec nouveau tableau + timestamp pour garantir re-render
        const unitesWithTimestamp = unitesData.map(u => ({ ...u, _loadedAt: Date.now() }))
        console.log('✨ [ClientModal] Mise à jour FORCÉE du state avec', unitesWithTimestamp.length, 'unités')
        setUnites(unitesWithTimestamp)
        
        // Attribution automatique intelligente : sélectionner la première unité vacante
        if (unitesData.length > 0) {
          const uniteVacante = unitesData.find(u => u.statut === 'VACANT')
          if (uniteVacante && !selectedUnite) {
            setSelectedUnite(uniteVacante.id.toString())
            console.log('🎯 [ClientModal] Unité VACANTE auto-sélectionnée:', uniteVacante.numeroPorte, '(ID:', uniteVacante.id, ')')
          } else if (!selectedUnite) {
            setSelectedUnite(unitesData[0].id.toString())
            console.log('📍 [ClientModal] Première unité auto-sélectionnée:', unitesData[0].numeroPorte, '(ID:', unitesData[0].id, ')')
          }
        }
        
        console.log('✅ [ClientModal] === CHARGEMENT UNITÉS TERMINÉ ===')
        
      } catch (err) {
        console.error('❌ [ClientModal] === ERREUR CHARGEMENT UNITÉS ===')
        console.error('❌ Message:', err.message)
        console.error('❌ Stack:', err.stack)
        console.error('❌ Réponse:', err.response?.data)
        setUnites([])
        setSelectedUnite('')
      } finally {
        setLoadingUnites(false)
      }
    }
    
    loadUnites()
  }, [selectedBuilding])

  // Gestion des changements de formulaire
  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    console.log('📝 [ClientModal] === SOUMISSION FORMULAIRE ===')
    console.log('📝 [ClientModal] FormData:', formData)
    console.log('📝 [ClientModal] Building:', selectedBuilding)
    console.log('📝 [ClientModal] Unite:', selectedUnite)
    
    setIsSaving(true)
    try {
      const data = new FormData()
      
      // Ajouter tous les champs texte
      Object.keys(formData).forEach(key => {
        if (formData[key]) {
          data.append(key, formData[key])
          console.log(`📝 [ClientModal] Ajout champ: ${key} = ${formData[key]}`)
        }
      })
      
      // Ajouter le patrimoine et l'unité sélectionnés
      if (selectedBuilding) {
        data.append('buildingId', selectedBuilding)
      }
      if (selectedUnite) {
        data.append('uniteId', selectedUnite)
      }
      
      if (client) {
        console.log('📝 [ClientModal] Mise à jour client:', client.id)
        await updateClient(client.id, data)
        console.log('✅ [ClientModal] Client mis à jour avec succès')
        toast.success('✅ Client et attribution modifiés avec succès')
      } else {
        console.log('📝 [ClientModal] Création nouveau client')
        const response = await createClient(data)
        console.log('✅ [ClientModal] Client créé avec succès:', response)
        toast.success('✅ Client créé et assigné au patrimoine avec succès')
      }
      
      console.log('📝 [ClientModal] Appel onSuccess et fermeture')
      if (onSuccess) await onSuccess()
      onClose()
    } catch (error) {
      console.error('❌ [ClientModal] Erreur soumission:', error)
      console.error('❌ [ClientModal] Détails:', error.response?.data)
      toast.error(error.response?.data?.message || 'Erreur lors de l\'enregistrement')
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
              {client ? 'Modifier le client' : 'Nouveau client'}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
              <X size={24} style={{ color: '#6B7280' }} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Type de client */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: '#0D3B1F' }}>
              Type de client *
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="type"
                  value="CLIENT"
                  checked={formData.type === 'CLIENT'}
                  onChange={(e) => setFormData({...formData, type: e.target.value})}
                  className="w-4 h-4"
                  style={{ accentColor: '#1A6B35' }}
                />
                <span className="px-3 py-1 rounded text-sm font-medium" style={{ background: '#1A6B35', color: 'white' }}>
                  CLIENT
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="type"
                  value="SOUSCRIPTEUR"
                  checked={formData.type === 'SOUSCRIPTEUR'}
                  onChange={(e) => setFormData({...formData, type: e.target.value})}
                  className="w-4 h-4"
                  style={{ accentColor: '#C8960C' }}
                />
                <span className="px-3 py-1 rounded text-sm font-medium" style={{ background: '#C8960C', color: 'white' }}>
                  SOUSCRIPTEUR
                </span>
              </label>
            </div>
          </div>

          {/* Identité */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#0D3B1F' }}>
                Nom *
              </label>
              <input
                type="text"
                value={formData.nom}
                onChange={(e) => setFormData({...formData, nom: e.target.value})}
                placeholder="Nom du client"
                className="w-full px-4 py-2 border-2 rounded-lg outline-none"
                style={{ borderColor: '#E8F5EC' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#0D3B1F' }}>
                Prénom *
              </label>
              <input
                type="text"
                value={formData.prenom}
                onChange={(e) => setFormData({...formData, prenom: e.target.value})}
                placeholder="Prénom du client"
                className="w-full px-4 py-2 border-2 rounded-lg outline-none"
                style={{ borderColor: '#E8F5EC' }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#0D3B1F' }}>
                <Flag size={14} className="inline mr-1" />
                Nationalité
              </label>
              <input
                type="text"
                value={formData.nationalite}
                onChange={(e) => setFormData({...formData, nationalite: e.target.value})}
                className="w-full px-4 py-2 border-2 rounded-lg outline-none"
                style={{ borderColor: '#E8F5EC' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#0D3B1F' }}>
                <Calendar size={14} className="inline mr-1" />
                Date de naissance
              </label>
              <input
                type="date"
                value={formData.dateNaissance}
                onChange={(e) => setFormData({...formData, dateNaissance: e.target.value})}
                className="w-full px-4 py-2 border-2 rounded-lg outline-none"
                style={{ borderColor: '#E8F5EC' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#0D3B1F' }}>
                <Briefcase size={14} className="inline mr-1" />
                Profession
              </label>
              <input
                type="text"
                value={formData.profession}
                onChange={(e) => setFormData({...formData, profession: e.target.value})}
                className="w-full px-4 py-2 border-2 rounded-lg outline-none"
                style={{ borderColor: '#E8F5EC' }}
              />
            </div>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#0D3B1F' }}>
                <Phone size={14} className="inline mr-1" />
                Téléphone <span className="text-xs" style={{ color: '#6B7280' }}>(optionnel)</span>
              </label>
              <input
                type="tel"
                value={formData.telephone}
                onChange={(e) => setFormData({...formData, telephone: e.target.value})}
                className="w-full px-4 py-2 border-2 rounded-lg outline-none"
                style={{ borderColor: '#E8F5EC' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#0D3B1F' }}>
                Téléphone 2
              </label>
              <input
                type="tel"
                value={formData.telephone2}
                onChange={(e) => setFormData({...formData, telephone2: e.target.value})}
                className="w-full px-4 py-2 border-2 rounded-lg outline-none"
                style={{ borderColor: '#E8F5EC' }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#0D3B1F' }}>
                <Mail size={14} className="inline mr-1" />
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full px-4 py-2 border-2 rounded-lg outline-none"
                style={{ borderColor: '#E8F5EC' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#0D3B1F' }}>
                <MapPin size={14} className="inline mr-1" />
                Adresse
              </label>
              <input
                type="text"
                value={formData.adresse}
                onChange={(e) => setFormData({...formData, adresse: e.target.value})}
                className="w-full px-4 py-2 border-2 rounded-lg outline-none"
                style={{ borderColor: '#E8F5EC' }}
              />
            </div>
          </div>

          {/* Témoin/Apporteur */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0D3B1F' }}>
              Témoin / Apporteur
            </label>
            <select
              value={formData.temoinId}
              onChange={(e) => setFormData({...formData, temoinId: e.target.value})}
              className="w-full px-4 py-2 border-2 rounded-lg outline-none"
              style={{ borderColor: '#E8F5EC' }}
            >
              <option value="">-- Sélectionner un témoin --</option>
              {referrers.map((ref) => (
                <option key={ref.id} value={ref.id}>
                  {ref.prenom} {ref.nom} - {ref.telephone}
                </option>
              ))}
            </select>
          </div>


          {/* Attribution Patrimoine & Unité */}
          <div className="border-t pt-4" style={{ borderColor: '#E8F5EC' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium flex items-center gap-2" style={{ color: '#0D3B1F' }}>
                <Building2 size={18} />
                Attribution du logement
              </h3>
              <span className="text-xs px-2 py-1 rounded-full" style={{ background: '#FEF3C7', color: '#92400E' }}>
                Étape 2/3
              </span>
            </div>
            
            <div className="mb-4 p-3 rounded-lg" style={{ background: '#F0F9FF', border: '1px solid #BAE6FD' }}>
              <p className="text-xs" style={{ color: '#075985' }}>
                💡 <strong>Astuce :</strong> Sélectionnez d'abord le patrimoine, puis l'unité. Si aucune unité n'existe, créez-en une rapidement avec le bouton "+".
              </p>
            </div>
            
            {/* Sélection du patrimoine */}
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1" style={{ color: '#0D3B1F' }}>
                Patrimoine (Immeuble) *
              </label>
              <select
                value={selectedBuilding}
                onChange={(e) => {
                  setSelectedBuilding(e.target.value)
                  setSelectedUnite('') // Réinitialiser l'unité
                }}
                disabled={loadingBuildings}
                className="w-full px-4 py-2 border-2 rounded-lg outline-none"
                style={{ borderColor: '#E8F5EC' }}
              >
                <option value="">Choisir un patrimoine...</option>
                {(buildings || []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nom} - {b.adresse} ({b.commune})
                  </option>
                ))}
              </select>
              {/* Skeleton loader pendant le chargement */}
              {loadingBuildings && (
                <div className="mt-2 space-y-2">
                  <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
                  <p className="text-xs" style={{ color: '#6B7280' }}>Chargement des patrimoines...</p>
                </div>
              )}
              
              {/* Message d'erreur */}
              {!loadingBuildings && errorBuildings && (
                <div className="mt-2 p-3 rounded-lg text-xs" style={{ background: '#FEE2E2', color: '#DC2626' }}>
                  <p className="font-medium mb-1">⚠️ Erreur de chargement</p>
                  <p className="mb-2">{errorBuildings}</p>
                  <button 
                    type="button"
                    onClick={() => loadBuildings()}
                    className="px-3 py-1 rounded font-medium text-white text-xs"
                    style={{ background: '#DC2626' }}
                  >
                    Réessayer maintenant
                  </button>
                </div>
              )}
              
              {/* Aucun patrimoine trouvé */}
              {!loadingBuildings && !errorBuildings && buildings.length === 0 && (
                <div className="mt-2 p-3 rounded-lg text-xs" style={{ background: '#FEF3C7', color: '#92400E' }}>
                  <p className="font-medium mb-1">🏢 Aucun patrimoine disponible</p>
                  <p className="mb-2">Créez d'abord des immeubles dans la page Patrimoine.</p>
                  <button 
                    type="button"
                    onClick={() => loadBuildings()}
                    className="px-3 py-1 rounded font-medium text-white text-xs"
                    style={{ background: '#92400E' }}
                  >
                    Vérifier à nouveau
                  </button>
                </div>
              )}
              
              {/* Nombre de patrimoines trouvés */}
              {!loadingBuildings && buildings.length > 0 && (
                <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
                  ✅ {buildings.length} patrimoine(s) disponible(s)
                </p>
              )}
            </div>

            {/* Sélection de l'unité/porte */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium" style={{ color: '#0D3B1F' }}>
                  Unité / Porte <span className="text-xs" style={{ color: '#6B7280' }}>(optionnel)</span>
                </label>
                {selectedBuilding && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      console.log('🎯 [ClientModal] === CLIC BOUTON NOUVELLE UNITÉ ===')
                      console.log('🎯 [ClientModal] Building sélectionné:', selectedBuilding)
                      console.log('🎯 [ClientModal] Building name:', safeFind(buildings, b => b.id === parseInt(selectedBuilding))?.nom)
                      console.log('🎯 [ClientModal] État modal avant:', showQuickUniteModal)
                      setShowQuickUniteModal(true)
                      console.log('🎯 [ClientModal] Modal ouvert !')
                    }}
                    className="flex items-center gap-1 px-3 py-2 text-xs font-bold rounded-lg transition-all hover:scale-105 shadow-md"
                    style={{ background: '#C8960C', color: 'white', cursor: 'pointer' }}
                    title="Créer une nouvelle unité dans ce patrimoine"
                  >
                    <Plus size={16} className="font-bold" />
                    + Nouvelle unité
                  </button>
                )}
              </div>
              <select
                value={selectedUnite}
                onChange={(e) => {
                  console.log('🎯 [ClientModal] Unité sélectionnée manuellement:', e.target.value)
                  setSelectedUnite(e.target.value)
                }}
                disabled={!selectedBuilding || loadingUnites}
                className="w-full px-4 py-2 border-2 rounded-lg outline-none"
                style={{ borderColor: '#E8F5EC' }}
              >
                <option value="">
                  {!selectedBuilding 
                    ? 'Sélectionnez d\'abord un patrimoine' 
                    : loadingUnites
                      ? '⏳ Chargement des unités...'
                      : unites.length === 0 
                        ? 'Aucune unité disponible' 
                        : 'Choisir une unité...'}
                </option>
                {(() => {
                  console.log('🎨 [ClientModal] RENDU SELECT - Unités disponibles:', unites.length)
                  if (unites.length > 0) {
                    console.log('🎨 [ClientModal] Détails unités:', safeMap(unites, u => `${u.numeroPorte} (${u.statut})`).join(', '))
                  }
                  return safeMap(unites, (u) => {
                    const typeIcon = u.typeUnite ? {
                      'CHAMBRE': '🛏️',
                      'SALON': '🛋️',
                      'MAGASIN': '🏪',
                      'STUDIO': '🏠',
                      'APPARTEMENT': '🏢',
                      'BUREAU': '💼'
                    }[u.typeUnite] || '🚪' : '🚪'
                    
                    const statutIcon = u.statut === 'VACANT' ? '✅' : u.statut === 'OCCUPE' ? '🔴' : '🟡'
                    
                    return (
                      <option key={u.id} value={u.id}>
                        {typeIcon} Porte {u.numeroPorte || 'N/A'} - {u.typeUnite || 'Type non spécifié'} {statutIcon} - Étage {u.etage || 'RDC'} - {u.loyerBase?.toLocaleString() || '0'} FCFA/mois
                      </option>
                    )
                  })
                })()}
              </select>
              
              {/* Indicateur du nombre d'unités */}
              {selectedBuilding && !loadingUnites && unites.length > 0 && (
                <div className="mt-2 p-2 rounded-lg flex items-center gap-2" style={{ background: '#D1FAE5', border: '1px solid #6EE7B7' }}>
                  <span className="text-xs font-medium" style={{ color: '#065F46' }}>
                    ✅ {unites.length} unité(s) disponible(s)
                  </span>
                </div>
              )}
              
              {selectedBuilding && !loadingUnites && unites.length === 0 && (
                <div className="mt-2 p-3 rounded-lg" style={{ background: '#E0F2FE', border: '1px solid #7DD3FC' }}>
                  <p className="text-xs font-medium mb-2" style={{ color: '#075985' }}>
                    ℹ️ Aucune unité dans ce patrimoine
                  </p>
                  <p className="text-xs mb-2" style={{ color: '#075985' }}>
                    Vous pouvez <strong>continuer sans unité</strong> et l'attribuer plus tard, ou créer une unité maintenant avec le bouton <strong>"+ Nouvelle unité"</strong> ci-dessus.
                  </p>
                  <div className="flex items-center gap-2 text-xs mt-2">
                    <span className="px-2 py-1 rounded" style={{ background: '#BAE6FD', color: '#075985' }}>
                      ✅ Pas d'unité = OK
                    </span>
                  </div>
                </div>
              )}
              
              {loadingUnites && (
                <div className="mt-2 p-2 rounded-lg flex items-center gap-2" style={{ background: '#F3F4F6' }}>
                  <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
                  <span className="text-xs" style={{ color: '#6B7280' }}>
                    Chargement des unités...
                  </span>
                </div>
              )}
            </div>

            {/* Récapitulatif de l'attribution */}
            {selectedBuilding && (() => {
              const building = safeFind(buildings, b => b.id === parseInt(selectedBuilding))
              const unite = selectedUnite ? safeFind(unites, u => u.id === parseInt(selectedUnite)) : null
              
              if (!building) return null
              
              if (unite) {
                // Avec unité sélectionnée
                const typeIcon = unite.typeUnite ? {
                  'CHAMBRE': '🛏️',
                  'SALON': '🛋️',
                  'MAGASIN': '🏪',
                  'STUDIO': '🏠',
                  'APPARTEMENT': '🏢',
                  'BUREAU': '💼'
                }[unite.typeUnite] || '🚪' : '🚪'
                
                const loyerMensuel = unite.loyerBase || 0
                const caution = loyerMensuel * 2
                const montantAnnuel = loyerMensuel * 12
                
                return (
                  <div className="mt-3 p-4 rounded-lg" style={{ background: '#ECFDF5', border: '2px solid #10B981' }}>
                    <p className="font-bold mb-2" style={{ color: '#065F46' }}>
                      ✨ Attribution complète
                    </p>
                    <div className="space-y-1 text-sm" style={{ color: '#047857' }}>
                      <p><strong>🏢 Patrimoine:</strong> {building.nom}</p>
                      <p><strong>{typeIcon} Type:</strong> {unite.typeUnite || 'Non spécifié'}</p>
                      <p><strong>🚪 Porte:</strong> {unite.numeroPorte || 'Non spécifiée'}</p>
                      <p><strong>📍 Étage:</strong> {unite.etage || 'RDC'}</p>
                      <p><strong>💰 Loyer:</strong> {loyerMensuel.toLocaleString()} FCFA/mois</p>
                      <p><strong>🔒 Caution:</strong> {caution.toLocaleString()} FCFA (2 mois)</p>
                      <p className="pt-2 border-t" style={{ borderColor: '#10B981' }}>
                        <strong>📊 Total annuel:</strong> {montantAnnuel.toLocaleString()} FCFA
                      </p>
                    </div>
                  </div>
                )
              } else {
                // Sans unité - juste le patrimoine
                return (
                  <div className="mt-3 p-4 rounded-lg" style={{ background: '#E0F2FE', border: '2px solid #0EA5E9' }}>
                    <p className="font-bold mb-2" style={{ color: '#075985' }}>
                      ℹ️ Attribution partielle
                    </p>
                    <div className="space-y-1 text-sm" style={{ color: '#0369A1' }}>
                      <p><strong>🏢 Patrimoine:</strong> {building.nom}</p>
                      <p><strong>🚪 Unité:</strong> Non attribuée (peut être ajoutée plus tard)</p>
                    </div>
                  </div>
                )
              }
            })()}
            
            {/* Info si aucun patrimoine sélectionné */}
            {!selectedBuilding && (
              <p className="text-sm p-3 rounded-lg" style={{ background: '#FEF3C7', color: '#92400E' }}>
                <Info size={16} className="inline mr-2" />
                Sélectionnez un patrimoine et une unité pour créer automatiquement un bail
              </p>
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
                client ? 'Enregistrer' : 'Créer'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============================================
// MODAL - VUE DÉTAIL CLIENT
// ============================================
const DetailModal = ({ client, onClose, onEdit }) => {
  const badgeStyle = getClientTypeBadgeStyle(client.type)
  
  // Calculs financiers
  const montantInitial = client.balance?.montantInitial || 0
  const totalPaye = client.balance?.totalPaye || 0
  const resteDu = client.balance?.solde || 0
  const tauxPaye = montantInitial > 0 ? Math.min(100, Math.round((totalPaye / montantInitial) * 100)) : 0

  const [pdfLoading, setPdfLoading] = useState(false)

  // Chargement des baux du client
  const [clientLeases, setClientLeases] = useState([])
  const [leasesLoading, setLeasesLoading] = useState(true)

  useEffect(() => {
    const loadLeases = async () => {
      try {
        const res = await fetchLeases({ clientId: client.id, limit: 100 })
        const data = res.data?.data || res.data || []
        setClientLeases(Array.isArray(data) ? data : [])
      } catch {}
      finally { setLeasesLoading(false) }
    }
    loadLeases()
  }, [client.id])

  const handlePrintPDF = async () => {
    if (pdfLoading) return
    setPdfLoading(true)
    const toastId = toast.loading('Préparation de la fiche client…')
    try {
      // Utiliser client directement (déjà complet depuis la page)
      const clientData = client

      // Charger les baux si pas encore disponibles
      let baseLeases = clientLeases
      if (!baseLeases.length) {
        const res = await fetchLeases({ clientId: client.id, limit: 100 })
        baseLeases = Array.isArray(res.data?.data) ? res.data.data
                   : Array.isArray(res.data)       ? res.data
                   : []
      }

      // Charger détails complets (building, unite, payments, calculs) pour chaque bail
      const leases = baseLeases.length
        ? await Promise.all(baseLeases.map(l =>
            api.get(`/leases/${l.id}`).then(r => r.data || l).catch(() => l)
          ))
        : []

      // ── Helpers type de bien ──
      const T_MAP = {
        STUDIO:'Studio', CHAMBRE_SALON:'Chambre Salon', CHAMBRE:'Chambre',
        MAGASIN:'Magasin', VILLA:'Villa', APPARTEMENT:'Appartement',
        BUREAU:'Bureau', DUPLEX:'Duplex', BOUTIQUE:'Boutique',
        ENTREPOT:'Entrepôt', PARKING:'Parking', HANGAR:'Hangar'
      }
      const T_CLR = {
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
      const D_CLR = { bg:[243,244,246], c:[75,85,99], bar:[107,114,128] }
      const getType   = (l) => { const r = (l.unite?.type || l.unite?.typeUnite || l.typeUnite || '').toUpperCase(); return T_MAP[r] || (r ? r[0]+r.slice(1).toLowerCase() : '—') }
      const getBat    = (l) => l.building?.nom || l.unite?.building?.nom || (l.buildingId ? `Imm.#${l.buildingId}` : '—')
      const getPorte  = (l) => l.unite?.numeroPorte || (l.uniteId ? `#${l.uniteId}` : '—')
      const getStatLbl = (s) => ({ ACTIF:'Actif', TERMINE:'Terminé', RESILIE:'Résilié', EN_COURS:'En cours', EXPIRE:'Expiré' })[s] || s || '—'

      // ── Totaux (leases si dispo, sinon client.balance) ──
      const leaseMontant = leases.reduce((s, l) => s + (l.montantInitial     || 0), 0)
      const leasePaye    = leases.reduce((s, l) => s + (l.calculs?.totalPaye || 0), 0)
      const leaseReste   = leases.reduce((s, l) => s + (l.calculs?.resteDu   || 0), 0)
      const totalMontant = leaseMontant || clientData?.balance?.montantInitial || 0
      const totalPaye    = leasePaye    || clientData?.balance?.totalPaye      || 0
      const totalReste   = leaseReste   || clientData?.balance?.solde          || 0
      const totalPmts    = leases.reduce((s, l) => s + (l.payments?.length   || 0), 0)
      const fullName     = `${clientData?.prenom || ''} ${clientData?.nom || ''}`.trim()

      // ── Document ──
      const doc = new jsPDF('p', 'mm', 'a4')
      const W   = doc.internal.pageSize.getWidth()
      const ML  = 14
      let y = 38

      addWatermark(doc)
      addPdfHeader(doc, 'FICHE CLIENT COMPLÈTE',
        `${fullName}  ·  ${leases.length} bail(s)  ·  ${totalPmts} paiement(s)`)

      /* ══ IDENTITÉ CLIENT ═════════════════════════════════ */
      doc.setFillColor(13, 59, 31)
      doc.roundedRect(ML, y, W - ML * 2, 21, 2, 2, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(200, 150, 12)
      doc.text(fullName, ML + 5, y + 9)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(180, 220, 180)
      doc.text(getClientTypeLabel(clientData?.type), ML + 5, y + 16)
      doc.setTextColor(255, 255, 255)
      doc.text(formatPhone(clientData?.telephone), W - ML - 60, y + 9)
      if (clientData?.email) doc.text(clientData.email, W - ML - 60, y + 16)
      y += 25

      /* ══ INFOS PERSONNELLES 2 COLONNES ══════════════════ */
      const col2 = ML + (W - ML * 2) / 2 + 3
      const hasTemoin = !!clientData?.temoin
      const boxH = hasTemoin ? 34 : 27
      doc.setFillColor(249, 250, 251)
      doc.roundedRect(ML, y, W - ML * 2, boxH, 2, 2, 'F')
      const infoRows = [
        ['Nationalité',  clientData?.nationalite || 'Ivoirienne', ML + 4, y + 7],
        ['Né(e) le',     clientData?.dateNaissance ? formatDate(clientData.dateNaissance) : '—', ML + 4, y + 14],
        ['Profession',   clientData?.profession || '—', ML + 4, y + 21],
        ['N° Pièce',    clientData?.numeroPiece || '—', col2, y + 7],
        ['Adresse',      clientData?.adresse || '—', col2, y + 14],
        ['Tél. 2',       formatPhone(clientData?.telephone2) || '—', col2, y + 21]
      ]
      infoRows.forEach(([lbl, val, x, fy]) => {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(107, 114, 128)
        doc.text(lbl + ' :', x, fy)
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(13, 59, 31)
        doc.text(String(val), x + 23, fy)
      })
      if (hasTemoin) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(146, 64, 14)
        doc.text('Apporteur :', ML + 4, y + boxH - 4)
        doc.setFont('helvetica', 'normal'); doc.setTextColor(107, 114, 128)
        const t = clientData.temoin
        doc.text(`${t.prenom || ''} ${t.nom || ''}  ·  ${t.contact || t.telephone || '—'}`, ML + 26, y + boxH - 4)
      }
      y += boxH + 4

      /* ══ BADGES TYPES DE BIENS ═════════════════════════ */
      if (leases.length > 0) {
        const typeCount = {}
        leases.forEach(l => { const t = getType(l); typeCount[t] = (typeCount[t] || 0) + 1 })
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(13, 59, 31)
        doc.text('BIENS LOUÉS :', ML, y + 7.5)
        let bx = ML + 30
        Object.entries(typeCount).sort((a, b) => b[1] - a[1]).forEach(([typ, cnt]) => {
          const bc = T_CLR[typ] || D_CLR
          const txt = `${cnt}×  ${typ}`
          const tw = doc.getTextWidth(txt) + 9
          doc.setFillColor(...bc.bg); doc.roundedRect(bx, y, tw, 11, 2, 2, 'F')
          doc.setFillColor(...bc.bar); doc.rect(bx, y, 3, 11, 'F')
          doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...bc.c)
          doc.text(txt, bx + 5, y + 7.5)
          bx += tw + 3
        })
        y += 15
      }

      /* ══ KPI BOXES ════════════════════════════════════ */
      const bW = (W - ML * 2 - 6) / 3
      ;[
        { lbl:'TOTAL CONTRATS', val: formatCurrency(totalMontant), bg:[220,252,231], c:[22,101,52] },
        { lbl:'TOTAL PAYÉ',     val: formatCurrency(totalPaye),    bg:[219,234,254], c:[29,78,216] },
        { lbl:'RESTANT DÛ',     val: formatCurrency(totalReste),
          bg: totalReste > 0 ? [254,226,226] : [220,252,231],
          c:  totalReste > 0 ? [220,38,38]   : [22,101,52] }
      ].forEach((b, i) => {
        const bbx = ML + i * (bW + 3)
        doc.setFillColor(...b.bg); doc.roundedRect(bbx, y, bW, 16, 2, 2, 'F')
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...b.c)
        doc.text(b.lbl, bbx + bW / 2, y + 5.5, { align: 'center' })
        doc.setFontSize(10)
        doc.text(b.val, bbx + bW / 2, y + 12.5, { align: 'center' })
      })
      y += 20

      /* ══ BLOCS BAUX COMPACTS ═══════════════════════════ */
      if (leases.length > 0) {
        y = addSectionTitle(doc, `DÉTAIL DES ${leases.length} BAIL(S)`, y)
        const usW = W - ML * 2
        for (const l of leases) {
          y = checkPageBreak(doc, y)
          const tn  = getType(l)
          const tc  = T_CLR[tn] || D_CLR
          doc.setFillColor(...tc.bar); doc.rect(ML, y, 3, 18, 'F')
          doc.setFillColor(...tc.bg); doc.roundedRect(ML + 3, y, usW - 3, 18, 1, 1, 'F')
          // Type gras
          doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...tc.c)
          doc.text(tn.toUpperCase(), ML + 7, y + 7)
          const tw = doc.getTextWidth(tn.toUpperCase())
          // N°Bail + Immeuble + Porte inline
          doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(107, 114, 128)
          doc.text(`   ${l.numeroBail || '—'}  ·  ${getBat(l)}  ·  Porte ${getPorte(l)}`, ML + 7 + tw, y + 7)
          // Statut coin droit
          doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...tc.c)
          const sl = getStatLbl(l.statut)
          doc.text(sl, W - ML - doc.getTextWidth(sl) - 3, y + 7)
          // Ligne financère
          const fD = [
            { t:`Montant : ${formatCurrency(l.montantInitial)}`,       r:false },
            { t:`Payé : ${formatCurrency(l.calculs?.totalPaye || 0)}`, r:false },
            { t:`Reste : ${formatCurrency(l.calculs?.resteDu   || 0)}`, r:(l.calculs?.resteDu || 0) > 0 },
            { t:`${l.calculs?.progression || 0}%  ·  ${l.calculs?.nbPaiements || 0} pmt(s)`, r:false }
          ]
          const fW2 = (usW - 10) / 4
          fD.forEach((fi, i) => {
            doc.setFont('helvetica', fi.r ? 'bold' : 'normal')
            doc.setFontSize(7)
            doc.setTextColor(...(fi.r ? [220,38,38] : [55,65,81]))
            doc.text(fi.t, ML + 7 + i * fW2, y + 15)
          })
          y += 21
        }
      }

      /* ══ PAIEMENTS FUSIONNÉS ═════════════════════════════ */
      const allPmts = leases.flatMap(l =>
        (l.payments || []).map(p => ({ ...p, _bail: l.numeroBail }))
      )
      if (allPmts.length > 0) {
        y += 4
        y = checkPageBreak(doc, y)
        y = addSectionTitle(doc, `HISTORIQUE DES PAIEMENTS — ${allPmts.length} VERSEMENT(S)`, y)
        y = addTable(doc,
          ['N° Bail', 'N° Facture', 'Date', 'Montant versé', 'Mode', 'Agent'],
          allPmts.map(p => [
            p._bail || '—',
            p.numeroFacture || '—',
            formatDate(p.datePaiement),
            formatCurrency(p.montantVerse),
            p.modePaiement || '—',
            p.agent ? `${p.agent.prenom || ''} ${p.agent.nom || ''}`.trim() : '—'
          ]),
          y, [23, 32, 25, 30, 26, 40]
        )
      }

      addPdfFooter(doc)
      const filename = `FICHE-${fullName.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`
      const pdfBlob = doc.output('blob')
      const url = URL.createObjectURL(pdfBlob)
      setTimeout(() => URL.revokeObjectURL(url), 60000)
      const win = window.open(url, '_blank')
      if (!win) { const a = document.createElement('a'); a.href = url; a.download = filename; a.click() }

      try { logDocGeneration(user, 'PDF_GENERATED', filename, 'clients', { clientId: client.id }) } catch (_) {}
      toast.success(`✅ Fiche de ${fullName} générée — ${leases.length} baux · ${totalPmts} paiements`, { id: toastId })
    } catch (error) {
      console.error('❌ [PDF] Erreur:', error)
      toast.error(`Erreur PDF: ${error.message || 'Erreur inconnue'}`, { id: toastId })
    } finally {
      setPdfLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl">
        {/* Header */}
        <div className="p-6 border-b" style={{ borderColor: '#E8F5EC' }}>
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              {/* Photo */}
              <div 
                className="w-20 h-20 rounded-full flex items-center justify-center overflow-hidden"
                style={{ 
                  background: client.photoUrl ? 'transparent' : '#E8F5EC',
                  border: '3px solid #C8960C'
                }}
              >
                {client.photoUrl ? (
                  <img src={getPhotoUrl(client.photoUrl)} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User size={40} style={{ color: '#1A6B35' }} />
                )}
              </div>
              
              <div>
                <h2 className="text-xl font-bold" style={{ color: '#0D3B1F' }}>
                  {client.prenom} {client.nom}
                </h2>
                <span 
                  className="inline-block px-3 py-1 rounded text-sm font-medium mt-1"
                  style={{ 
                    background: badgeStyle.background,
                    color: badgeStyle.color
                  }}
                >
                  {getClientTypeLabel(client.type)}
                </span>
                <div className="flex items-center gap-4 mt-2 text-sm" style={{ color: '#6B7280' }}>
                  <span className="flex items-center gap-1">
                    <Phone size={14} />
                    {formatPhone(client.telephone)}
                  </span>
                  {client.email && (
                    <span className="flex items-center gap-1">
                      <Mail size={14} />
                      {client.email}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={onEdit}
                className="flex items-center gap-2 px-4 py-2 text-white font-medium rounded-lg"
                style={{ background: '#1A6B35' }}
              >
                <Edit2 size={16} />
                Modifier
              </button>
              <button
                onClick={handlePrintPDF}
                disabled={pdfLoading}
                className="flex items-center gap-2 px-4 py-2 text-white font-medium rounded-lg disabled:opacity-60"
                style={{ background: '#C8960C' }}
              >
                <FileDown size={16} />
                {pdfLoading ? 'Génération...' : 'Imprimer PDF'}
              </button>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
                <X size={24} style={{ color: '#6B7280' }} />
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Section Financière */}
          <div className="mb-8 p-6 rounded-xl" style={{ background: '#F9FAFB' }}>
            <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: '#0D3B1F' }}>
              <CreditCard size={20} style={{ color: '#C8960C' }} />
              Situation financière
            </h3>
            
            <div className="grid grid-cols-3 gap-6 mb-6">
              <div className="text-center p-4 rounded-lg" style={{ background: 'white' }}>
                <p className="text-2xl font-bold" style={{ color: '#0D3B1F' }}>
                  {formatCurrency(montantInitial)}
                </p>
                <p className="text-sm" style={{ color: '#6B7280' }}>Montant initial</p>
              </div>
              <div className="text-center p-4 rounded-lg" style={{ background: 'white' }}>
                <p className="text-2xl font-bold" style={{ color: '#10B981' }}>
                  {formatCurrency(totalPaye)}
                </p>
                <p className="text-sm" style={{ color: '#6B7280' }}>Total payé</p>
              </div>
              <div className="text-center p-4 rounded-lg" style={{ background: 'white' }}>
                <p className="text-2xl font-bold" style={{ color: resteDu > 0 ? '#DC2626' : '#10B981' }}>
                  {formatCurrency(resteDu)}
                </p>
                <p className="text-sm" style={{ color: '#6B7280' }}>Reste dû</p>
              </div>
            </div>
            
            {/* Barre de progression */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span style={{ color: '#6B7280' }}>Progression des paiements</span>
                <span className="font-semibold" style={{ color: '#0D3B1F' }}>{tauxPaye}%</span>
              </div>
              <div className="h-4 rounded-full overflow-hidden" style={{ background: '#E8F5EC' }}>
                <div 
                  className="h-full rounded-full transition-all duration-500"
                  style={{ 
                    width: `${tauxPaye}%`,
                    background: '#10B981'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Informations personnelles */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            <div>
              <h3 className="font-semibold mb-3" style={{ color: '#0D3B1F' }}>Informations personnelles</h3>
              <div className="space-y-2 text-sm">
                <p><span style={{ color: '#6B7280' }}>Nationalité:</span> <span style={{ color: '#0D3B1F' }}>{client.nationalite || '-'}</span></p>
                <p><span style={{ color: '#6B7280' }}>Date de naissance:</span> <span style={{ color: '#0D3B1F' }}>{formatDate(client.dateNaissance)}</span></p>
                <p><span style={{ color: '#6B7280' }}>Profession:</span> <span style={{ color: '#0D3B1F' }}>{client.profession || '-'}</span></p>
                <p><span style={{ color: '#6B7280' }}>Numéro de pièce:</span> <span style={{ color: '#0D3B1F' }}>{client.numeroPiece || '-'}</span></p>
              </div>
            </div>
            <div>
              <h3 className="font-semibold mb-3" style={{ color: '#0D3B1F' }}>Contact & Adresse</h3>
              <div className="space-y-2 text-sm">
                <p><span style={{ color: '#6B7280' }}>Téléphone 1:</span> <span style={{ color: '#0D3B1F' }}>{formatPhone(client.telephone)}</span></p>
                <p><span style={{ color: '#6B7280' }}>Téléphone 2:</span> <span style={{ color: '#0D3B1F' }}>{formatPhone(client.telephone2) || '-'}</span></p>
                <p><span style={{ color: '#6B7280' }}>Email:</span> <span style={{ color: '#0D3B1F' }}>{client.email || '-'}</span></p>
                <p><span style={{ color: '#6B7280' }}>Adresse:</span> <span style={{ color: '#0D3B1F' }}>{client.adresse || '-'}</span></p>
              </div>
            </div>
          </div>

          {/* Témoin */}
          {client.temoin && (
            <div className="mb-8 p-4 rounded-lg" style={{ background: '#FEF3C7' }}>
              <h3 className="font-semibold mb-2" style={{ color: '#0D3B1F' }}>Témoin / Apporteur</h3>
              <p className="text-sm" style={{ color: '#374151' }}>
                {client.temoin.prenom} {client.temoin.nom} - {formatPhone(client.temoin.telephone)}
              </p>
            </div>
          )}

          {/* ═══ BAUX SOUSCRITS ═══ */}
          <div className="mb-8">
            <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: '#0D3B1F' }}>
              <FileText size={20} style={{ color: '#1A6B35' }} />
              Baux souscrits
              <span className="px-2 py-0.5 rounded-full text-xs font-bold ml-1"
                style={{ background: '#DCFCE7', color: '#166534' }}>
                {clientLeases.length}
              </span>
            </h3>

            {leasesLoading ? (
              <div className="flex items-center gap-2 py-4 text-sm" style={{ color: '#6B7280' }}>
                <div className="w-4 h-4 border-2 border-[#1A6B35] border-t-transparent rounded-full animate-spin" />
                Chargement des baux...
              </div>
            ) : clientLeases.length === 0 ? (
              <div className="p-6 rounded-xl text-center" style={{ background: '#F9FAFB' }}>
                <FileText size={32} className="mx-auto mb-2" style={{ color: '#D1D5DB' }} />
                <p className="text-sm" style={{ color: '#9CA3AF' }}>Aucun bail enregistré pour ce client</p>
              </div>
            ) : (
              <div className="space-y-3">
                {clientLeases.map((lease) => {
                  const progression = lease.montantInitial > 0
                    ? Math.min(100, Math.round(((lease.calculs?.totalPaye || 0) / lease.montantInitial) * 100))
                    : 0
                  const resteLease = lease.calculs?.resteDu ?? Math.max(0, (lease.montantInitial || 0) - (lease.calculs?.totalPaye || 0))
                  const statutColor = {
                    ACTIF: { bg: '#DCFCE7', color: '#166534' },
                    EN_COURS: { bg: '#DBEAFE', color: '#1D4ED8' },
                    EXPIRE: { bg: '#FEF3C7', color: '#92400E' },
                    RESILIE: { bg: '#FEE2E2', color: '#DC2626' }
                  }[lease.statut] || { bg: '#F3F4F6', color: '#6B7280' }

                  return (
                    <div key={lease.id} className="rounded-xl border-2 overflow-hidden"
                      style={{ borderColor: '#E8F5EC' }}>
                      {/* En-tête bail */}
                      <div className="flex items-center justify-between px-4 py-3"
                        style={{ background: 'linear-gradient(135deg, #F0FDF4, #DCFCE7)' }}>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ background: '#1A6B35' }}>
                            <FileText size={14} className="text-white" />
                          </div>
                          <div>
                            <p className="font-bold text-sm" style={{ color: '#0D3B1F' }}>{lease.numeroBail}</p>
                            {lease.building?.nom && (
                              <p className="text-xs" style={{ color: '#6B7280' }}>
                                {lease.building.nom}{lease.unite?.numeroPorte ? ` — Porte ${lease.unite.numeroPorte}` : ''}
                              </p>
                            )}
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                          style={{ background: statutColor.bg, color: statutColor.color }}>
                          {lease.statut}
                        </span>
                      </div>

                      {/* Détails financiers */}
                      <div className="px-4 py-3">
                        <div className="grid grid-cols-3 gap-3 mb-3">
                          <div className="text-center">
                            <p className="text-xs mb-0.5" style={{ color: '#6B7280' }}>Montant initial</p>
                            <p className="font-bold text-sm" style={{ color: '#0D3B1F' }}>{formatCurrency(lease.montantInitial)}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs mb-0.5" style={{ color: '#6B7280' }}>Déjà payé</p>
                            <p className="font-bold text-sm" style={{ color: '#10B981' }}>{formatCurrency(lease.calculs?.totalPaye || 0)}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs mb-0.5" style={{ color: '#6B7280' }}>Reste dû</p>
                            <p className="font-bold text-sm" style={{ color: resteLease > 0 ? '#DC2626' : '#10B981' }}>{formatCurrency(resteLease)}</p>
                          </div>
                        </div>
                        {/* Barre progression */}
                        <div>
                          <div className="flex justify-between text-xs mb-1" style={{ color: '#6B7280' }}>
                            <span>Progression</span>
                            <span className="font-semibold" style={{ color: '#0D3B1F' }}>{progression}%</span>
                          </div>
                          <div className="h-2 rounded-full overflow-hidden" style={{ background: '#E8F5EC' }}>
                            <div className="h-full rounded-full transition-all"
                              style={{ width: `${progression}%`, background: progression >= 100 ? '#10B981' : '#1A6B35' }} />
                          </div>
                        </div>
                        {/* Dates */}
                        {lease.dateDebut && (
                          <div className="flex gap-4 mt-2 text-xs" style={{ color: '#6B7280' }}>
                            <span>Début: {formatDate(lease.dateDebut)}</span>
                            {lease.dateFin && <span>Fin: {formatDate(lease.dateFin)}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Historique des paiements */}
          <div>
            <h3 className="font-semibold mb-4" style={{ color: '#0D3B1F' }}>Historique des paiements</h3>
            
            {client.paiements && client.paiements.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border" style={{ borderColor: '#E8F5EC' }}>
                <table className="w-full">
                  <thead style={{ background: '#F9FAFB' }}>
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: '#6B7280' }}>Date</th>
                      <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: '#6B7280' }}>Montant</th>
                      <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: '#6B7280' }}>Mode</th>
                      <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: '#6B7280' }}>Agent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: '#E8F5EC' }}>
                    {client.paiements.map((paiement) => (
                      <tr key={paiement.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm" style={{ color: '#374151' }}>
                          {formatDate(paiement.datePaiement)}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold" style={{ color: '#10B981' }}>
                          +{formatCurrency(paiement.montant)}
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: '#6B7280' }}>
                          {paiement.modePaiement}
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: '#6B7280' }}>
                          {paiement.creePar?.prenom} {paiement.creePar?.nom}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center py-8" style={{ color: '#9CA3AF' }}>Aucun paiement enregistré</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// MODAL - CRÉATION RAPIDE D'UNITÉ
// ============================================
const QuickUniteModal = ({ buildingId, buildingName, onClose, onSuccess }) => {
  console.log('🎨 [QuickUniteModal] === RENDU DU COMPOSANT ===')
  console.log('🎨 [QuickUniteModal] Building ID:', buildingId)
  console.log('🎨 [QuickUniteModal] Building Name:', buildingName)
  
  const [formData, setFormData] = useState({
    numeroPorte: '',
    typeUnite: 'CHAMBRE',
    etage: 0,
    loyerBase: '',
    statut: 'VACANT'
  })
  const [isSaving, setIsSaving] = useState(false)
  const [keepOpen, setKeepOpen] = useState(false) // Pour créer plusieurs unités d'affilée
  const [createdCount, setCreatedCount] = useState(0)
  const numeroPorteRef = useRef(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isSaving) return

    if (!formData.numeroPorte || !formData.loyerBase) {
      toast.error('Veuillez remplir tous les champs obligatoires')
      return
    }

    setIsSaving(true)
    try {
      console.log('💾 [QuickUnite] Création unité:', formData)
      const response = await createUnite(buildingId, {
        ...formData,
        etage: parseInt(formData.etage),
        loyerBase: parseFloat(formData.loyerBase)
      })
      
      const newUnite = response?.data?.data || response?.data
      console.log('✅ [QuickUnite] Unité créée:', newUnite)
      
      setCreatedCount(prev => prev + 1)
      toast.success(`✅ Unité ${formData.numeroPorte} créée avec succès !`)
      
      if (keepOpen) {
        // Réinitialiser le formulaire pour créer une autre unité
        setFormData({
          numeroPorte: '',
          typeUnite: formData.typeUnite, // Garder le type
          etage: formData.etage, // Garder l'étage
          loyerBase: formData.loyerBase, // Garder le loyer
          statut: 'VACANT'
        })
        console.log('🔄 [QuickUnite] Formulaire réinitialisé pour nouvelle unité')
        // Focus automatique sur le champ numéro de porte
        setTimeout(() => numeroPorteRef.current?.focus(), 100)
      } else {
        // Fermer et notifier
        onSuccess(newUnite)
      }
    } catch (error) {
      console.error('❌ [QuickUnite] Erreur:', error)
      toast.error(error.response?.data?.message || 'Erreur lors de la création de l\'unité')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header avec gradient */}
        <div className="p-6 rounded-t-2xl" style={{ background: 'linear-gradient(135deg, #C8960C 0%, #E8B84D 100%)' }}>
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Plus size={24} />
                Création Rapide d'Unité
              </h3>
              <p className="text-sm text-white/80 mt-1">
                Patrimoine : <strong>{buildingName}</strong>
              </p>
            </div>
            <button 
              onClick={onClose} 
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <X size={24} className="text-white" />
            </button>
          </div>
          
          {createdCount > 0 && (
            <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.2)' }}>
              <span className="text-white text-sm font-bold">
                🎉 {createdCount} unité{createdCount > 1 ? 's' : ''} créée{createdCount > 1 ? 's' : ''} avec succès !
              </span>
            </div>
          )}
        </div>

        <div className="p-6">

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0D3B1F' }}>
              Numéro de porte *
            </label>
            <input
              ref={numeroPorteRef}
              type="text"
              value={formData.numeroPorte}
              onChange={(e) => setFormData(prev => ({ ...prev, numeroPorte: e.target.value }))}
              placeholder="Ex: A101, B202..."
              className="w-full px-4 py-2 border-2 rounded-lg outline-none"
              style={{ borderColor: '#E8F5EC' }}
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0D3B1F' }}>
              Type d'unité *
            </label>
            <select
              value={formData.typeUnite}
              onChange={(e) => setFormData(prev => ({ ...prev, typeUnite: e.target.value }))}
              className="w-full px-4 py-2 border-2 rounded-lg outline-none"
              style={{ borderColor: '#E8F5EC' }}
            >
              <option value="CHAMBRE">🛏️ Chambre</option>
              <option value="SALON">🛋️ Salon</option>
              <option value="STUDIO">🏠 Studio</option>
              <option value="APPARTEMENT">🏢 Appartement</option>
              <option value="MAGASIN">🏪 Magasin</option>
              <option value="BUREAU">💼 Bureau</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0D3B1F' }}>
              Étage
            </label>
            <input
              type="number"
              value={formData.etage}
              onChange={(e) => setFormData(prev => ({ ...prev, etage: e.target.value }))}
              min="0"
              className="w-full px-4 py-2 border-2 rounded-lg outline-none"
              style={{ borderColor: '#E8F5EC' }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0D3B1F' }}>
              Loyer mensuel (FCFA) *
            </label>
            <input
              type="number"
              value={formData.loyerBase}
              onChange={(e) => setFormData(prev => ({ ...prev, loyerBase: e.target.value }))}
              placeholder="Ex: 50000"
              min="0"
              className="w-full px-4 py-2 border-2 rounded-lg outline-none"
              style={{ borderColor: '#E8F5EC' }}
              required
            />
          </div>

          {/* Option pour créer plusieurs unités */}
          <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
            <input
              type="checkbox"
              id="keepOpen"
              checked={keepOpen}
              onChange={(e) => setKeepOpen(e.target.checked)}
              className="w-4 h-4 rounded"
              style={{ accentColor: '#C8960C' }}
            />
            <label htmlFor="keepOpen" className="text-sm font-medium cursor-pointer" style={{ color: '#065F46' }}>
              🔄 Créer plusieurs unités d'affilée
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border-2 rounded-lg font-medium transition-colors hover:bg-gray-50"
              style={{ borderColor: '#E8F5EC', color: '#6B7280' }}
            >
              {createdCount > 0 ? `Terminer (${createdCount})` : 'Annuler'}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 px-4 py-2 rounded-lg font-medium text-white transition-colors disabled:opacity-50 hover:opacity-90"
              style={{ background: '#C8960C' }}
            >
              {isSaving ? '⏳ Création...' : keepOpen ? '➕ Créer & Continuer' : '✅ Créer l\'unité'}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  )
}

export default ClientsPage
