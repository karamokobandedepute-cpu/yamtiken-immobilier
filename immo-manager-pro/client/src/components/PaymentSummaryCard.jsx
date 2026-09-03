import { User, Home, Calendar, TrendingUp, CheckCircle, AlertTriangle, Clock, Printer, Trash2 } from 'lucide-react'
import { formatCurrency, formatDate } from '../utils/formatters'

const PaymentSummaryCard = ({ clientGroup, onPrint, onDelete }) => {
  const { client, payments, totalPaye, totalDu, resteDu, tauxPaiement } = clientGroup
  
  const getProgressColor = (taux) => {
    if (taux === 100) return '#10B981'
    if (taux >= 75) return '#3B82F6'
    if (taux >= 50) return '#F59E0B'
    return '#EF4444'
  }

  const getStatutColor = () => {
    if (resteDu === 0) return { bg: '#ECFDF5', border: '#10B981', text: '#059669', icon: '#10B981' }
    if (tauxPaiement >= 75) return { bg: '#EFF6FF', border: '#3B82F6', text: '#1D4ED8', icon: '#3B82F6' }
    if (tauxPaiement >= 50) return { bg: '#FEF3C7', border: '#F59E0B', text: '#D97706', icon: '#F59E0B' }
    return { bg: '#FEF2F2', border: '#EF4444', text: '#DC2626', icon: '#EF4444' }
  }

  const progressColor = getProgressColor(tauxPaiement)
  const colors = getStatutColor()
  const dernierPaiement = payments[0] // Le plus récent

  return (
    <div 
      className="bg-white rounded-xl p-4 transition-all duration-300 hover:shadow-lg"
      style={{ border: `2px solid ${colors.border}` }}
    >
      {/* En-tête */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
            style={{ background: colors.bg, color: colors.icon }}
          >
            {client.prenom[0]}{client.nom[0]}
          </div>
          <div>
            <h3 className="font-bold text-sm" style={{ color: '#0D3B1F' }}>
              {client.prenom} {client.nom}
            </h3>
            <p className="text-xs" style={{ color: '#6B7280' }}>
              {payments.length} paiement{payments.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Badge statut */}
        <div 
          className="px-2 py-1 rounded-full text-xs font-bold"
          style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
        >
          {resteDu === 0 ? '✓ Soldé' : `${tauxPaiement.toFixed(0)}%`}
        </div>
      </div>

      {/* Barre de progression */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs font-medium" style={{ color: '#6B7280' }}>
            Progression
          </span>
          <span className="text-xs font-bold" style={{ color: progressColor }}>
            {tauxPaiement.toFixed(1)}%
          </span>
        </div>
        
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full rounded-full transition-all duration-1000 ease-out"
            style={{ 
              width: `${tauxPaiement}%`,
              background: progressColor
            }}
          />
        </div>
      </div>

      {/* Montants */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="text-center p-2 rounded-lg" style={{ background: '#F9FAFB' }}>
          <p className="text-xs mb-1" style={{ color: '#6B7280' }}>Total</p>
          <p className="text-xs font-bold" style={{ color: '#0D3B1F' }}>
            {formatCurrency(totalDu)}
          </p>
        </div>
        <div className="text-center p-2 rounded-lg" style={{ background: '#ECFDF5' }}>
          <p className="text-xs mb-1" style={{ color: '#6B7280' }}>Payé</p>
          <p className="text-xs font-bold" style={{ color: '#10B981' }}>
            {formatCurrency(totalPaye)}
          </p>
        </div>
        <div className="text-center p-2 rounded-lg" style={{ background: resteDu > 0 ? '#FEF2F2' : '#ECFDF5' }}>
          <p className="text-xs mb-1" style={{ color: '#6B7280' }}>Reste</p>
          <p className="text-xs font-bold" style={{ color: resteDu > 0 ? '#EF4444' : '#10B981' }}>
            {formatCurrency(resteDu)}
          </p>
        </div>
      </div>

      {/* Dernier paiement */}
      {dernierPaiement && (
        <div className="p-2 rounded-lg mb-3" style={{ background: '#F0FDF4', border: '1px solid #D1FAE5' }}>
          <div className="flex justify-between items-center text-xs">
            <span style={{ color: '#6B7280' }}>Dernier paiement</span>
            <span className="font-semibold" style={{ color: '#059669' }}>
              {formatCurrency(dernierPaiement.montantVerse)}
            </span>
          </div>
          <div className="flex justify-between items-center text-xs mt-1">
            <span style={{ color: '#9CA3AF' }}>{formatDate(dernierPaiement.datePaiement)}</span>
            <span style={{ color: '#9CA3AF' }}>{dernierPaiement.modePaiement}</span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onPrint(clientGroup)}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium rounded-lg transition-all hover:scale-105"
          style={{ background: '#E8F5EC', color: '#0D3B1F' }}
          title="Imprimer reçu"
        >
          <Printer size={14} />
          Imprimer
        </button>
        <button
          onClick={() => onDelete(payments[0])}
          className="px-3 py-2 rounded-lg transition-all hover:scale-105"
          style={{ background: '#FEE2E2', color: '#DC2626' }}
          title="Supprimer"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

export default PaymentSummaryCard
