import api from './api'

/**
 * Configuration des dépendances entre tables
 * Définit quelles tables dépendent de quelles autres tables
 */
const DEPENDENCY_MAP = {
  clients: [
    { table: 'leases', foreignKey: 'clientId', label: 'baux actifs' },
    { table: 'payments', foreignKey: 'clientId', label: 'paiements associés' },
    { table: 'visites', foreignKey: 'nomVisiteur', label: 'visites enregistrées', isNameMatch: true },
    { table: 'commissions', foreignKey: 'referrerId', label: 'commissions', condition: (client) => client.referrerId }
  ],
  buildings: [
    { table: 'unites', foreignKey: 'buildingId', label: 'unités' },
    { table: 'leases', foreignKey: 'buildingId', label: 'baux associés', through: 'unites' }
  ],
  unites: [
    { table: 'leases', foreignKey: 'uniteId', label: 'baux actifs' }
  ],
  leases: [
    { table: 'payments', foreignKey: 'leaseId', label: 'paiements' },
    { table: 'relances', foreignKey: 'leaseId', label: 'relances en cours' }
  ],
  referrers: [
    { table: 'clients', foreignKey: 'referrerId', label: 'clients apportés' },
    { table: 'commissions', foreignKey: 'referrerId', label: 'commissions enregistrées' }
  ],
  users: [
    { table: 'visites', foreignKey: 'responsable', label: 'visites assignées', isNameMatch: true },
    { table: 'relances', foreignKey: 'agentId', label: 'relances traitées' },
    { table: 'payments', foreignKey: 'agentId', label: 'paiements enregistrés' },
    { table: 'audit_logs', foreignKey: 'userId', label: 'actions dans l\'historique' }
  ]
}

/**
 * Vérifie les dépendances d'un élément avant suppression
 * @param {string} tableName - Nom de la table (clients, buildings, etc.)
 * @param {number|string} id - ID de l'élément
 * @param {Object} itemData - Données complètes de l'élément (optionnel)
 * @returns {Promise<{canDelete: boolean, dependencies: Array, warnings: Array}>}
 */
export const checkDependencies = async (tableName, id, itemData = null) => {
  const dependencies = []
  const warnings = []

  const deps = DEPENDENCY_MAP[tableName]
  if (!deps) {
    return { canDelete: true, dependencies: [], warnings: [] }
  }

  // Vérifier chaque dépendance
  for (const dep of deps) {
    try {
      // Si une condition existe et qu'elle n'est pas remplie, ignorer cette dépendance
      if (dep.condition && itemData && !dep.condition(itemData)) {
        continue
      }

      let url = `/${dep.table}?${dep.foreignKey}=${id}`
      
      // Pour les correspondances par nom
      if (dep.isNameMatch && itemData) {
        const nameValue = itemData.nom || itemData.name || itemData.prenom
        if (nameValue) {
          url = `/${dep.table}?search=${encodeURIComponent(nameValue)}`
        }
      }

      const response = await api.get(url)
      const items = response.data?.data || response.data || []
      const count = items.length

      if (count > 0) {
        dependencies.push({
          table: dep.table,
          count,
          label: dep.label,
          items: items.slice(0, 5), // Limiter à 5 items pour l'affichage
          canCascade: dep.table !== 'payments' && dep.table !== 'audit_logs'
        })
      }
    } catch (error) {
      console.warn(`Erreur vérification dépendance ${dep.table}:`, error)
      warnings.push(`Impossible de vérifier les ${dep.label}`)
    }
  }

  const canDelete = dependencies.length === 0 || 
    dependencies.every(d => d.canCascade)

  return {
    canDelete,
    dependencies,
    warnings,
    totalDependents: dependencies.reduce((sum, d) => sum + d.count, 0)
  }
}

/**
 * Effectue une suppression sécurisée avec vérification
 * @param {string} tableName - Nom de la table
 * @param {number|string} id - ID de l'élément
 * @param {Object} options - Options de suppression
 */
