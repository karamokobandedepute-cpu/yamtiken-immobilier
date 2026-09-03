import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

// ============================================================
// SYNC CONTEXT - Gestion d'état global temps réel
// Architecture: Optimistic UI + Conflict Resolution + Offline Support
// ============================================================
const SyncContext = createContext(null)

export const SyncProvider = ({ children }) => {
  const [syncStatus, setSyncStatus] = useState('connected') // connected | syncing | offline | error
  const [lastSync, setLastSync] = useState(null)
  const [pendingChanges, setPendingChanges] = useState([])
  const [syncErrors, setSyncErrors] = useState([])
  
  // File d'attente pour offline (persisté dans localStorage)
  const queueRef = useRef([])
  const isProcessingRef = useRef(false)

  // ============================================================
  // SYNCHRONISATION OPTIMISTIC - Mise à jour UI immédiate
  // ============================================================
  const optimisticUpdate = useCallback((table, operation, data) => {
    const changeId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const change = {
      id: changeId,
      table,
      operation, // 'INSERT', 'UPDATE', 'DELETE'
      data,
      timestamp: new Date().toISOString(),
      status: 'pending', // pending | confirmed | error
      retryCount: 0
    }

    // Ajouter à la file d'attente
    queueRef.current.push(change)
    setPendingChanges([...queueRef.current])

    // 🔄 Tentative de synchronisation immédiate
    processQueue()

    return { changeId, rollback: () => rollbackChange(changeId) }
  }, [])

  // ============================================================
  // TRAITEMENT DE LA FILE D'ATTENTE
  // ============================================================
  const processQueue = useCallback(async () => {
    if (isProcessingRef.current || !navigator.onLine) return
    
    isProcessingRef.current = true
    setSyncStatus('syncing')

    const pending = queueRef.current.filter(c => c.status === 'pending' && c.retryCount < 3)
    
    for (const change of pending) {
      try {
        setSyncStatus('syncing')
        
        // Exécuter l'opération Supabase
        let result
        switch (change.operation) {
          case 'INSERT':
            result = await supabase.from(change.table).insert(change.data).select().single()
            break
          case 'UPDATE':
            result = await supabase.from(change.table).update(change.data).eq('id', change.data.id).select().single()
            break
          case 'DELETE':
            result = await supabase.from(change.table).delete().eq('id', change.data.id)
            break
        }

        if (result.error) throw result.error

        // ✅ Confirmation
        change.status = 'confirmed'
        change.confirmedAt = new Date().toISOString()
        
        console.log(`[Sync] ✅ ${change.operation} confirmé sur ${change.table}`, change.data)
        
      } catch (error) {
        console.error(`[Sync] ❌ Erreur ${change.operation}:`, error)
        change.status = 'error'
        change.error = error.message
        change.retryCount++
        
        if (change.retryCount >= 3) {
          setSyncErrors(prev => [...prev, { ...change, error: error.message }])
          toast.error(`Échec de synchronisation: ${change.table}`)
        }
      }
    }

    // Nettoyer les changements confirmés après 5 secondes
    setTimeout(() => {
      queueRef.current = queueRef.current.filter(c => c.status !== 'confirmed')
      setPendingChanges([...queueRef.current])
    }, 5000)

    setLastSync(new Date())
    setSyncStatus(navigator.onLine ? 'connected' : 'offline')
    isProcessingRef.current = false

    // Traiter les changements restants
    const remaining = queueRef.current.filter(c => c.status === 'pending')
    if (remaining.length > 0) {
      setTimeout(processQueue, 2000)
    }
  }, [])

  // ============================================================
  // ROLLBACK - Annuler un changement en cas d'erreur
  // ============================================================
  const rollbackChange = useCallback((changeId) => {
    const change = queueRef.current.find(c => c.id === changeId)
    if (change) {
      change.status = 'rolledback'
      setPendingChanges([...queueRef.current])
      toast.info('Changement annulé')
    }
  }, [])

  // ============================================================
  // SYNCHRONISATION MANUELLE (bouton refresh)
  // ============================================================
  const forceSync = useCallback(async () => {
    if (!navigator.onLine) {
      toast.error('Pas de connexion internet')
      return
    }
    
    toast.loading('Synchronisation en cours...')
    await processQueue()
    toast.success('Synchronisation terminée')
  }, [processQueue])

  // ============================================================
  // GESTION DU RÉSEAU - Online/Offline
  // ============================================================
  useEffect(() => {
    const handleOnline = () => {
      setSyncStatus('connected')
      toast.success('🟢 Connexion rétablie - Synchronisation...')
      processQueue()
    }
    
    const handleOffline = () => {
      setSyncStatus('offline')
      toast.warning('🔴 Mode hors ligne - Les changements seront synchronisés plus tard')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [processQueue])

  // ============================================================
  // PERSISTANCE - Sauvegarder la file d'attente
  // ============================================================
  useEffect(() => {
    const saveQueue = () => {
      localStorage.setItem('sync-queue', JSON.stringify(queueRef.current))
    }
    
    const interval = setInterval(saveQueue, 5000)
    return () => clearInterval(interval)
  }, [])

  // Restaurer la file au démarrage
  useEffect(() => {
    const saved = localStorage.getItem('sync-queue')
    if (saved) {
      try {
        queueRef.current = JSON.parse(saved)
        setPendingChanges(queueRef.current)
        if (queueRef.current.length > 0) {
          processQueue()
        }
      } catch (e) {
        console.error('[Sync] Erreur restauration file:', e)
      }
    }
  }, [processQueue])

  const value = {
    syncStatus,
    lastSync,
    pendingChanges,
    syncErrors,
    optimisticUpdate,
    forceSync,
    rollbackChange,
    pendingCount: pendingChanges.filter(c => c.status === 'pending').length
  }

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
}

export const useSync = () => {
  const context = useContext(SyncContext)
  if (!context) throw new Error('useSync must be used within SyncProvider')
  return context
}
