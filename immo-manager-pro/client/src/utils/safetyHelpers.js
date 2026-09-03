/**
 * 🛡️ PROTECTION UNIVERSELLE CONTRE LES CRASHS
 * Utiliser ces fonctions partout dans l'application
 */

/**
 * Map sécurisé - Ne crashe JAMAIS
 * @param {Array} array - Tableau à mapper (peut être null/undefined)
 * @param {Function} callback - Fonction de mapping
 * @returns {Array} - Tableau mappé ou tableau vide
 */
export const safeMap = (array, callback) => {
  if (!Array.isArray(array)) {
    console.warn('⚠️ safeMap: array is not an array:', array)
    return []
  }
  return array.map(callback)
}

/**
 * Filter sécurisé - Ne crashe JAMAIS
 */
export const safeFilter = (array, callback) => {
  if (!Array.isArray(array)) {
    console.warn('⚠️ safeFilter: array is not an array:', array)
    return []
  }
  return array.filter(callback)
}

/**
 * Find sécurisé - Ne crashe JAMAIS
 */
export const safeFind = (array, callback) => {
  if (!Array.isArray(array)) {
    console.warn('⚠️ safeFind: array is not an array:', array)
    return null
  }
  return array.find(callback) || null
}

/**
 * Accès sécurisé aux propriétés profondes
 * @param {Object} obj - Objet source
 * @param {String} path - Chemin (ex: 'data.user.name')
 * @param {*} defaultValue - Valeur par défaut
 */
export const safeGet = (obj, path, defaultValue = null) => {
  try {
    const keys = path.split('.')
    let result = obj
    
    for (const key of keys) {
      if (result === null || result === undefined) {
        return defaultValue
      }
      result = result[key]
    }
    
    return result !== undefined ? result : defaultValue
  } catch (error) {
    console.warn('⚠️ safeGet error:', error)
    return defaultValue
  }
}

/**
 * Extraction sécurisée des données API
 */
export const extractApiData = (response, defaultValue = []) => {
  // Essayer plusieurs formats de réponse
  return (
    response?.data?.data ||
    response?.data ||
    response ||
    defaultValue
  )
}

/**
 * Message d'erreur sécurisé
 */
export const getErrorMessage = (error, defaultMessage = 'Une erreur est survenue') => {
  return (
    error?.response?.data?.message ||
    error?.message ||
    defaultMessage
  )
}

/**
 * Vérifier si une valeur est vide
 */
export const isEmpty = (value) => {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return Object.keys(value).length === 0
  return false
}

/**
 * Formater une valeur avec fallback
 */
export const formatWithFallback = (value, formatter, fallback = 'N/A') => {
  if (isEmpty(value)) return fallback
  try {
    return formatter(value)
  } catch (error) {
    console.warn('⚠️ formatWithFallback error:', error)
    return fallback
  }
}
