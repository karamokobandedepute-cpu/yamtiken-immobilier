// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ATTRIBUTION CARD - React Component
// Remplacement de : lib/features/portes/models/attribution_model.dart + UI
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useState } from 'react'
import { Calendar, DoorOpen, MapPin, User, X, AlertCircle } from 'lucide-react'

const STATUT_LABELS = {
  actif: 'Actif',
  resilie: 'Résilié',
  suspendu: 'Suspendu',
  en_attente: 'En attente'
}

const STATUT_COLORS = {
  actif: 'bg-green-100 text-green-700 border-green-200',
  resilie: 'bg-red-100 text-red-700 border-red-200',
  suspendu: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  en_attente: 'bg-blue-100 text-blue-700 border-blue-200'
}

export default function AttributionCard({ attribution, onResilier, onModifier }) {
  const [showDetails, setShowDetails] = useState(false)
  
  const {
    id,
    quantite,
    date_debut,
    date_fin,
    statut,
    notes,
    montant_mensuel,
    type_porte,
    batiment
  } = attribution
  
  const isActif = statut === 'actif'
  const dateDebut = new Date(date_debut)
  const dateFin = date_fin ? new Date(date_fin) : null
  
  const formatDate = (date) => {
    return new Intl.DateTimeFormat('fr-FR', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    }).format(date)
  }
  
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-FR', { 
      style: 'currency', 
      currency: 'XOF',
      maximumFractionDigits: 0
    }).format(amount)
  }
  
  return (
    <div className={`bg-white rounded-lg shadow-md border overflow-hidden ${isActif ? 'border-gray-200' : 'border-gray-300 opacity-75'}`}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isActif ? 'bg-green-100' : 'bg-gray-100'}`}>
              <DoorOpen className={`w-5 h-5 ${isActif ? 'text-green-600' : 'text-gray-500'}`} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">
                {quantite} {type_porte?.type_nom || 'porte(s)'}
              </h3>
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <MapPin className="w-3 h-3" />
                <span>{batiment?.nom || 'Bâtiment'}</span>
              </div>
            </div>
          </div>
          
          <span className={`px-2 py-1 text-xs font-medium rounded border ${STATUT_COLORS[statut] || 'bg-gray-100 text-gray-700'}`}>
            {STATUT_LABELS[statut] || statut}
          </span>
        </div>
        
        {/* Loyer */}
        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Loyer mensuel</span>
            <span className="font-bold text-gray-900">{formatCurrency(montant_mensuel)}</span>
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {formatCurrency(type_porte?.prix_mensuel || 0)} × {quantite} unité{quantite > 1 ? 's' : ''}
          </div>
        </div>
        
        {/* Dates */}
        <div className="mt-3 flex items-center gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            <span>Début: {formatDate(dateDebut)}</span>
          </div>
          {dateFin && (
            <div className="flex items-center gap-1 text-red-600">
              <X className="w-4 h-4" />
              <span>Fin: {formatDate(dateFin)}</span>
            </div>
          )}
        </div>
        
        {/* Notes */}
        {notes && (
          <div className="mt-3 p-2 bg-yellow-50 rounded border border-yellow-200">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5" />
              <p className="text-sm text-yellow-800">{notes}</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Actions */}
      {isActif && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex gap-2">
          <button
            onClick={() => onModifier?.(attribution)}
            className="flex-1 py-2 px-3 bg-white border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Modifier quantité
          </button>
          <button
            onClick={() => onResilier?.(id)}
            className="flex-1 py-2 px-3 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors"
          >
            Résilier
          </button>
        </div>
      )}
    </div>
  )
}
