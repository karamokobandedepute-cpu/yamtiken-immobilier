// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPE PORTE CARD - React Component
// Remplacement de : lib/features/portes/models/type_porte_model.dart + UI
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useState } from 'react'
import { DoorOpen, Edit2, Trash2, Store, Home, Bed, Sofa, Warehouse, Building } from 'lucide-react'

const TYPE_ICONS = {
  magasin: Store,
  studio: Home,
  chambre: Bed,
  salon: Sofa,
  entrepot: Warehouse,
  bureau: Building
}

const TYPE_LABELS = {
  magasin: 'Magasin',
  studio: 'Studio',
  chambre: 'Chambre',
  salon: 'Salon commercial',
  entrepot: 'Entrepôt',
  bureau: 'Bureau'
}

export default function TypePorteCard({ typePorte, onEdit, onDelete, onAttribuer }) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  const {
    id,
    type_nom,
    quantite_totale,
    quantite_disponible,
    prix_mensuel,
    surface_m2,
    description
  } = typePorte
  
  const quantiteAttribuee = quantite_totale - quantite_disponible
  const tauxOccupation = quantite_totale > 0 ? (quantiteAttribuee / quantite_totale) * 100 : 0
  const revenuMensuel = quantiteAttribuee * prix_mensuel
  const revenuPotentiel = quantite_totale * prix_mensuel
  
  const IconComponent = TYPE_ICONS[type_nom] || DoorOpen
  const isDisponible = quantite_disponible > 0
  const isPlein = quantite_disponible === 0 && quantite_totale > 0
  
  // Couleur selon disponibilité
  const getDisponibiliteColor = () => {
    if (quantite_disponible > quantite_totale * 0.5) return 'bg-green-500'
    if (quantite_disponible > quantite_totale * 0.2) return 'bg-yellow-500'
    return 'bg-red-500'
  }
  
  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isPlein ? 'bg-red-100' : isDisponible ? 'bg-blue-100' : 'bg-gray-100'}`}>
              <IconComponent className={`w-6 h-6 ${isPlein ? 'text-red-600' : isDisponible ? 'text-blue-600' : 'text-gray-600'}`} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{TYPE_LABELS[type_nom] || type_nom}</h3>
              <p className="text-sm text-gray-500">
                {quantite_disponible} / {quantite_totale} disponible{quantite_disponible > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          
          {/* Badges */}
          <div className="flex flex-col items-end gap-1">
            {isPlein && (
              <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded">
                COMPLET
              </span>
            )}
            {surface_m2 > 0 && (
              <span className="text-xs text-gray-500">{surface_m2} m²</span>
            )}
          </div>
        </div>
        
        {/* Barre de progression */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{quantiteAttribuee} occupé(s)</span>
            <span>{tauxOccupation.toFixed(1)}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${getDisponibiliteColor()}`}
              style={{ width: `${tauxOccupation}%` }}
            />
          </div>
        </div>
        
        {/* Prix */}
        <div className="mt-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">Prix unitaire</p>
            <p className="font-semibold text-gray-900">
              {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(prix_mensuel)}
              <span className="text-xs font-normal text-gray-500">/mois</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Revenu actuel</p>
            <p className="font-semibold text-green-600">
              {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(revenuMensuel)}
            </p>
          </div>
        </div>
        
        {/* Description */}
        {description && (
          <p className="mt-2 text-sm text-gray-600 line-clamp-2">{description}</p>
        )}
      </div>
      
      {/* Actions */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex gap-2">
        <button
          onClick={() => onAttribuer?.(typePorte)}
          disabled={!isDisponible}
          className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
            isDisponible 
              ? 'bg-green-600 text-white hover:bg-green-700' 
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isDisponible ? 'Attribuer' : 'Complet'}
        </button>
        
        <button
          onClick={() => onEdit?.(typePorte)}
          className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
        >
          <Edit2 className="w-4 h-4" />
        </button>
        
        <button
          onClick={() => onDelete?.(id)}
          className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
