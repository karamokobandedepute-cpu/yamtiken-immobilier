import { useEffect, useState } from 'react'
import { 
  Banknote, TrendingUp, TrendingDown, Filter, Plus, 
  Calendar, Activity, Wallet, Download, Search, 
  Clock, Edit2, Trash2, X, Check, FileText
} from 'lucide-react'
import { 
  fetchCaisseDashboard, 
  fetchCaisseAudit, 
  fetchCaisseBilanMensuel,
  fetchCaisseCategories,
  fetchDepenses,
  createDepense,
  updateDepense,
  deleteDepense
} from '../utils/api'
import { formatCurrency, formatDate } from '../utils/formatters'
import toast from 'react-hot-toast'
import { useAuthStore } from '../stores/authStore'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  Legend, ResponsiveContainer, Cell
} from 'recharts'

export default function CaissePage() {
  const { user } = useAuthStore()
  const canModify = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role)

  const [activeTab, setActiveTab] = useState('dashboard')
  const [loading, setLoading] = useState(true)
  
  const [dashboardData, setDashboardData] = useState(null)
  const [categories, setCategories] = useState([])
  const [depenses, setDepenses] = useState([])
  const [auditData, setAuditData] = useState(null)
  const [bilanMensuel, setBilanMensuel] = useState([])

  const [searchTerm, setSearchTerm] = useState('')
  const [periodeDashboard, setPeriodeDashboard] = useState('tout')
  
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({ id: null, motif: '', categorie: '', montant: '', date: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    loadCategories()
  }, [])

  useEffect(() => {
    loadTabContent()
  }, [activeTab, periodeDashboard])

  const loadCategories = async () => {
    try {
      const res = await fetchCaisseCategories()
      setCategories(Array.isArray(res) ? res : (res?.data || []))
    } catch (e) {
      console.error(e)
      setCategories([])
    }
  }

  const loadTabContent = async () => {
    setLoading(true)
    try {
      // Always fetch dashboard data for the widget in the depenses tab
      if (!dashboardData || activeTab === 'dashboard') {
        const dashRes = await fetchCaisseDashboard({ periode: periodeDashboard })
        setDashboardData(dashRes)
      }

      if (activeTab === 'depenses') {
        const res = await fetchDepenses(searchTerm ? { search: searchTerm } : undefined)
        setDepenses(res?.data?.depenses || [])
      } else if (activeTab === 'audit') {
        const res = await fetchCaisseAudit()
        setAuditData(res?.data)
      } else if (activeTab === 'bilan') {
        const res = await fetchCaisseBilanMensuel()
        setBilanMensuel(res || [])
      }
    } catch (error) {
      toast.error('Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    if (activeTab === 'depenses') loadTabContent()
  }

  const handleOpenModal = (depense = null) => {
    if (depense) {
      setFormData({
        id: depense.id,
        motif: depense.motif,
        categorie: depense.categorie,
        montant: depense.montant,
        date: new Date(depense.date).toISOString().slice(0,16)
      })
    } else {
      setFormData({ id: null, motif: '', categorie: '', montant: '', date: new Date().toISOString().slice(0,16) })
    }
    setShowModal(true)
  }

  const handleSaveDepense = async (e) => {
    e.preventDefault()
    if (!formData.motif || !formData.categorie || !formData.montant) {
      return toast.error('Veuillez remplir les champs obligatoires')
    }
    
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      const payload = {
        motif: formData.motif,
        categorie: formData.categorie,
        montant: parseFloat(formData.montant),
        date: formData.date
      }

      if (formData.id) {
        await updateDepense(formData.id, payload)
        toast.success('Dépense modifiée')
      } else {
        await createDepense(payload)
        toast.success('Dépense enregistrée')
      }
      setShowModal(false)
      loadTabContent()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Erreur lors de la sauvegarde')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Voulez-vous vraiment supprimer cette dépense ?')) return
    try {
      await deleteDepense(id)
      toast.success('Dépense supprimée')
      loadTabContent()
    } catch (e) {
      toast.error('Erreur suppression')
    }
  }

  // --- RENDERS TABS ---

  const renderDashboard = () => {
    if (!dashboardData) return null
    return (
      <div className="space-y-6">
        <div className="flex justify-end mb-4">
          <select 
            value={periodeDashboard} 
            onChange={e => setPeriodeDashboard(e.target.value)}
            className="border rounded-lg px-4 py-2 bg-white font-medium"
          >
            <option value="mois">Ce Mois-ci</option>
            <option value="annee">Cette Année</option>
            <option value="tout">Tout l'historique</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Card 1 */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-green-600"><TrendingUp size={64}/></div>
            <p className="text-sm font-semibold text-gray-500 mb-1">Total Encaissé</p>
            <h3 className="text-2xl font-bold text-gray-800">{formatCurrency(dashboardData.totalEntrees)}</h3>
            <p className="text-xs text-green-600 font-medium mt-2 flex items-center gap-1">
              <TrendingUp size={14} /> +{dashboardData.nbEntrees} paiements
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-red-600"><TrendingDown size={64}/></div>
            <p className="text-sm font-semibold text-gray-500 mb-1">Total Dépensé</p>
            <h3 className="text-2xl font-bold text-gray-800">{formatCurrency(dashboardData.totalDepenses)}</h3>
            <p className="text-xs text-red-600 font-medium mt-2 flex items-center gap-1">
              <TrendingDown size={14} /> -{dashboardData.nbDepenses} dépenses
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-blue-600"><Wallet size={64}/></div>
            <p className="text-sm font-semibold text-gray-500 mb-1">Solde Net</p>
            <h3 className={`text-2xl font-bold ${dashboardData.soldeNet >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {formatCurrency(dashboardData.soldeNet)}
            </h3>
            <p className="text-xs text-gray-500 font-medium mt-2">
              Bénéfice d'exploitation
            </p>
          </div>

          {/* Card 4 */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-purple-600"><Activity size={64}/></div>
            <p className="text-sm font-semibold text-gray-500 mb-1">Taux de Dépense</p>
            <h3 className="text-2xl font-bold text-gray-800">{dashboardData.tauxDepense}%</h3>
            <p className="text-xs text-gray-500 font-medium mt-2">
              du revenu total
            </p>
          </div>
        </div>

        {/* Dernières Dépenses */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <Clock size={18} className="text-gray-500" />
              Dernières dépenses
            </h2>
            <button onClick={() => setActiveTab('depenses')} className="text-sm text-green-600 font-medium hover:underline">
              Voir tout
            </button>
          </div>
          <div className="p-0">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b text-xs uppercase tracking-wider text-gray-500">
                  <th className="p-4 font-semibold">Date</th>
                  <th className="p-4 font-semibold">Motif</th>
                  <th className="p-4 font-semibold">Catégorie</th>
                  <th className="p-4 font-semibold">Montant</th>
                  <th className="p-4 font-semibold">Saisi par</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dashboardData.depensesRecentes?.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="p-4 whitespace-nowrap text-sm text-gray-600">{formatDate(d.date, true)}</td>
                    <td className="p-4 font-medium text-gray-800">{d.motif}</td>
                    <td className="p-4 text-sm"><span className="px-2 py-1 bg-gray-100 rounded text-gray-600 text-xs">{d.categorie}</span></td>
                    <td className="p-4 font-bold text-red-600">-{formatCurrency(d.montant)}</td>
                    <td className="p-4 text-sm text-gray-500">{d.createdBy?.prenom} {d.createdBy?.nom}</td>
                  </tr>
                ))}
                {(!dashboardData.depensesRecentes || dashboardData.depensesRecentes.length === 0) && (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-gray-500">Aucune dépense récente.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  const renderDepenses = () => (
    <div className="space-y-6">
      {/* VISUAL WIDGET: PARCOURS DES FONDS */}
      {dashboardData && (
        <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-black rounded-2xl shadow-xl border border-gray-700 overflow-hidden text-white p-6 relative">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Activity size={120} />
          </div>
          <h3 className="text-lg font-bold flex items-center gap-2 mb-6">
            <Activity className="text-blue-400" size={20} />
            Dynamique de la Caisse
          </h3>
          
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 relative z-10">
            {/* Montant Initial */}
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-5 border border-white/10 w-full md:w-1/3 relative overflow-hidden group hover:bg-white/10 transition">
              <div className="absolute top-0 right-0 w-2 h-full bg-green-500"></div>
              <p className="text-gray-400 text-sm font-semibold uppercase tracking-wider mb-1 flex items-center gap-2">
                <TrendingUp size={16} className="text-green-400" />
                Montant Encaissé
              </p>
              <p className="text-3xl font-black text-white">{formatCurrency(dashboardData.totalEntrees)}</p>
              <p className="text-xs text-gray-500 mt-2">100% des fonds initiaux</p>
            </div>

            {/* Flèche / Déduction */}
            <div className="flex flex-col items-center justify-center text-gray-500">
              <div className="h-1 w-12 md:w-8 bg-gray-700 rounded-full mb-1"></div>
              <div className="bg-gray-800 rounded-full p-2 border border-gray-700 text-red-400">
                <TrendingDown size={20} />
              </div>
              <div className="h-1 w-12 md:w-8 bg-gray-700 rounded-full mt-1"></div>
            </div>

            {/* Dépenses */}
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-5 border border-white/10 w-full md:w-1/3 relative overflow-hidden group hover:bg-white/10 transition">
              <div className="absolute top-0 right-0 w-2 h-full bg-red-500"></div>
              <p className="text-gray-400 text-sm font-semibold uppercase tracking-wider mb-1 flex items-center gap-2">
                <TrendingDown size={16} className="text-red-400" />
                Total Déduit
              </p>
              <p className="text-3xl font-black text-red-400">-{formatCurrency(dashboardData.totalDepenses)}</p>
              <p className="text-xs text-gray-500 mt-2">{dashboardData.tauxDepense}% consommés</p>
            </div>

            {/* Flèche / Résultat */}
            <div className="flex flex-col items-center justify-center text-gray-500">
              <div className="h-1 w-12 md:w-8 bg-gray-700 rounded-full mb-1"></div>
              <div className="bg-gray-800 rounded-full p-2 border border-gray-700 text-blue-400">
                <Wallet size={20} />
              </div>
              <div className="h-1 w-12 md:w-8 bg-gray-700 rounded-full mt-1"></div>
            </div>

            {/* Solde Restant */}
            <div className="bg-gradient-to-br from-blue-900/40 to-blue-800/20 backdrop-blur-sm rounded-xl p-5 border border-blue-500/30 w-full md:w-1/3 relative overflow-hidden group hover:from-blue-900/60 transition">
              <div className="absolute top-0 right-0 w-2 h-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]"></div>
              <p className="text-blue-200 text-sm font-semibold uppercase tracking-wider mb-1 flex items-center gap-2">
                <Wallet size={16} className="text-blue-400" />
                Solde Restant
              </p>
              <p className="text-3xl font-black text-blue-400">{formatCurrency(dashboardData.soldeNet)}</p>
              <p className="text-xs text-blue-300/70 mt-2">Disponible en caisse</p>
            </div>
          </div>
          
          {/* Progress bar visual */}
          <div className="mt-8 relative h-3 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
            <div 
              className="absolute top-0 left-0 h-full bg-red-500"
              style={{ width: `${Math.min(dashboardData.tauxDepense, 100)}%`, zIndex: 2 }}
            ></div>
            <div 
              className="absolute top-0 right-0 h-full bg-blue-500"
              style={{ width: `${Math.max(100 - dashboardData.tauxDepense, 0)}%`, zIndex: 1 }}
            ></div>
          </div>
          <div className="flex justify-between mt-2 text-xs font-medium">
            <span className="text-red-400">Dépenses ({dashboardData.tauxDepense}%)</span>
            <span className="text-blue-400">Reste ({Math.max(100 - dashboardData.tauxDepense, 0).toFixed(1)}%)</span>
          </div>
        </div>
      )}

      {/* Barre d'outils (Recherche et Ajout) */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text"
              placeholder="Chercher une dépense..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg w-64 focus:ring-2 focus:ring-green-500 outline-none"
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition">
            Rechercher
          </button>
        </form>
        
        <button 
          onClick={() => handleOpenModal()} 
          className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 transition transform hover:-translate-y-0.5"
        >
          <Plus size={18} /> Nouvelle Dépense
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b text-xs uppercase tracking-wider text-gray-500">
              <th className="p-4 font-semibold">Date & Heure</th>
              <th className="p-4 font-semibold">Motif</th>
              <th className="p-4 font-semibold">Catégorie</th>
              <th className="p-4 font-semibold text-right">Montant</th>
              <th className="p-4 font-semibold">Utilisateur</th>
              {canModify && <th className="p-4 font-semibold text-center">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {depenses.map(d => (
              <tr key={d.id} className="hover:bg-gray-50 transition">
                <td className="p-4 text-sm text-gray-600">{formatDate(d.date, true)}</td>
                <td className="p-4 font-medium text-gray-800">{d.motif}</td>
                <td className="p-4 text-sm"><span className="px-2 py-1 bg-gray-100 rounded text-gray-700 text-xs font-medium">{d.categorie}</span></td>
                <td className="p-4 text-right font-bold text-red-600 whitespace-nowrap">-{formatCurrency(d.montant)}</td>
                <td className="p-4 text-sm text-gray-500">{d.createdBy?.prenom} {d.createdBy?.nom}</td>
                {canModify && (
                  <td className="p-4 text-center space-x-2">
                    <button onClick={() => handleOpenModal(d)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit2 size={16}/></button>
                    <button onClick={() => handleDelete(d.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                  </td>
                )}
              </tr>
            ))}
            {depenses.length === 0 && (
              <tr><td colSpan="6" className="p-8 text-center text-gray-500">Aucune dépense trouvée.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )

  const renderAudit = () => {
    if (!auditData) return null
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl p-6 shadow-lg text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2 mb-1">
              <FileText size={24} className="text-green-400" />
              Journal d'Audit Financier
            </h2>
            <p className="text-gray-400 text-sm">Traçabilité complète des flux entrants et sortants</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400 uppercase tracking-widest mb-1">Solde de la période</p>
            <p className={`text-3xl font-bold ${auditData.stats.soldeNet >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatCurrency(auditData.stats.soldeNet)}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b text-xs uppercase tracking-wider text-gray-500">
                <th className="p-4 font-semibold w-40">Date</th>
                <th className="p-4 font-semibold">Flux</th>
                <th className="p-4 font-semibold">Libellé</th>
                <th className="p-4 font-semibold text-right">Montant</th>
                <th className="p-4 font-semibold text-right bg-blue-50/30">Solde Courant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {auditData.evenements.map((evt, idx) => (
                <tr key={evt.id} className="hover:bg-gray-50/80 transition group">
                  <td className="p-4 text-sm text-gray-500 whitespace-nowrap">
                    {formatDate(evt.date, true)}
                  </td>
                  <td className="p-4">
                    {evt.type === 'ENTREE' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold">
                        <TrendingUp size={12} /> ENTRÉE
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold">
                        <TrendingDown size={12} /> DÉPENSE
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    <p className="font-semibold text-gray-800 text-sm">{evt.libelle}</p>
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                      <span className="bg-gray-100 px-1.5 py-0.5 rounded">{evt.categorie}</span>
                      {evt.par && <span>· Par {evt.par}</span>}
                    </p>
                  </td>
                  <td className="p-4 text-right whitespace-nowrap">
                    <span className={`font-bold ${evt.type === 'ENTREE' ? 'text-green-600' : 'text-red-600'}`}>
                      {evt.type === 'ENTREE' ? '+' : '-'}{formatCurrency(evt.montant)}
                    </span>
                  </td>
                  <td className="p-4 text-right font-bold text-blue-900 bg-blue-50/10 whitespace-nowrap">
                    {formatCurrency(evt.soldeCumulatif)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  const renderBilan = () => {
    if (bilanMensuel.length === 0) return null
    return (
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
          <TrendingUp size={20} className="text-green-600" />
          Bilan sur les 12 derniers mois (Revenus vs Dépenses)
        </h2>
        <div className="h-96 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bilanMensuel} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="mois" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} tickFormatter={(value) => `${value/1000}k`} />
              <RechartsTooltip 
                formatter={(value) => formatCurrency(value)}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              <Bar dataKey="entrees" name="Encaissé" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="depenses" name="Dépensé" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Banknote className="text-green-600" size={32} />
            Caisse & Dépenses
          </h1>
          <p className="text-gray-500 mt-2 font-medium">Supervision financière, entrées, sorties et audit.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex p-1 overflow-x-auto">
        <button
          className={`flex-1 py-3 px-4 font-semibold text-sm rounded-lg flex items-center justify-center gap-2 transition-colors ${activeTab === 'dashboard' ? 'bg-green-50 text-green-700' : 'text-gray-500 hover:bg-gray-50'}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <Activity size={18} /> Vue d'ensemble
        </button>
        <button
          className={`flex-1 py-3 px-4 font-semibold text-sm rounded-lg flex items-center justify-center gap-2 transition-colors ${activeTab === 'depenses' ? 'bg-green-50 text-green-700' : 'text-gray-500 hover:bg-gray-50'}`}
          onClick={() => setActiveTab('depenses')}
        >
          <TrendingDown size={18} /> Dépenses
        </button>
        <button
          className={`flex-1 py-3 px-4 font-semibold text-sm rounded-lg flex items-center justify-center gap-2 transition-colors ${activeTab === 'audit' ? 'bg-green-50 text-green-700' : 'text-gray-500 hover:bg-gray-50'}`}
          onClick={() => setActiveTab('audit')}
        >
          <FileText size={18} /> Audit Financier
        </button>
        <button
          className={`flex-1 py-3 px-4 font-semibold text-sm rounded-lg flex items-center justify-center gap-2 transition-colors ${activeTab === 'bilan' ? 'bg-green-50 text-green-700' : 'text-gray-500 hover:bg-gray-50'}`}
          onClick={() => setActiveTab('bilan')}
        >
          <TrendingUp size={18} /> Bilan Mensuel
        </button>
      </div>

      {/* Content */}
      <div className="min-h-[500px]">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'depenses' && renderDepenses()}
            {activeTab === 'audit' && renderAudit()}
            {activeTab === 'bilan' && renderBilan()}
          </>
        )}
      </div>

      {/* Modal Ajout/Modif Dépense */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-800">
                {formData.id ? 'Modifier la dépense' : 'Enregistrer une dépense'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-700 p-1 rounded-full hover:bg-gray-200 transition">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveDepense} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Motif de la dépense *</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ex: Achat rame de papier"
                  value={formData.motif}
                  onChange={e => setFormData({...formData, motif: e.target.value})}
                  className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-green-500 focus:border-green-500 p-2 border text-gray-900 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Montant (FCFA) *</label>
                  <input 
                    type="number" 
                    required
                    min="1"
                    step="any"
                    placeholder="0"
                    value={formData.montant}
                    onChange={e => setFormData({...formData, montant: e.target.value})}
                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-red-500 focus:border-red-500 p-2 border font-bold text-red-600 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Date & Heure *</label>
                  <input 
                    type="datetime-local" 
                    required
                    value={formData.date}
                    onChange={e => setFormData({...formData, date: e.target.value})}
                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-green-500 focus:border-green-500 p-2 border text-gray-900 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Catégorie *</label>
                <select
                  required
                  value={formData.categorie}
                  onChange={e => setFormData({...formData, categorie: e.target.value})}
                  className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-green-500 focus:border-green-500 p-2 border text-gray-900 bg-white"
                >
                  <option value="">Sélectionner une catégorie</option>
                  {categories.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 rounded-lg text-gray-600 font-medium hover:bg-gray-100 transition"
                >
                  Annuler
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-green-600 text-white rounded-lg font-semibold shadow hover:bg-green-700 flex items-center gap-2 transition disabled:opacity-50"
                >
                  {isSubmitting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Check size={18} />}
                  {formData.id ? 'Mettre à jour' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
