// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LEASE CARD - Carte de bail avec synchronisation temps réel
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useState } from 'react'
import { 
  FileText, 
  User, 
  Calendar, 
  CreditCard, 
  TrendingUp, 
  MoreVertical,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock
} from 'lucide-react'

const STATUT_CONFIG = {
  actif: { 
    label: 'Actif', 
    color: 'bg-green-100 text-green-700 border-green-200',
    icon: CheckCircle 
  },
  expire: { 
    label: 'Expiré', 
    color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    icon: Clock 
  },
  resilie: { 
    label: 'Résilié', 
    color: 'bg-red-100 text-red-700 border-red-200',
    icon: XCircle 
  },
  en_cours: { 
    label: 'En cours', 
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: AlertCircle 
  }
}

export default function LeaseCard({ lease, onEdit, onDelete, onUpdateStatut }) {
  const [showMenu, setShowMenu] = useState(false)
  
  const { 
    id,
    numeroBail,
    client,
    dateDebut,
    dateFin,
    statut,
    montantInitial,
    calculs
  } = lease
  
  const statutConfig = STATUT_CONFIG[statut] || STATUT_CONFIG.en_cours
  const StatutIcon = statutConfig.icon
  
  const totalPaye = calculs?.totalPaye || 0
  const resteDu = calculs?.resteDu || (montantInitial - totalPaye)
  const progression = parseFloat(calculs?.progression || 0)
  
  const formatDate = (date) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }
  
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      maximumFractionDigits: 0
    }).format(amount || 0)
  }
  
  const getProgressColor = () => {
    if (progression >= 80) return 'bg-green-500'
    if (progression >= 50) return 'bg-blue-500'
    if (progression >= 20) return 'bg-yellow-500'
    return 'bg-red-500'
  }
  
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{numeroBail}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${statutConfig.color}`}>
                  <StatutIcon className="w-3 h-3" />
                  {statutConfig.label}
                </span>
              </div>
            </div>
          </div>
          
          {/* Menu actions */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            
            {showMenu && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20 py-1">
                  <button
                    onClick={() => { onEdit?.(lease); setShowMenu(false) }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Edit2 className="w-4 h-4" />
                    Modifier
                  </button>
                  
                  {statut !== 'actif' && (
                    <button
                      onClick={() => { onUpdateStatut?.(id, 'actif'); setShowMenu(false) }}
                      className="w-full px-4 py-2 text-left text-sm text-green-600 hover:bg-green-50 flex items-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Activer
                    </button>
                  )}
                  
                  {statut !== 'resilie' && (
                    <button
                      onClick={() => { onUpdateStatut?.(id, 'resilie'); setShowMenu(false) }}
                      className="w-full px-4 py-2 text-left text-sm text-orange-600 hover:bg-orange-50 flex items-center gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      Résilier
                    </button>
                  )}
                  
                  <hr className="my-1" />
                  
                  <button
                    onClick={() => { onDelete?.(id); setShowMenu(false) }}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Supprimer
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Body */}
      <div className="p-4 space-y-3">
        {/* Client */}
        {client && (
          <div className="flex items-center gap-2 text-sm">
            <User className="w-4 h-4 text-gray-400" />
            <span className="font-medium text-gray-900">
              {client.prenom} {client.nom}
            </span>
            <span className="text-gray-500">({client.telephone})</span>
          </div>
        )}
        
        {/* Dates */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1 text-gray-600">
            <Calendar className="w-4 h-4" />
            <span>{formatDate(dateDebut)} → {formatDate(dateFin)}</span>
          </div>
        </div>
        
        {/* Progression paiement */}
        <div className="pt-2">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-600">Progression</span>
            <span className="font-medium text-gray-900">{progression.toFixed(1)}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getProgressColor()}`}
              style={{ width: `${Math.min(progression, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Payé: {formatCurrency(totalPaye)}</span>
            <span>Reste: {formatCurrency(resteDu)}</span>
          </div>
        </div>
        
        {/* Montant total */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-600">Montant total</span>
          </div>
          <span className="font-semibold text-gray-900">{formatCurrency(montantInitial)}</span>
        </div>
      </div>
    </div>
  )
}
