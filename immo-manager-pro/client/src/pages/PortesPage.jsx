// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PORTES PAGE - React Page
// Remplacement de : lib/features/portes/screens/gestion_portes_screen.dart
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTypesPortes, useBatimentStock, usePortesRealtime } from '../hooks/usePortes'
import TypePorteCard from '../components/portes/TypePorteCard'
import AttributionCard from '../components/portes/AttributionCard'
import AttributionForm from '../components/portes/AttributionForm'
import { 
  Building2, 
  DoorOpen, 
  Plus, 
  TrendingUp, 
  AlertCircle,
  Loader2,
  Search
} from 'lucide-react'

export default function PortesPage({ batimentNom }) {
  const { batimentId } = useParams()
  const [activeTab, setActiveTab] = useState('stock')
  const [showAttributionForm, setShowAttributionForm] = useState(false)
  const [selectedTypePorte, setSelectedTypePorte] = useState(null)
  
  // React Query hooks
  const { data: typesPortes, isLoading: loadingTypes, error: errorTypes } = useTypesPortes(batimentId)
  const { data: stock, isLoading: loadingStock } = useBatimentStock(batimentId)
  
  // Realtime subscription
  usePortesRealtime('type_portes', () => {
    console.log('[PortesPage] Types de portes mis à jour en temps réel')
  })
  
  // Stats
  const totalPortes = typesPortes?.reduce((acc, t) => acc + t.quantite_totale, 0) || 0
  const portesDisponibles = typesPortes?.reduce((acc, t) => acc + t.quantite_disponible, 0) || 0
  const portesAttribuees = totalPortes - portesDisponibles
  const revenuTotal = typesPortes?.reduce((acc, t) => {
    const attribuees = t.quantite_totale - t.quantite_disponible
    return acc + (attribuees * t.prix_mensuel)
  }, 0) || 0
  
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-FR', { 
      style: 'currency', 
      currency: 'XOF',
      maximumFractionDigits: 0
    }).format(amount)
  }
  
  if (loadingTypes || loadingStock) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }
  
  if (errorTypes) {
    return (
      <div className="flex items-center justify-center h-96 text-red-600">
        <AlertCircle className="w-6 h-6 mr-2" />
        Erreur de chargement
      </div>
    )
  }
  
  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Building2 className="w-6 h-6" />
          {batimentNom || 'Gestion des Portes'}
        </h1>
        <p className="text-gray-500 mt-1">Gérez les attributions et suivez les revenus</p>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600">Total Portes</p>
              <p className="text-2xl font-bold text-blue-900">{totalPortes}</p>
            </div>
            <DoorOpen className="w-8 h-8 text-blue-400" />
          </div>
        </div>
        
        <div className="bg-green-50 p-4 rounded-lg border border-green-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600">Disponibles</p>
              <p className="text-2xl font-bold text-green-900">{portesDisponibles}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-green-200 flex items-center justify-center">
              <span className="text-green-700 text-sm">✓</span>
            </div>
          </div>
        </div>
        
        <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-orange-600">Attribuées</p>
              <p className="text-2xl font-bold text-orange-900">{portesAttribuees}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-orange-200 flex items-center justify-center">
              <span className="text-orange-700 text-sm">👤</span>
            </div>
          </div>
        </div>
        
        <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-600">Revenu Mensuel</p>
              <p className="text-lg font-bold text-purple-900">{formatCurrency(revenuTotal)}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-purple-400" />
          </div>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('stock')}
            className={`pb-3 px-1 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'stock'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Stock des portes
          </button>
          <button
            onClick={() => setActiveTab('attributions')}
            className={`pb-3 px-1 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'attributions'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Attributions actives
          </button>
        </div>
      </div>
      
      {/* Content */}
      {activeTab === 'stock' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Types de portes</h2>
            <button
              onClick={() => setShowAttributionForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Ajouter un type
            </button>
          </div>
          
          {typesPortes?.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <DoorOpen className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">Aucun type de porte configuré</p>
              <button
                onClick={() => setShowAttributionForm(true)}
                className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
              >
                Créer le premier type →
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {typesPortes?.map((typePorte) => (
                <TypePorteCard
                  key={typePorte.id}
                  typePorte={typePorte}
                  onAttribuer={(type) => {
                    setSelectedTypePorte(type)
                    setShowAttributionForm(true)
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
      
      {activeTab === 'attributions' && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Attributions actives</h2>
          {/* Ici on afficherait les attributions via un autre composant */}
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-500">Sélectionnez un type de porte pour voir les attributions</p>
          </div>
        </div>
      )}
      
      {/* Modal Attribution Form */}
      {showAttributionForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="max-w-lg w-full">
            <AttributionForm
              batimentId={batimentId}
              typePorteId={selectedTypePorte?.id}
              onSuccess={() => {
                setShowAttributionForm(false)
                setSelectedTypePorte(null)
              }}
              onCancel={() => {
                setShowAttributionForm(false)
                setSelectedTypePorte(null)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
