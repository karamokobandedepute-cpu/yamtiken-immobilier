import { User, Home, Calendar, TrendingUp, CheckCircle, AlertTriangle, Clock } from 'lucide-react'
import { formatCurrency, formatDate } from '../utils/formatters'

const ClientBailCard = ({ client, onEncaisser }) => {
  const getStatutColor = (statut) => {
    switch (statut) {
      case 'SOLDE':
        return { bg: '#ECFDF5', border: '#10B981', text: '#059669', icon: '#10B981' }
      case 'EN_COURS':
        return { bg: '#EFF6FF', border: '#3B82F6', text: '#1D4ED8', icon: '#3B82F6' }
      case 'RETARD':
        return { bg: '#FEF2F2', border: '#EF4444', text: '#DC2626', icon: '#EF4444' }
      default:
        return { bg: '#F9FAFB', border: '#9CA3AF', text: '#6B7280', icon: '#9CA3AF' }
    }
  }

  const getProgressColor = (taux) => {
    if (taux === 100) return '#10B981' // Vert
    if (taux >= 75) return '#3B82F6' // Bleu
    if (taux >= 50) return '#F59E0B' // Orange
    return '#EF4444' // Rouge
  }

  const colors = getStatutColor(client.statut)
  const progressColor = getProgressColor(client.tauxPaiement)

  return (
    <div 
      className="bg-white rounded-xl p-5 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer"
      style={{ border: `2px solid ${colors.border}` }}
      onClick={() => client.statut !== 'SOLDE' && onEncaisser(client)}
    >
      {/* En-tête avec statut */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div 
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: colors.bg }}
          >
            <User size={24} style={{ color: colors.icon }} />
          </div>
          <div>
            <h3 className="font-bold text-lg" style={{ color: '#0D3B1F' }}>
              {client.client.prenom} {client.client.nom}
            </h3>
            <p className="text-sm" style={{ color: '#6B7280' }}>
              📞 {client.client.telephone}
            </p>
          </div>
        </div>

        {/* Badge statut */}
        <div 
          className="px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1"
          style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
        >
          {client.statut === 'SOLDE' && <CheckCircle size={14} />}
          {client.statut === 'RETARD' && <AlertTriangle size={14} />}
          {client.statut === 'EN_COURS' && <Clock size={14} />}
          {client.statut === 'SOLDE' ? 'Soldé' : client.statut === 'RETARD' ? 'En retard' : 'En cours'}
        </div>
      </div>

      {/* Informations du bail */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Home size={16} style={{ color: '#6B7280' }} />
          <div>
            <p className="text-xs" style={{ color: '#9CA3AF' }}>Bail</p>
            <p className="text-sm font-semibold" style={{ color: '#0D3B1F' }}>
              {client.bien.numeroBail}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Calendar size={16} style={{ color: '#6B7280' }} />
          <div>
            <p className="text-xs" style={{ color: '#9CA3AF' }}>Dernier paiement</p>
            <p className="text-sm font-semibold" style={{ color: '#0D3B1F' }}>
              {formatDate(client.dernierPaiement)}
            </p>
          </div>
        </div>
      </div>

      {/* Barre de progression animée */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-medium" style={{ color: '#6B7280' }}>
            Progression du paiement
          </span>
          <span className="text-sm font-bold" style={{ color: progressColor }}>
            {client.tauxPaiement.toFixed(1)}%
          </span>
        </div>
        
        {/* Barre de progression */}
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden relative">
          <div 
            className="h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden"
            style={{ 
              width: `${client.tauxPaiement}%`,
              background: `linear-gradient(90deg, ${progressColor} 0%, ${progressColor}dd 100%)`
            }}
          >
            {/* Animation de brillance */}
            <div 
              className="absolute inset-0 animate-shimmer"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
                backgroundSize: '200% 100%'
              }}
            />
          </div>
        </div>
      </div>

      {/* Montants */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="text-center p-2 rounded-lg" style={{ background: '#F9FAFB' }}>
          <p className="text-xs mb-1" style={{ color: '#6B7280' }}>Total</p>
          <p className="text-sm font-bold" style={{ color: '#0D3B1F' }}>
            {formatCurrency(client.montantTotal)}
          </p>
        </div>
        <div className="text-center p-2 rounded-lg" style={{ background: '#ECFDF5' }}>
          <p className="text-xs mb-1" style={{ color: '#6B7280' }}>Payé</p>
          <p className="text-sm font-bold" style={{ color: '#10B981' }}>
            {formatCurrency(client.totalPaye)}
          </p>
        </div>
        <div className="text-center p-2 rounded-lg" style={{ background: client.soldeDu > 0 ? '#FEF2F2' : '#ECFDF5' }}>
          <p className="text-xs mb-1" style={{ color: '#6B7280' }}>Reste</p>
          <p className="text-sm font-bold" style={{ color: client.soldeDu > 0 ? '#EF4444' : '#10B981' }}>
            {formatCurrency(client.soldeDu)}
          </p>
        </div>
      </div>

      {/* Bien immobilier */}
      <div className="p-3 rounded-lg" style={{ background: '#F0FDF4', border: '1px solid #D1FAE5' }}>
        <p className="text-xs font-medium mb-1" style={{ color: '#6B7280' }}>
          🏢 Bien immobilier
        </p>
        <p className="text-sm font-semibold" style={{ color: '#0D3B1F' }}>
          {client.bien.building.nom}
        </p>
      </div>

      {/* Indicateur de retard si applicable */}
      {client.joursRetard > 0 && (
        <div className="mt-3 p-2 rounded-lg flex items-center gap-2" style={{ background: '#FEF2F2', border: '1px solid #FEE2E2' }}>
          <AlertTriangle size={16} style={{ color: '#EF4444' }} />
          <p className="text-xs font-medium" style={{ color: '#DC2626' }}>
            {client.joursRetard} jour{client.joursRetard > 1 ? 's' : ''} de retard
          </p>
        </div>
      )}

      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
  )
}

export default ClientBailCard
