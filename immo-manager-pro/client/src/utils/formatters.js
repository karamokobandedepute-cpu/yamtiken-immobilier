// Formatteurs de données

export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return 'N/A'
  const n = Math.round(Number(amount))
  if (isNaN(n)) return 'N/A'
  // Séparateur de milliers = point (ex: 1.800.000 FCFA), compatible jsPDF
  const formatted = n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return formatted + ' FCFA'
}

export const formatDate = (date, options = {}) => {
  if (!date) return 'N/A'
  const defaultOptions = { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric',
    ...options 
  }
  return new Date(date).toLocaleDateString('fr-FR', defaultOptions)
}

export const formatPhone = (phone) => {
  if (!phone) return 'N/A'
  return phone
}

export const getRoleLabel = (role) => {
  const labels = {
    'SUPER_ADMIN': 'Super Administrateur',
    'ADMIN': 'Administrateur',
    'SECRETAIRE': 'Secrétaire',
    'AGENT_RECOUVREMENT': 'Agent Recouvrement',
    'DIRECTION': 'Direction'
  }
  return labels[role] || role
}

export const getRoleBadgeColor = (role) => {
  const colors = {
    'SUPER_ADMIN': 'bg-red-100 text-red-800',
    'ADMIN': 'bg-purple-100 text-purple-800',
    'SECRETAIRE': 'bg-blue-100 text-blue-800',
    'AGENT_RECOUVREMENT': 'bg-orange-100 text-orange-800',
    'DIRECTION': 'bg-gold/20 text-gold'
  }
  return colors[role] || 'bg-gray-100 text-gray-800'
}

export const getStatutBadgeColor = (statut) => {
  const colors = {
    'DISPONIBLE': 'bg-green-100 text-green-800',
    'LOUE': 'bg-blue-100 text-blue-800',
    'VENDU': 'bg-gray-100 text-gray-800',
    'EN_RENOVATION': 'bg-yellow-100 text-yellow-800',
    'RESERVE': 'bg-purple-100 text-purple-800',
    'ACTIF': 'bg-green-100 text-green-800',
    'RESILIE': 'bg-red-100 text-red-800',
    'TERMINE': 'bg-gray-100 text-gray-800',
    'PAYE': 'bg-green-100 text-green-800',
    'EN_RETARD': 'bg-red-100 text-red-800',
    'EN_ATTENTE': 'bg-yellow-100 text-yellow-800',
    'PLANIFIEE': 'bg-blue-100 text-blue-800',
    'TERMINEE': 'bg-green-100 text-green-800',
    'ANNULEE': 'bg-gray-100 text-gray-800'
  }
  return colors[statut] || 'bg-gray-100 text-gray-800'
}

export const getTypeBienLabel = (type) => {
  const labels = {
    'APPARTEMENT': 'Appartement',
    'MAISON': 'Maison',
    'VILLA': 'Villa',
    'STUDIO': 'Studio',
    'BUREAU': 'Bureau',
    'COMMERCE': 'Commerce',
    'ENTREPOT': 'Entrepôt',
    'TERRAIN': 'Terrain'
  }
  return labels[type] || type
}

