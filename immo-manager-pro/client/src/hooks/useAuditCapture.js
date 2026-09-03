import { useCallback, useEffect } from 'react'
import { useAudit, AUDIT_ACTIONS, SEVERITY } from '../contexts/AuditContext'

/**
 * 🔒 HOOK useAuditCapture - Capture automatique des actions CRUD
 * 
 * Usage:
 * const { captureCreate, captureUpdate, captureDelete, captureView } = useAuditCapture('Client')
 * 
 * captureCreate(newClient) // Log automatique
 * captureUpdate(oldClient, newClient) // Log avec diff
 * captureDelete(clientId) // Log suppression
 */

export const useAuditCapture = (entityType) => {
  const { logAction } = useAudit()

  /**
   * 📝 Log création
   */
  const captureCreate = useCallback((entity, metadata = {}) => {
    return logAction({
      action: AUDIT_ACTIONS.CREATE,
      severity: SEVERITY.INFO,
      entityType,
      entityId: entity?.id || entity?._id,
      payload: { data: sanitizePayload(entity) },
      metadata
    })
  }, [logAction, entityType])

  /**
   * 📝 Log mise à jour (avec données avant/après)
   */
  const captureUpdate = useCallback((before, after, metadata = {}) => {
    const changes = computeDiff(before, after)
    
    return logAction({
      action: AUDIT_ACTIONS.UPDATE,
      severity: changes.includes('password') || changes.includes('secret') 
        ? SEVERITY.WARNING 
        : SEVERITY.INFO,
      entityType,
      entityId: after?.id || after?._id,
      payload: { 
        before: sanitizePayload(before), 
        after: sanitizePayload(after),
        changes
      },
      metadata
    })
  }, [logAction, entityType])

  /**
   * 🗑️ Log suppression
   */
  const captureDelete = useCallback((entityId, entityData = null, metadata = {}) => {
    return logAction({
      action: AUDIT_ACTIONS.DELETE,
      severity: SEVERITY.WARNING, // Suppression = avertissement
      entityType,
      entityId,
      payload: { deletedData: entityData ? sanitizePayload(entityData) : null },
      metadata
    })
  }, [logAction, entityType])

  /**
   * 👁️ Log consultation
   */
  const captureView = useCallback((entityId, metadata = {}) => {
    return logAction({
      action: AUDIT_ACTIONS.VIEW,
      severity: SEVERITY.INFO,
      entityType,
      entityId,
      metadata
    })
  }, [logAction, entityType])

  /**
   * 📤 Log export
   */
  const captureExport = useCallback((count, format = 'JSON', metadata = {}) => {
    return logAction({
      action: AUDIT_ACTIONS.EXPORT,
      severity: count > 100 ? SEVERITY.WARNING : SEVERITY.INFO, // Export massif = warning
      entityType,
      payload: { count, format, timestamp: Date.now() },
      metadata
    })
  }, [logAction, entityType])

  /**
   * ❌ Log erreur
   */
  const captureError = useCallback((error, metadata = {}) => {
    return logAction({
      action: AUDIT_ACTIONS.ERROR,
      severity: SEVERITY.CRITICAL,
      entityType,
      payload: { 
        error: error?.message || error,
        stack: error?.stack,
        timestamp: Date.now()
      },
      metadata
    })
  }, [logAction, entityType])

  return {
    captureCreate,
    captureUpdate,
    captureDelete,
    captureView,
    captureExport,
    captureError
  }
}

/**
 * 🔒 Hook pour capturer les tentatives d'accès interdit
 */
export const useAuditAccess = () => {
  const { logAccessDenied } = useAudit()

  const checkAccess = useCallback((hasAccess, resource, reason = 'Permission insuffisante') => {
    if (!hasAccess) {
      logAccessDenied(resource, reason)
      return false
    }
    return true
  }, [logAccessDenied])

  return { checkAccess, logAccessDenied }
}

/**
 * 🔐 Hook pour capturer login/logout
 */
export const useAuditAuth = () => {
  const { logAction } = useAudit()

  const captureLogin = useCallback((user, success = true, metadata = {}) => {
    return logAction({
      action: AUDIT_ACTIONS.LOGIN,
      severity: success ? SEVERITY.INFO : SEVERITY.WARNING,
      payload: { 
        success,
        userId: user?.id,
        email: user?.email,
        role: user?.role
      },
      metadata
    })
  }, [logAction])

  const captureLogout = useCallback((user, metadata = {}) => {
    return logAction({
      action: AUDIT_ACTIONS.LOGOUT,
      severity: SEVERITY.INFO,
      payload: { 
        userId: user?.id,
        email: user?.email
      },
      metadata
    })
  }, [logAction])

  return { captureLogin, captureLogout }
}

/**
 * 📝 Hook pour wrapper automatiquement les appels API
 */
export const useAuditAPI = () => {
  const { captureCreate, captureUpdate, captureDelete, captureError } = useAuditCapture('API')

  const wrapAPICall = useCallback(async (apiCall, options = {}) => {
    const { action, entityType, onSuccess, onError } = options
    
    try {
      const result = await apiCall()
      
      // Log selon l'action
      if (action === 'create') {
        captureCreate(result.data, { source: 'API' })
      } else if (action === 'update') {
        captureUpdate(options.before, result.data, { source: 'API' })
      } else if (action === 'delete') {
        captureDelete(options.entityId, options.before, { source: 'API' })
      }
      
      if (onSuccess) onSuccess(result)
      return result
      
    } catch (error) {
      captureError(error, { action, source: 'API' })
      if (onError) onError(error)
      throw error
    }
  }, [captureCreate, captureUpdate, captureDelete, captureError])

  return { wrapAPICall }
}

/**
 * 🎯 Hook pour tracker automatiquement les vues de page
 */
export const useAuditPageView = (pageName, metadata = {}) => {
  const { logAction } = useAudit()

  useEffect(() => {
    logAction({
      action: AUDIT_ACTIONS.VIEW,
      severity: SEVERITY.INFO,
      payload: { page: pageName, ...metadata },
      metadata: { timestamp: Date.now() }
    })
  }, [pageName]) // Log une fois au chargement
}

// ============================================
// UTILITAIRES INTERNES
// ============================================

/**
 * 🔒 Nettoyer le payload (retirer données sensibles)
 */
const sanitizePayload = (data) => {
  if (!data || typeof data !== 'object') return data
  
  const sensitiveFields = ['password', 'motDePasse', 'token', 'secret', 'creditCard', 'cvv', 'ssn']
  
  const sanitized = { ...data }
  
  sensitiveFields.forEach(field => {
    if (field in sanitized) {
      sanitized[field] = '***REDACTED***'
    }
  })
  
  return sanitized
}

/**
 * 📊 Calculer les différences entre deux objets
 */
const computeDiff = (before, after) => {
  if (!before || !after) return []
  
  const changes = []
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)])
  
  allKeys.forEach(key => {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changes.push(key)
    }
  })
  
  return changes
}

// Ré-exporter pour faciliter l'import
export { AUDIT_ACTIONS, SEVERITY }

export default useAuditCapture
