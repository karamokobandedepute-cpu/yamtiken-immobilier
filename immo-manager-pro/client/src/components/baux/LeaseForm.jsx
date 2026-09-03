// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LEASE FORM - Formulaire de création/édition de bail
// Synchronisation temps réel avec le serveur
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useState, useEffect } from 'react'
import { useCreateLease, useUpdateLease } from '../../hooks/useLeases'
import { useCreateClient } from '../../hooks/useClients'
import { X, Save, Loader2, FileText, User, Calendar, DollarSign, Home, Plus, UserPlus } from 'lucide-react'

const STATUT_OPTIONS = [
  { value: 'actif', label: 'Actif', color: 'bg-green-100 text-green-700' },
  { value: 'en_cours', label: 'En cours', color: 'bg-blue-100 text-blue-700' },
  { value: 'expire', label: 'Expiré', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'resilie', label: 'Résilié', color: 'bg-red-100 text-red-700' }
]

export default function LeaseForm({ lease = null, clients = [], isLoadingClients = false, onClose, onSuccess }) {
  const isEditing = !!lease
  
  const [formData, setFormData] = useState({
    clientId: '',
    bienId: '',
    dateDebut: new Date().toISOString().split('T')[0],
    dateFin: '',
    montantInitial: '',
    montantLoyer: '',
    caution: '',
    statut: 'en_cours',
    notes: ''
  })
  
  const [errors, setErrors] = useState({})
  const [showNewClientForm, setShowNewClientForm] = useState(false)
  const [createdClientLocal, setCreatedClientLocal] = useState(null)
  const [newClient, setNewClient] = useState({
    prenom: '',
    nom: '',
    telephone: ''
  })
  
  const createLease = useCreateLease()
  const updateLease = useUpdateLease()
  const createClientMutation = useCreateClient()

  // Fonction pour créer un client et le sélectionner
  const handleCreateClient = async () => {
    if (!newClient.prenom || !newClient.nom || !newClient.telephone) {
      return
    }
    
    try {
      const createdClient = await createClientMutation.mutateAsync({
        prenom: newClient.prenom,
        nom: newClient.nom,
        telephone: newClient.telephone
      })
      
      setCreatedClientLocal(createdClient)
      // Sélectionner automatiquement le nouveau client
      setFormData({ ...formData, clientId: createdClient.id.toString() })
      setShowNewClientForm(false)
      setNewClient({ prenom: '', nom: '', telephone: '' })
    } catch (error) {
      console.error('Erreur création client:', error)
    }
  }
  
  // Remplir le formulaire si en mode édition
  useEffect(() => {
    if (lease) {
      setFormData({
        clientId: lease.clientId?.toString() || '',
        bienId: lease.bienId?.toString() || '',
        dateDebut: lease.dateDebut?.split('T')[0] || '',
        dateFin: lease.dateFin?.split('T')[0] || '',
        montantInitial: lease.montantInitial?.toString() || '',
        montantLoyer: lease.montantLoyer?.toString() || '',
        caution: lease.caution?.toString() || '',
        statut: lease.statut || 'en_cours',
        notes: lease.notes || ''
      })
    }
  }, [lease])
  
  const validate = () => {
    const newErrors = {}
    
    if (!formData.clientId) newErrors.clientId = 'Client requis'
    if (!formData.dateDebut) newErrors.dateDebut = 'Date de début requise'
    if (!formData.montantInitial || parseFloat(formData.montantInitial) <= 0) {
      newErrors.montantInitial = 'Montant initial invalide'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validate()) return
    
    const data = {
      ...formData,
      clientId: parseInt(formData.clientId),
      bienId: formData.bienId ? parseInt(formData.bienId) : null,
      montantInitial: parseFloat(formData.montantInitial),
      montantLoyer: parseFloat(formData.montantLoyer) || 0,
      caution: parseFloat(formData.caution) || 0
    }
    
    try {
      if (isEditing) {
        await updateLease.mutateAsync({ id: lease.id, ...data })
      } else {
        await createLease.mutateAsync(data)
      }
      onSuccess?.()
      onClose?.()
    } catch (error) {
      console.error('Erreur sauvegarde bail:', error)
    }
  }
  
  const isLoading = createLease.isPending || updateLease.isPending
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">
              {isEditing ? 'Modifier le bail' : 'Nouveau bail'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="space-y-6">
            {/* Client */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  <User className="w-4 h-4 inline mr-1" />
                  Client *
                </label>
                <button
                  type="button"
                  onClick={() => setShowNewClientForm(!showNewClientForm)}
                  className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  {showNewClientForm ? 'Annuler' : (
                    <>
                      <Plus className="w-4 h-4" />
                      Nouveau client
                    </>
                  )}
                </button>
              </div>
              
              {isLoadingClients ? (
                <div className="flex items-center gap-2 text-gray-500 py-3">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Chargement des clients...</span>
                </div>
              ) : showNewClientForm ? (
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-3">
                  <p className="text-sm text-blue-700 font-medium">Créer un nouveau client</p>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={newClient.prenom}
                      onChange={(e) => setNewClient({...newClient, prenom: e.target.value})}
                      placeholder="Prénom *"
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <input
                      type="text"
                      value={newClient.nom}
                      onChange={(e) => setNewClient({...newClient, nom: e.target.value})}
                      placeholder="Nom *"
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <input
                    type="tel"
                    value={newClient.telephone}
                    onChange={(e) => setNewClient({...newClient, telephone: e.target.value})}
                    placeholder="Téléphone *"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleCreateClient}
                    disabled={!newClient.prenom || !newClient.nom || !newClient.telephone || createClientMutation.isPending}
                    className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {createClientMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Création...
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        Créer et sélectionner
                      </>
                    )}
                  </button>
                </div>
              ) : (() => {
                const displayClients = [...clients];
                if (createdClientLocal && !displayClients.some(c => c.id === createdClientLocal.id)) {
                  displayClients.unshift(createdClientLocal);
                }
                
                return (
                <>
                  <select
                    value={formData.clientId}
                    onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.clientId ? 'border-red-500' : 'border-gray-300'
                    }`}
                    disabled={displayClients.length === 0}
                  >
                    <option value="">
                      {displayClients.length === 0 ? 'Aucun client disponible' : 'Sélectionnez un client'}
                    </option>
                    {displayClients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.prenom} {client.nom} - {client.telephone}
                      </option>
                    ))}
                  </select>
                  {displayClients.length === 0 && !isLoadingClients && (
                    <p className="mt-1 text-sm text-amber-600">
                      Cliquez sur "Nouveau client" pour en créer un
                    </p>
                  )}
                  {errors.clientId && (
                    <p className="mt-1 text-sm text-red-600">{errors.clientId}</p>
                  )}
                </>
                );
              })()}
            </div>
            
            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Date de début *
                </label>
                <input
                  type="date"
                  value={formData.dateDebut}
                  onChange={(e) => setFormData({ ...formData, dateDebut: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.dateDebut ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.dateDebut && (
                  <p className="mt-1 text-sm text-red-600">{errors.dateDebut}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Date de fin
                </label>
                <input
                  type="date"
                  value={formData.dateFin}
                  onChange={(e) => setFormData({ ...formData, dateFin: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            
            {/* Montants */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <DollarSign className="w-4 h-4 inline mr-1" />
                  Montant initial *
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={formData.montantInitial}
                  onChange={(e) => setFormData({ ...formData, montantInitial: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.montantInitial ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="0"
                />
                {errors.montantInitial && (
                  <p className="mt-1 text-sm text-red-600">{errors.montantInitial}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Loyer mensuel
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={formData.montantLoyer}
                  onChange={(e) => setFormData({ ...formData, montantLoyer: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Caution
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={formData.caution}
                  onChange={(e) => setFormData({ ...formData, caution: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0"
                />
              </div>
            </div>
            
            {/* Statut */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Statut
              </label>
              <div className="flex gap-2 flex-wrap">
                {STATUT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, statut: option.value })}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      formData.statut === option.value
                        ? option.color + ' ring-2 ring-offset-2 ring-blue-500'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Informations complémentaires..."
              />
            </div>
          </div>
        </form>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sauvegarde...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {isEditing ? 'Mettre à jour' : 'Créer le bail'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
