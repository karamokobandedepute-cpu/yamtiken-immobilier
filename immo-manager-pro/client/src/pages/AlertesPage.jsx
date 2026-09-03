import { useState } from 'react'
import { useAlertes } from '../hooks/useAlertes'
import { AlertTriangle, CheckCircle, Info, Filter, RefreshCw, Eye, EyeOff, Phone, Mail, MapPin, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'

const AlertesPage = () => {
  const { alertes, loading, stats, refetch, marquerVu, marquerToutVu, filtrerAlertes } = useAlertes()
  
  const [filtreActif, setFiltreActif] = useState('tous') // tous, danger, warning, info
  const [afficherVues, setAfficherVues] = useState(true)

  // Filtrer les alertes selon les critères
  const alertesFiltrees = alertes.filter(alerte => {
    if (filtreActif !== 'tous' && alerte.severity !== filtreActif) return false
    if (!afficherVues && alerte.vu) return false
    return true
  })

  // Grouper par sévérité
  const alertesParSeverite = {
    danger: alertesFiltrees.filter(a => a.severity === 'danger'),
    warning: alertesFiltrees.filter(a => a.severity === 'warning'),
    info: alertesFiltrees.filter(a => a.severity === 'info')
  }

  const getSeverityConfig = (severity) => {
    const configs = {
      danger: {
        bg: 'bg-red-50',
        border: 'border-red-200',
        text: 'text-red-800',
        badge: 'bg-red-500',
        icon: AlertTriangle,
        label: 'Urgent'
      },
      warning: {
        bg: 'bg-orange-50',
        border: 'border-orange-200',
        text: 'text-orange-800',
        badge: 'bg-orange-500',
        icon: AlertTriangle,
        label: 'Attention'
      },
      info: {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        text: 'text-blue-800',
        badge: 'bg-blue-500',
        icon: Info,
        label: 'Information'
      }
    }
    return configs[severity]
  }

  const handleMarquerVu = (alerteId) => {
    marquerVu(alerteId)
    toast.success('Alerte marquée comme vue')
  }

  const handleRefresh = async () => {
    await refetch()
    toast.success('Alertes actualisées')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#1A6B35' }} />
          <p className="text-sm font-medium" style={{ color: '#1A6B35' }}>Chargement des alertes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: '#0D3B1F' }}>
            Alertes & Notifications
          </h1>
          <p className="text-gray-600 mt-1">
            Surveillez les événements importants de votre portefeuille
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 bg-white border-2 rounded-lg hover:bg-gray-50 transition-all"
            style={{ borderColor: '#E8F5EC' }}
          >
            <RefreshCw className="w-4 h-4" style={{ color: '#1A6B35' }} />
            <span className="font-medium" style={{ color: '#1A6B35' }}>Actualiser</span>
          </button>
          {stats.total > 0 && (
            <button
              onClick={marquerToutVu}
              className="flex items-center gap-2 px-4 py-2 text-white font-medium rounded-lg transition-all"
              style={{ background: '#1A6B35' }}
            >
              <CheckCircle className="w-4 h-4" />
              Tout marquer comme vu
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-6 border-2" style={{ borderColor: '#E8F5EC' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-3xl font-bold mt-1" style={{ color: '#0D3B1F' }}>{stats.total}</p>
            </div>
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: '#E8F5EC' }}>
              <Filter className="w-6 h-6" style={{ color: '#1A6B35' }} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border-2 border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-600">Urgent</p>
              <p className="text-3xl font-bold mt-1 text-red-700">{stats.danger}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border-2 border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-orange-600">Attention</p>
              <p className="text-3xl font-bold mt-1 text-orange-700">{stats.warning}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border-2 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600">Information</p>
              <p className="text-3xl font-bold mt-1 text-blue-700">{stats.info}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <Info className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-lg p-4 border-2" style={{ borderColor: '#E8F5EC' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5" style={{ color: '#1A6B35' }} />
            <span className="font-medium" style={{ color: '#0D3B1F' }}>Filtres :</span>
            <div className="flex gap-2 ml-4">
              {['tous', 'danger', 'warning', 'info'].map(filtre => (
                <button
                  key={filtre}
                  onClick={() => setFiltreActif(filtre)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    filtreActif === filtre
                      ? 'text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  style={filtreActif === filtre ? { background: '#1A6B35' } : {}}
                >
                  {filtre === 'tous' ? 'Toutes' : filtre === 'danger' ? 'Urgent' : filtre === 'warning' ? 'Attention' : 'Info'}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => setAfficherVues(!afficherVues)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all"
          >
            {afficherVues ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            <span className="text-sm font-medium">
              {afficherVues ? 'Masquer vues' : 'Afficher vues'}
            </span>
          </button>
        </div>
      </div>

      {/* Alertes par sévérité */}
      <div className="space-y-6">
        {['danger', 'warning', 'info'].map(severity => {
          const config = getSeverityConfig(severity)
          const alertesSeverite = alertesParSeverite[severity]

          if (alertesSeverite.length === 0) return null

          return (
            <div key={severity} className="space-y-3">
              <div className="flex items-center gap-3">
                <config.icon className="w-6 h-6" style={{ color: config.badge.replace('bg-', '#') }} />
                <h2 className="text-xl font-bold" style={{ color: '#0D3B1F' }}>
                  {config.label} ({alertesSeverite.length})
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {alertesSeverite.map(alerte => (
                  <div
                    key={alerte.id}
                    className={`${config.bg} border-2 ${config.border} rounded-lg p-4 transition-all ${
                      alerte.vu ? 'opacity-60' : 'hover:shadow-lg'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-2xl">{alerte.icon}</span>
                          <div>
                            <h3 className={`font-bold ${config.text}`}>
                              {alerte.titre}
                            </h3>
                            <p className="text-sm text-gray-600 mt-1">
                              {alerte.description}
                            </p>
                          </div>
                        </div>

                        {/* Détails */}
                        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          {alerte.data.bien_nom && (
                            <div className="flex items-center gap-2 text-gray-700">
                              <MapPin className="w-4 h-4" />
                              <span>{alerte.data.bien_nom}</span>
                            </div>
                          )}
                          {alerte.data.locataire_nom && (
                            <div className="flex items-center gap-2 text-gray-700">
                              <span className="font-medium">👤</span>
                              <span>{alerte.data.locataire_nom}</span>
                            </div>
                          )}
                          {alerte.data.locataire_telephone && (
                            <div className="flex items-center gap-2 text-gray-700">
                              <Phone className="w-4 h-4" />
                              <a href={`tel:${alerte.data.locataire_telephone}`} className="hover:underline">
                                {alerte.data.locataire_telephone}
                              </a>
                            </div>
                          )}
                          {alerte.data.montant && (
                            <div className="flex items-center gap-2 text-gray-700">
                              <span className="font-medium">💰</span>
                              <span className="font-semibold">{alerte.data.montant.toLocaleString()} FCFA</span>
                            </div>
                          )}
                        </div>

                        {/* Badges */}
                        <div className="mt-3 flex items-center gap-2">
                          <span className={`px-3 py-1 ${config.badge} text-white text-xs font-medium rounded-full`}>
                            {alerte.label}
                          </span>
                          {alerte.vu && (
                            <span className="px-3 py-1 bg-gray-400 text-white text-xs font-medium rounded-full flex items-center gap-1">
                              <Eye className="w-3 h-3" />
                              Vue
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      {!alerte.vu && (
                        <button
                          onClick={() => handleMarquerVu(alerte.id)}
                          className="ml-4 px-4 py-2 bg-white border-2 rounded-lg hover:bg-gray-50 transition-all flex items-center gap-2"
                          style={{ borderColor: config.border.replace('border-', '#') }}
                        >
                          <CheckCircle className="w-4 h-4" />
                          <span className="text-sm font-medium">Marquer vu</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Message si aucune alerte */}
      {alertesFiltrees.length === 0 && (
        <div className="bg-white rounded-lg p-12 text-center border-2" style={{ borderColor: '#E8F5EC' }}>
          <CheckCircle className="w-16 h-16 mx-auto mb-4" style={{ color: '#1A6B35' }} />
          <h3 className="text-xl font-bold mb-2" style={{ color: '#0D3B1F' }}>
            Aucune alerte
          </h3>
          <p className="text-gray-600">
            {afficherVues 
              ? 'Tout va bien ! Aucune alerte à signaler.'
              : 'Toutes les alertes ont été vues.'}
          </p>
        </div>
      )}
    </div>
  )
}

export default AlertesPage