export const safeDelete = async (tableName, id, options = {}) => {
  const {
    itemData = null,
    force = false, // Force la suppression même avec dépendances
    cascade = false, // Supprime aussi les dépendances
    onProgress = null // Callback de progression
  } = options

  // Étape 1: Vérifier les dépendances
  if (onProgress) onProgress({ step: 'checking', message: 'Vérification des dépendances...' })
  
  const check = await checkDependencies(tableName, id, itemData)
  
  if (!check.canDelete && !force) {
    return {
      success: false,
      error: 'DEPENDENCIES_FOUND',
      message: `Impossible de supprimer : ${check.totalDependents} dépendance(s) trouvée(s)`,
      details: check
    }
  }

  // Étape 2: Suppression en cascade si demandé
  if (cascade && check.dependencies.length > 0) {
    if (onProgress) onProgress({ step: 'cascade', message: 'Suppression des dépendances...' })
    
    for (const dep of check.dependencies) {
      if (dep.canCascade) {
        try {
          await api.delete(`/${dep.table}?${tableName.slice(0, -1)}Id=${id}`)
        } catch (error) {
          console.error(`Erreur suppression cascade ${dep.table}:`, error)
        }
      }
    }
  }

  // Étape 3: Suppression principale (soft delete)
  if (onProgress) onProgress({ step: 'deleting', message: 'Suppression...' })
  
  try {
    // Tentative de soft delete d'abord
    const response = await api.patch(`/${tableName}/${id}`, {
      deletedAt: new Date().toISOString(),
      deletedBy: JSON.parse(localStorage.getItem('auth-storage'))?.state?.user?.id
    })

    return {
      success: true,
      message: 'Suppression effectuée avec succès',
      data: response.data,
      archived: true
    }
  } catch (error) {
    // Si soft delete échoue, tentative hard delete (si autorisé)
    if (force) {
      try {
        await api.delete(`/${tableName}/${id}`)
        return {
          success: true,
          message: 'Suppression définitive effectuée',
          archived: false
        }
      } catch (hardError) {
        return {
          success: false,
          error: 'DELETE_FAILED',
          message: hardError.response?.data?.message || 'Erreur lors de la suppression',
          details: hardError
        }
      }
    }

    return {
      success: false,
      error: 'SOFT_DELETE_FAILED',
      message: error.response?.data?.message || 'Erreur lors de la suppression',
      details: error
    }
  }
}

/**
 * Récupère les éléments supprimés (corbeille)
 * @param {string} tableName - Nom de la table
 */
export const getDeletedItems = async (tableName) => {
  try {
    const response = await api.get(`/${tableName}?deletedAt=not.null`)
    return response.data?.data || response.data || []
  } catch (error) {
    console.error('Erreur récupération corbeille:', error)
    return []
  }
}

/**
 * Restaure un élément supprimé
 * @param {string} tableName - Nom de la table
 * @param {number|string} id - ID de l'élément
 */
export const restoreItem = async (tableName, id) => {
  try {
    const response = await api.patch(`/${tableName}/${id}`, {
      deletedAt: null,
      deletedBy: null,
      restoredAt: new Date().toISOString()
    })

    return {
      success: true,
      message: 'Élément restauré avec succès',
      data: response.data
    }
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || 'Erreur lors de la restauration',
      error
    }
  }
}

/**
 * Suppression définitive (purge)
 * @param {string} tableName - Nom de la table
 * @param {number|string} id - ID de l'élément
 */
export const purgeItem = async (tableName, id) => {
  try {
    await api.delete(`/${tableName}/${id}?force=true`)
    return {
      success: true,
      message: 'Élément définitivement supprimé'
    }
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || 'Erreur lors de la suppression définitive',
      error
    }
  }
}

export default {
  checkDependencies,
  safeDelete,
  getDeletedItems,
  restoreItem,
  purgeItem,
  DEPENDENCY_MAP
}
