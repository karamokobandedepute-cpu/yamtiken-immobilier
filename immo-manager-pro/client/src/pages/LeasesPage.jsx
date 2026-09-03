// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LEASES PAGE - Gestion complète des baux
// Synchronisation temps réel avec Supabase
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useState, useMemo } from 'react'
import { useLeasesWithRealtime, useUpdateLeaseStatut, useDeleteLease, calculateLeaseStats } from '../hooks/useLeases'
import { useClients } from '../hooks/useClients'
import LeaseCard from '../components/baux/LeaseCard'
import LeaseForm from '../components/baux/LeaseForm'
import { 
  Plus, 
  Search, 
  Filter, 
  FileText, 
  TrendingUp,
  Users,
  DollarSign,
  CheckCircle,
  AlertCircle,
  XCircle,
  Clock,
  Loader2,
  RefreshCw,
  LayoutGrid,
  User,
  Phone,
  ChevronDown,
  ChevronRight
} from 'lucide-react'

const STATUT_FILTERS = [
  { value: 'all', label: 'Tous', icon: FileText },
  { value: 'actif', label: 'Actifs', icon: CheckCircle, color: 'text-green-600' },
  { value: 'en_cours', label: 'En cours', icon: Clock, color: 'text-blue-600' },
  { value: 'expire', label: 'Expirés', icon: AlertCircle, color: 'text-yellow-600' },
  { value: 'resilie', label: 'Résiliés', icon: XCircle, color: 'text-red-600' }
]

