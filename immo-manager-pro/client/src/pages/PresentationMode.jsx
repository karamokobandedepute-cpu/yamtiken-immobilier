import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  TrendingUp, 
  Users, 
  Home, 
  DollarSign, 
  AlertTriangle,
  Clock,
  Calendar,
  Maximize2,
  Minimize2,
  Power
} from 'lucide-react'
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import { formatCurrency } from '../utils/formatters'
import toast from 'react-hot-toast'

/**
 * MODE PRÉSENTATION / KIOSK
 * Affichage temps plein des KPIs pour écrans de bureau, hall d'accueil, etc.
 * Rotation automatique des slides, design épuré, lecture à distance
 */
const PresentationMode = () => {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isPlaying, setIsPlaying] = useState(true)
  const [data, setData] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(new Date())

  // Données simulées (à remplacer par API réelle)
  const mockData = {
    kpi: {
      revenusMois: 12500000,
      revenusPrevMois: 11800000,
      tauxOccupation: 87,
      tauxPrevOccupation: 85,
      totalUnites: 156,
      unitesOccupees: 136,
      loyersImpayes: 2450000,
      nouveauxContrats: 8,
      clientsActifs: 142
    },
    revenusCourbe: [
      { mois: 'Jan', revenus: 9800000 },
      { mois: 'Fév', revenus: 10500000 },
      { mois: 'Mar', revenus: 11200000 },
      { mois: 'Avr', revenus: 10800000 },
      { mois: 'Mai', revenus: 11800000 },
      { mois: 'Juin', revenus: 12500000 }
    ],
    occupationImmeubles: [
      { nom: 'Résidence A', occupation: 95, total: 24 },
      { nom: 'Résidence B', occupation: 82, total: 32 },
      { nom: 'Résidence C', occupation: 76, total: 28 },
      { nom: 'Résidence D', occupation: 91, total: 20 }
    ],
    alerts: [
      { type: 'payment', message: '3 loyers en retard ce mois', severity: 'high' },
      { type: 'contract', message: '5 contrats expirent dans 30 jours', severity: 'medium' },
      { type: 'unit', message: '4 unités vacantes', severity: 'low' }
    ],
    activities: [
      { time: '09:15', action: 'Paiement reçu', detail: 'Studio 12A - 350 000 FCFA', icon: DollarSign },
      { time: '10:30', action: 'Nouveau contrat', detail: 'M. KOUASSI - 3 chambres', icon: Users },
      { time: '11:45', action: 'Visite effectuée', detail: 'Mme. BAKAYOKO', icon: Home }
    ]
  }

  // Slides disponibles
  const slides = [
    { id: 'kpi', title: 'Performance Globale', component: KPIDashboard },
    { id: 'revenus', title: 'Évolution des Revenus', component: RevenusChart },
    { id: 'occupation', title: 'Taux d\'Occupation', component: OccupationDashboard },
    { id: 'alerts', title: 'Alertes & Actions', component: AlertsDashboard },
    { id: 'live', title: 'Activité en Direct', component: LiveActivity }
  ]

  // Rotation automatique
  useEffect(() => {
    if (!isPlaying) return
    
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length)
    }, 15000) // 15 secondes par slide
    
    return () => clearInterval(interval)
  }, [isPlaying, slides.length])

  // Rafraîchissement des données
  useEffect(() => {
    const interval = setInterval(() => {
      setData(mockData)
      setLastUpdate(new Date())
    }, 30000) // Toutes les 30 secondes
    
    setData(mockData)
    return () => clearInterval(interval)
  }, [])

  // Gestion du clavier
  useEffect(() => {
    const handleKeyDown = (e) => {
      switch (e.key) {
        case 'ArrowRight':
        case ' ':
          nextSlide()
          break
        case 'ArrowLeft':
          prevSlide()
          break
        case 'f':
          toggleFullscreen()
          break
        case 'Escape':
          if (isFullscreen) {
            document.exitFullscreen()
            setIsFullscreen(false)
          }
          break
        case 'p':
          setIsPlaying(!isPlaying)
          break
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isFullscreen, isPlaying])

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length)
  }

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length)
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  const CurrentSlideComponent = slides[currentSlide].component

  if (!data) return null

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-[#0D3B1F] via-[#1A6B35] to-[#0D3B1F] text-white overflow-hidden">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[#C8960C] flex items-center justify-center shadow-lg">
            <span className="text-2xl font-bold text-[#0D3B1F]">YB</span>
          </div>
          <div>
            <h1 className="text-3xl font-bold">YAMTIKEN BEHEMOTH</h1>
            <p className="text-[#C8960C] text-lg">IMMO MANAGER PRO - Tableau de bord en direct</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-4xl font-bold">{new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
            <p className="text-[#C8960C]">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              {isPlaying ? <Clock size={24} /> : <Power size={24} />}
            </button>
            <button 
              onClick={toggleFullscreen}
              className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              {isFullscreen ? <Minimize2 size={24} /> : <Maximize2 size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="absolute top-28 left-8 right-8 bottom-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            transition={{ duration: 0.5 }}
            className="h-full"
          >
            <div className="h-full bg-white/5 backdrop-blur-sm rounded-3xl p-8 border border-white/10">
              <h2 className="text-2xl font-semibold mb-6 text-[#C8960C]">{slides[currentSlide].title}</h2>
              <div className="h-[calc(100%-4rem)]">
                <CurrentSlideComponent data={data} />
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer / Navigation */}
      <div className="absolute bottom-0 left-0 right-0 p-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`w-3 h-3 rounded-full transition-all ${
                index === currentSlide 
                  ? 'bg-[#C8960C] w-8' 
                  : 'bg-white/30 hover:bg-white/50'
              }`}
            />
          ))}
        </div>
        
        <div className="flex items-center gap-4 text-sm text-white/60">
          <span>Slide {currentSlide + 1} / {slides.length}</span>
          <span>•</span>
          <span>MAJ: {lastUpdate.toLocaleTimeString()}</span>
          <span>•</span>
          <span>Ctrl+Flèches pour naviguer</span>
        </div>
      </div>

      {/* Instructions overlay (disparaît après 5s) */}
      <InstructionsOverlay />
    </div>
  )
}

// ============================================
// SLIDE COMPONENTS
// ============================================

const KPIDashboard = ({ data }) => {
  const kpiCards = [
    { 
      title: 'Revenus du Mois', 
      value: formatCurrency(data.kpi.revenusMois), 
      trend: ((data.kpi.revenusMois - data.kpi.revenusPrevMois) / data.kpi.revenusPrevMois * 100).toFixed(1),
      trendUp: data.kpi.revenusMois > data.kpi.revenusPrevMois,
      icon: DollarSign 
    },
    { 
      title: 'Taux d\'Occupation', 
      value: `${data.kpi.tauxOccupation}%`, 
      trend: (data.kpi.tauxOccupation - data.kpi.tauxPrevOccupation).toFixed(1),
      trendUp: data.kpi.tauxOccupation > data.kpi.tauxPrevOccupation,
      icon: Home 
    },
    { 
      title: 'Unités Occupées', 
      value: `${data.kpi.unitesOccupees}/${data.kpi.totalUnites}`, 
      subtext: `${data.kpi.totalUnites - data.kpi.unitesOccupees} vacantes`,
      icon: Users 
    },
    { 
      title: 'Loyers Impayés', 
      value: formatCurrency(data.kpi.loyersImpayes), 
      alert: data.kpi.loyersImpayes > 2000000,
      icon: AlertTriangle 
    }
  ]

  return (
    <div className="grid grid-cols-2 gap-6 h-full">
      {kpiCards.map((kpi, index) => {
        const Icon = kpi.icon
        return (
          <div 
            key={index}
            className={`rounded-2xl p-8 flex flex-col justify-between ${
              kpi.alert 
                ? 'bg-red-500/20 border-2 border-red-500' 
                : 'bg-white/10 border border-white/20'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className={`p-4 rounded-xl ${kpi.alert ? 'bg-red-500' : 'bg-[#C8960C]'}`}>
                <Icon size={32} className={kpi.alert ? 'text-white' : 'text-[#0D3B1F]'} />
              </div>
              <span className="text-xl text-white/80">{kpi.title}</span>
            </div>
            <div>
              <p className="text-5xl font-bold mb-2">{kpi.value}</p>
              {kpi.trend && (
                <p className={`text-lg flex items-center gap-2 ${kpi.trendUp ? 'text-green-400' : 'text-red-400'}`}>
                  {kpi.trendUp ? '↗' : '↘'} {Math.abs(kpi.trend)}% vs mois dernier
                </p>
              )}
              {kpi.subtext && <p className="text-lg text-white/60">{kpi.subtext}</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

const RevenusChart = ({ data }) => {
  return (
    <div className="h-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data.revenusCourbe}>
          <defs>
            <linearGradient id="colorRevenus" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#C8960C" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#C8960C" stopOpacity={0.1}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis dataKey="mois" stroke="rgba(255,255,255,0.6)" tick={{ fill: 'rgba(255,255,255,0.6)' }} />
          <YAxis 
            stroke="rgba(255,255,255,0.6)" 
            tick={{ fill: 'rgba(255,255,255,0.6)' }}
            tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#0D3B1F', border: '1px solid #C8960C', borderRadius: '8px' }}
            itemStyle={{ color: '#fff' }}
            formatter={(value) => formatCurrency(value)}
          />
          <Area 
            type="monotone" 
            dataKey="revenus" 
            stroke="#C8960C" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorRevenus)" 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

const OccupationDashboard = ({ data }) => {
  const COLORS = ['#C8960C', '#1A6B35', '#2D9E57', '#0D3B1F']
  
  return (
    <div className="grid grid-cols-2 gap-8 h-full">
      <div>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.occupationImmeubles} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis type="number" domain={[0, 100]} stroke="rgba(255,255,255,0.6)" tickFormatter={(v) => `${v}%`} />
            <YAxis dataKey="nom" type="category" stroke="rgba(255,255,255,0.6)" width={120} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#0D3B1F', border: '1px solid #C8960C' }}
              formatter={(value) => `${value}%`}
            />
            <Bar dataKey="occupation" fill="#C8960C" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      <div className="flex flex-col justify-center gap-6">
        {data.occupationImmeubles.map((item, index) => (
          <div key={index} className="flex items-center gap-4">
            <div 
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            />
            <div className="flex-1">
              <p className="text-lg font-medium">{item.nom}</p>
              <div className="flex items-center gap-2 text-white/60">
                <span>{item.occupation}% occupé</span>
                <span>•</span>
                <span>{item.total} unités</span>
              </div>
            </div>
            <div className="text-2xl font-bold" style={{ color: COLORS[index % COLORS.length] }}>
              {item.occupation}%
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const AlertsDashboard = ({ data }) => {
  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return 'bg-red-500/20 border-red-500 text-red-400'
      case 'medium': return 'bg-yellow-500/20 border-yellow-500 text-yellow-400'
      default: return 'bg-blue-500/20 border-blue-500 text-blue-400'
    }
  }

  return (
    <div className="grid grid-cols-2 gap-6 h-full">
      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-[#C8960C] mb-4">Alertes Actives</h3>
        {data.alerts.map((alert, index) => (
          <div 
            key={index}
            className={`p-4 rounded-xl border ${getSeverityColor(alert.severity)}`}
          >
            <div className="flex items-start gap-3">
              <AlertTriangle size={24} />
              <div>
                <p className="font-medium text-lg">{alert.message}</p>
                <p className="text-sm opacity-80">Priorité: {alert.severity}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="bg-white/5 rounded-2xl p-6">
        <h3 className="text-xl font-semibold text-[#C8960C] mb-4">Synthèse</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center p-4 bg-red-500/10 rounded-xl">
            <span className="text-lg">Actions urgentes</span>
            <span className="text-2xl font-bold text-red-400">{data.alerts.filter(a => a.severity === 'high').length}</span>
          </div>
          <div className="flex justify-between items-center p-4 bg-yellow-500/10 rounded-xl">
            <span className="text-lg">Actions modérées</span>
            <span className="text-2xl font-bold text-yellow-400">{data.alerts.filter(a => a.severity === 'medium').length}</span>
          </div>
          <div className="flex justify-between items-center p-4 bg-blue-500/10 rounded-xl">
            <span className="text-lg">Informations</span>
            <span className="text-2xl font-bold text-blue-400">{data.alerts.filter(a => a.severity === 'low').length}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

const LiveActivity = ({ data }) => {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-3 mb-6">
        <span className="relative flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500"></span>
        </span>
        <span className="text-xl text-green-400">EN DIRECT</span>
      </div>
      
      <div className="flex-1 space-y-4 overflow-y-auto">
        {data.activities.map((activity, index) => {
          const Icon = activity.icon
          return (
            <div 
              key={index}
              className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/10"
            >
              <div className="p-3 bg-[#C8960C] rounded-lg">
                <Icon size={24} className="text-[#0D3B1F]" />
              </div>
              <div className="flex-1">
                <p className="text-lg font-medium">{activity.action}</p>
                <p className="text-white/60">{activity.detail}</p>
              </div>
              <div className="text-[#C8960C] font-mono text-lg">
                {activity.time}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const InstructionsOverlay = () => {
  const [visible, setVisible] = useState(true)
  
  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 5000)
    return () => clearTimeout(timer)
  }, [])
  
  if (!visible) return null
  
  return (
    <motion.div 
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 1, delay: 4 }}
      className="absolute inset-0 bg-black/80 flex items-center justify-center z-50"
    >
      <div className="text-center space-y-4">
        <p className="text-2xl font-bold text-[#C8960C]">Mode Présentation</p>
        <div className="flex gap-8 text-white/80">
          <span>← → Navigation</span>
          <span>P Pause</span>
          <span>F Plein écran</span>
          <span>ESC Quitter</span>
        </div>
      </div>
    </motion.div>
  )
}

export default PresentationMode
