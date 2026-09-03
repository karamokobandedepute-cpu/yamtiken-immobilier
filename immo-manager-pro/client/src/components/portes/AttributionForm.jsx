// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ATTRIBUTION FORM - React Component
// Remplacement de : lib/features/portes/screens/attribution_portes_screen.dart
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useState, useEffect } from 'react'
import { useAttribuerPortes, useTypesPortes } from '../../hooks/usePortes'
import { DoorOpen, User, Calendar, ArrowRight, Check, AlertCircle, Loader2 } from 'lucide-react'

const TYPE_LABELS = {
  magasin: 'Magasin',
  studio: 'Studio',
  chambre: 'Chambre',
  salon: 'Salon commercial',
  entrepot: 'Entrepôt',
  bureau: 'Bureau'
}

export default function AttributionForm({ clientId, batimentId, typePorteId, onSuccess, onCancel }) {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    batimentId: batimentId || '',
    typePorteId: typePorteId || '',
    quantite: 1,
    dateDebut: new Date().toISOString().split('T')[0],
    notes: ''
  })
  const [selectedType, setSelectedType] = useState(null)
  const [error, setError] = useState(null)
  
  const { data: typesPortes, isLoading: loadingTypes } = useTypesPortes(formData.batimentId)
  const attribuerMutation = useAttribuerPortes()
  
  // Types disponibles uniquement
  const typesDisponibles = typesPortes?.filter(t => t.quantite_disponible > 0) || []
  
  // Calcul loyer
  const loyerEstime = selectedType 
    ? formData.quantite * selectedType.prix_mensuel 
    : 0
  
  const handleNext = () => {
    setError(null)
    if (step === 1 && !formData.batimentId) {
      setError('Veuillez sélectionner un bâtiment')
      return
    }
    if (step === 2 && !formData.typePorteId) {
      setError('Veuillez sélectionner un type de porte')
      return
    }
    if (step === 3) {
      if (formData.quantite < 1) {
        setError('La quantité doit être au moins 1')
        return
      }
      if (selectedType && formData.quantite > selectedType.quantite_disponible) {
        setError(`Stock insuffisant. Disponible: ${selectedType.quantite_disponible}`)
        return
      }
    }
    setStep(s => Math.min(s + 1, 4))
  }
  
  const handleBack = () => {
    setStep(s => Math.max(s - 1, 1))
    setError(null)
  }
  
  const handleSubmit = async () => {
    setError(null)
    try {
      await attribuerMutation.mutateAsync({
        clientId,
        typePorteId: formData.typePorteId,
        quantite: formData.quantite,
        dateDebut: formData.dateDebut,
        notes: formData.notes
      })
      onSuccess?.()
    } catch (err) {
      setError(err.message || 'Erreur lors de l\'attribution')
    }
  }
  
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-FR', { 
      style: 'currency', 
      currency: 'XOF',
      maximumFractionDigits: 0
    }).format(amount)
  }
  
  return (
    <div className="bg-white rounded-lg shadow-lg max-w-lg mx-auto">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Nouvelle Attribution</h2>
        <div className="mt-2 flex items-center gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                s === step ? 'bg-blue-600 text-white' : 
                s < step ? 'bg-green-500 text-white' : 
                'bg-gray-200 text-gray-500'
              }`}>
                {s < step ? <Check className="w-4 h-4" /> : s}
              </div>
              {s < 4 && <div className={`w-8 h-0.5 ${s < step ? 'bg-green-500' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>
      </div>
      
      {/* Content */}
      <div className="p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
        
        {/* Étape 1: Bâtiment */}
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">Sélectionnez un bâtiment</h3>
            {loadingTypes ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : typesDisponibles.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <DoorOpen className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>Aucun bâtiment avec portes disponibles</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {typesDisponibles.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => {
                      setFormData({ ...formData, batimentId: type.batiment_id })
                      setSelectedType(type)
                    }}
                    className={`w-full p-3 rounded-lg border text-left transition-colors ${
                      formData.batimentId === type.batiment_id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="font-medium">{TYPE_LABELS[type.type_nom] || type.type_nom}</div>
                    <div className="text-sm text-gray-500">
                      {type.quantite_disponible} disponible(s) - {formatCurrency(type.prix_mensuel)}/mois
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Étape 2: Type de porte */}
        {step === 2 && (
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">Sélectionnez un type de porte</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {typesDisponibles.map((type) => (
                <button
                  key={type.id}
                  onClick={() => {
                    setFormData({ ...formData, typePorteId: type.id })
                    setSelectedType(type)
                  }}
                  className={`w-full p-3 rounded-lg border text-left transition-colors ${
                    formData.typePorteId === type.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{TYPE_LABELS[type.type_nom] || type.type_nom}</span>
                    <span className={`text-sm ${type.quantite_disponible > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {type.quantite_disponible} dispo
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {formatCurrency(type.prix_mensuel)} / unité / mois
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* Étape 3: Détails */}
        {step === 3 && selectedType && (
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">Détails de l'attribution</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantité (max: {selectedType.quantite_disponible})
              </label>
              <input
                type="number"
                min="1"
                max={selectedType.quantite_disponible}
                value={formData.quantite}
                onChange={(e) => setFormData({ ...formData, quantite: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date de début
              </label>
              <input
                type="date"
                value={formData.dateDebut}
                onChange={(e) => setFormData({ ...formData, dateDebut: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes (optionnel)
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows="3"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Informations complémentaires..."
              />
            </div>
          </div>
        )}
        
        {/* Étape 4: Confirmation */}
        {step === 4 && selectedType && (
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">Confirmer l'attribution</h3>
            
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Type:</span>
                <span className="font-medium">{TYPE_LABELS[selectedType.type_nom]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Quantité:</span>
                <span className="font-medium">{formData.quantite}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Date début:</span>
                <span className="font-medium">{new Date(formData.dateDebut).toLocaleDateString('fr-FR')}</span>
              </div>
              <div className="border-t border-gray-200 my-2" />
              <div className="flex justify-between text-lg">
                <span className="font-medium text-gray-900">Loyer mensuel:</span>
                <span className="font-bold text-green-600">{formatCurrency(loyerEstime)}</span>
              </div>
            </div>
            
            {formData.notes && (
              <div className="p-3 bg-yellow-50 rounded border border-yellow-200">
                <p className="text-sm text-yellow-800">{formData.notes}</p>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-200 flex justify-between">
        {step > 1 ? (
          <button
            onClick={handleBack}
            className="px-4 py-2 text-gray-700 hover:text-gray-900"
          >
            Retour
          </button>
        ) : (
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 hover:text-gray-900"
          >
            Annuler
          </button>
        )}
        
        {step < 4 ? (
          <button
            onClick={handleNext}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            Continuer
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={attribuerMutation.isPending}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"
          >
            {attribuerMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Création...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Confirmer
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