export default function LeasesPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [statutFilter, setStatutFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editingLease, setEditingLease] = useState(null)
  const [groupByClient, setGroupByClient] = useState(false)
  const [collapsedClients, setCollapsedClients] = useState({})

  const toggleClient = (clientId) =>
    setCollapsedClients(prev => ({ ...prev, [clientId]: !prev[clientId] }))

  // Récupération des données avec synchronisation temps réel
  const { data: leases, isLoading, error, refetch } = useLeasesWithRealtime(
    statutFilter !== 'all' ? { statut: statutFilter } : {}
  )
  
  const { data: clients, isLoading: isLoadingClients } = useClients()
  const updateStatut = useUpdateLeaseStatut()
  const deleteLease = useDeleteLease()
  
  // Filtrage local par recherche texte
  const filteredLeases = leases?.filter(lease => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      lease.numeroBail?.toLowerCase().includes(search) ||
      lease.client?.nom?.toLowerCase().includes(search) ||
      lease.client?.prenom?.toLowerCase().includes(search) ||
      lease.client?.telephone?.includes(search)
    )
  })
  
  // Groupement par client
  const groupedByClient = useMemo(() => {
    if (!filteredLeases) return []
    const map = {}
    filteredLeases.forEach(lease => {
      const key = lease.clientId || lease.client?.id || 'unknown'
      if (!map[key]) map[key] = { client: lease.client, leases: [] }
      map[key].leases.push(lease)
    })
    return Object.values(map).sort((a, b) =>
      `${a.client?.nom}`.localeCompare(`${b.client?.nom}`)
    )
  }, [filteredLeases])

  // Statistiques
  const stats = calculateLeaseStats(leases || [])
  
  const handleEdit = (lease) => {
    setEditingLease(lease)
    setShowForm(true)
  }
  
  const handleCloseForm = () => {
    setShowForm(false)
    setEditingLease(null)
  }
  
  const handleUpdateStatut = async (id, statut) => {
    if (confirm(`Êtes-vous sûr de vouloir changer le statut en "${statut}" ?`)) {
      await updateStatut.mutateAsync({ id, statut })
    }
  }
  
  const handleDelete = async (id) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce bail ? Cette action est irréversible.')) {
      await deleteLease.mutateAsync(id)
    }
  }
  
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      maximumFractionDigits: 0
    }).format(amount || 0)
  }
  
  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-7 h-7 text-blue-600" />
              Gestion des Baux
            </h1>
            <p className="text-gray-500 mt-1">
              Gérez vos contrats de location en temps réel
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nouveau bail
          </button>
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Baux</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Baux Actifs</p>
              <p className="text-2xl font-bold text-green-600">{stats.actifs}</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {stats.tauxOccupation.toFixed(1)}% de taux d'occupation
          </p>
        </div>
        
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Montant Total</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(stats.montantTotal)}</p>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg">
              <DollarSign className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Progression Moyenne</p>
              <p className="text-2xl font-bold text-blue-600">{stats.progressionMoyenne.toFixed(1)}%</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
      </div>
      
      {/* Filtres */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Recherche */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher par n° bail, client, téléphone..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          {/* Filtre statut */}
          <div className="flex gap-2 flex-wrap">
            {STATUT_FILTERS.map((filter) => {
              const Icon = filter.icon
              return (
                <button
                  key={filter.value}
                  onClick={() => setStatutFilter(filter.value)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    statutFilter === filter.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${filter.color || ''}`} />
                  {filter.label}
                </button>
              )
            })}
          </div>
          
          {/* Toggle groupBy */}
          <button
            onClick={() => setGroupByClient(g => !g)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              groupByClient ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title="Regrouper par client"
          >
            <Users className="w-4 h-4" />
            Par client
          </button>

          {/* Refresh */}
          <button
            onClick={() => refetch()}
            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Rafraîchir"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
      
      {/* Liste des baux */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-3" />
          <p className="text-gray-600">Erreur lors du chargement des baux</p>
          <button
            onClick={() => refetch()}
            className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
          >
            Réessayer
          </button>
        </div>
      ) : filteredLeases?.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
          <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 mb-2">Aucun bail trouvé</p>
          <p className="text-sm text-gray-400 mb-4">
            {searchTerm ? 'Essayez une autre recherche' : 'Commencez par créer un nouveau bail'}
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Créer un bail →
          </button>
        </div>
      ) : groupByClient ? (
        <div className="space-y-6">
          {groupedByClient.map(({ client: c, leases: clientLeases }) => {
            const clientKey = c?.id || 'unknown'
            const isOpen = !collapsedClients[clientKey]
            const initials = `${c?.prenom?.[0] || ''}${c?.nom?.[0] || ''}`
            return (
              <div key={clientKey} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Header client */}
                <button
                  onClick={() => toggleClient(clientKey)}
                  className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors"
                  style={{ borderBottom: isOpen ? '1px solid #E8F5EC' : 'none' }}
                >
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                    style={{ background: 'linear-gradient(135deg, #0D3B1F, #1A6B35)' }}>
                    {initials || <User className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-bold text-gray-900">{c?.prenom} {c?.nom}</p>
                    {c?.telephone && (
                      <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3" />{c.telephone}
                      </p>
                    )}
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold mr-3"
                    style={{ background: '#DCFCE7', color: '#166534' }}>
                    {clientLeases.length} bail{clientLeases.length > 1 ? 's' : ''}
                  </span>
                  {isOpen
                    ? <ChevronDown className="w-5 h-5 text-gray-400" />
                    : <ChevronRight className="w-5 h-5 text-gray-400" />}
                </button>

                {/* Baux du client */}
                {isOpen && (
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                    style={{ background: '#F9FAFB' }}>
                    {clientLeases.map(lease => (
                      <LeaseCard
                        key={lease.id}
                        lease={lease}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onUpdateStatut={handleUpdateStatut}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLeases.map((lease) => (
            <LeaseCard
              key={lease.id}
              lease={lease}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onUpdateStatut={handleUpdateStatut}
            />
          ))}
        </div>
      )}
      
      {/* Modal Formulaire */}
      {showForm && (
        <LeaseForm
          lease={editingLease}
          clients={clients || []}
          isLoadingClients={isLoadingClients}
          onClose={handleCloseForm}
          onSuccess={() => {
            handleCloseForm()
            if (refetch) refetch()
          }}
        />
      )}
    </div>
  )
}