export const truncateText = (text, maxLength = 50) => {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

// Formatters pour les buildings
export const getTypeBuildingLabel = (type) => {
  const labels = {
    'R2': 'R+2',
    'R3': 'R+3',
    'R4': 'R+4',
    'VILLA': 'Villa',
    'COUR_COMMUNE': 'Cour Commune'
  }
  return labels[type] || type
}

export const getTypeUniteLabel = (type) => {
  const labels = {
    'STUDIO': 'Studio',
    'CHAMBRE': 'Chambre',
    'CHAMBRE_SALON': 'Chambre-Salon',
    'MAGASIN': 'Magasin'
  }
  return labels[type] || type
}

export const getStatutUniteBadgeColor = (statut) => {
  const colors = {
    'OCCUPE': 'bg-green-500 text-white',
    'RESERVE': 'bg-orange-500 text-white',
    'VACANT': 'bg-gray-400 text-white'
  }
  return colors[statut] || 'bg-gray-400 text-white'
}

export const getStatutUniteLabel = (statut) => {
  const labels = {
    'OCCUPE': 'Occupé',
    'RESERVE': 'Réservé',
    'VACANT': 'Vacant'
  }
  return labels[statut] || statut
}

// Formatters pour les types de clients
export const getClientTypeLabel = (type) => {
  const labels = {
    'SOUSCRIPTEUR': 'Souscripteur',
    'CLIENT': 'Client'
  }
  return labels[type] || type
}

export const getClientTypeBadgeStyle = (type) => {
  if (type === 'SOUSCRIPTEUR') {
    return {
      background: '#C8960C',
      color: 'white'
    }
  }
  return {
    background: '#1A6B35',
    color: 'white'
  }
}

// Format date et heure complète (pour factures)
export const formatDateTime = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Formatters pour les motifs de visite
export const getMotifVisiteLabel = (motif) => {
  const labels = {
    'DECOUVERTE': 'Découverte',
    'NEGOCIATION': 'Négociation',
    'RECLAMATION': 'Réclamation',
    'AUTRE': 'Autre'
  }
  return labels[motif] || motif
}

export const getMotifVisiteBadgeStyle = (motif) => {
  const styles = {
    'DECOUVERTE': { background: '#DBEAFE', color: '#1D4ED8' },
    'NEGOCIATION': { background: '#FEF3C7', color: '#92400E' },
    'RECLAMATION': { background: '#FEE2E2', color: '#DC2626' },
    'AUTRE': { background: '#F3F4F6', color: '#4B5563' }
  }
  return styles[motif] || { background: '#F3F4F6', color: '#4B5563' }
}

// Formatters pour les statuts de relance
export const getStatutRelanceLabel = (statut) => {
  const labels = {
    'EN_ATTENTE': 'En attente',
    'EFFECTUEE': 'Effectuée',
    'ANNULEE': 'Annulée'
  }
  return labels[statut] || statut
}

export const getStatutRelanceBadgeStyle = (statut) => {
  if (statut === 'EN_ATTENTE') {
    return { background: '#FEF3C7', color: '#92400E' }
  }
  if (statut === 'EFFECTUEE') {
    return { background: '#DCFCE7', color: '#166534' }
  }
  return { background: '#FEE2E2', color: '#DC2626' }
}

// Formatters pour les types d'alertes
export const getTypeAlerteLabel = (type) => {
  const labels = {
    'PAIEMENT_ECHEANCE': 'Paiement à échéance',
    'BAIL_EXPIRATION': 'Bail expirant',
    'RELANCE_VISITE': 'Relance visite',
    'GENERAL': 'Général'
  }
  return labels[type] || type
}

// Formatters pour les modes de paiement
export const getModePaiementLabel = (mode) => {
  const labels = {
    'ESPECES': 'Espèces',
    'VIREMENT': 'Virement',
    'MOBILE_MONEY': 'Mobile Money',
    'CHEQUE': 'Chèque'
  }
  return labels[mode] || mode
}

// Formatters pour les types de commission
export const getTypeCommissionLabel = (type) => {
  const labels = {
    'FIXE': 'Montant fixe',
    'POURCENTAGE': 'Pourcentage'
  }
  return labels[type] || type
}

// Formatters pour les statuts de commission
export const getStatutCommissionLabel = (statut) => {
  const labels = {
    'EN_ATTENTE': 'En attente',
    'PAYEE': 'Payée'
  }
  return labels[statut] || statut
}

export const getStatutCommissionBadgeStyle = (statut) => {
  if (statut === 'PAYEE') {
    return { background: '#DCFCE7', color: '#166534' }
  }
  return { background: '#FEF3C7', color: '#92400E' }
}

export const getTypeAlerteBadgeStyle = (type) => {
  if (type === 'PAIEMENT_ECHEANCE') {
    return { background: '#FEE2E2', color: '#DC2626' }
  }
  if (type === 'BAIL_EXPIRATION') {
    return { background: '#FEF3C7', color: '#92400E' }
  }
  if (type === 'RELANCE_VISITE') {
    return { background: '#DCFCE7', color: '#166534' }
  }
  return { background: '#DBEAFE', color: '#1D4ED8' }
}
