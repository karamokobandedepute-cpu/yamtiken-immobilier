import { useEffect, useRef, useState, useCallback } from 'react'
import { useRealtimeMulti, useRealtimeStatus } from '../hooks/useRealtime'
import { RefreshCw, Wifi, WifiOff } from 'lucide-react'
import toast from 'react-hot-toast'

/**
 * Composant de synchronisation temps réel
 * Affiche un indicateur de connexion et permet le rafraîchissement manuel
 */
export const RealtimeIndicator = () => {
  const { isConnected, status } = useRealtimeStatus()
  
  return (
    <div className="flex items-center gap-2 text-xs">
      {isConnected ? (
        <>
          <Wifi size={14} className="text-green-500" />
          <span className="text-green-600">Temps réel actif</span>
        </>
      ) : (
        <>
          <WifiOff size={14} className="text-gray-400" />
          <span className="text-gray-500">Mode hors ligne</span>
        </>
      )}
    </div>
  )
}

/**
 * Wrapper pour pages avec synchronisation temps réel automatique
 * @param {string[]} tables - Tables à surveiller
 * @param {function} onUpdate - Callback appelé lors des changements
 * @param {ReactNode} children - Contenu de la page
 */
export const RealtimeSync = ({ tables = [], onUpdate, children }) => {
  const [lastSync, setLastSync] = useState(new Date())
  const [isSyncing, setIsSyncing] = useState(false)
  const pendingUpdates = useRef(new Set())

  // Gestion des changements temps réel
  const handleRealtimeUpdate = useCallback((table, payload) => {
    console.log(`[RealtimeSync] Changement sur ${table}:`, payload.eventType)
    
    // Accumuler les changements pour éviter les refreshs en cascade
    pendingUpdates.current.add(table)
    
    // Debounce le refresh pour grouper les changements
    clearTimeout(window._realtimeDebounce)
    window._realtimeDebounce = setTimeout(() => {
      if (pendingUpdates.current.size > 0) {
        setIsSyncing(true)
        
        if (onUpdate) {
          onUpdate(Array.from(pendingUpdates.current), payload)
        }
        
        setLastSync(new Date())
        pendingUpdates.current.clear()
        
        // Notification discrète
        toast.success('Données synchronisées', {
          id: 'realtime-sync',
          duration: 2000,
          icon: '🔄'
        })
        
        setTimeout(() => setIsSyncing(false), 500)
      }
    }, 300)
  }, [onUpdate])

  // Souscription temps réel
  useRealtimeMulti(tables, handleRealtimeUpdate)

  // Rafraîchissement manuel
  const handleManualRefresh = useCallback(async () => {
    setIsSyncing(true)
    
    if (onUpdate) {
      await onUpdate(tables, { manual: true })
    }
    
    setLastSync(new Date())
    toast.success('Données actualisées', { duration: 2000 })
    setTimeout(() => setIsSyncing(false), 500)
  }, [onUpdate, tables])

  return (
    <div className="relative">
      {/* Indicateur de synchronisation */}
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-white rounded-lg shadow-lg px-3 py-2 border">
        <RealtimeIndicator />
        
        <button
          onClick={handleManualRefresh}
          disabled={isSyncing}
          className={`p-1.5 rounded-md transition-all ${
            isSyncing 
              ? 'animate-spin text-blue-500' 
              : 'text-gray-500 hover:text-blue-500 hover:bg-blue-50'
          }`}
          title="Actualiser maintenant"
        >
          <RefreshCw size={16} />
        </button>
        
        <span className="text-xs text-gray-400">
          {lastSync.toLocaleTimeString('fr-FR', { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit'
          })}
        </span>
      </div>
      
      {children}
    </div>
  )
}

/**
 * Hook personnalisé pour gérer le chargement avec états loading/error
 */
export const useDataLoading = (fetchFn, dependencies = []) => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const abortController = useRef(null)

  const loadData = useCallback(async (options = {}) => {
    // Annuler la requête précédente
    if (abortController.current) {
      abortController.current.abort()
    }
    abortController.current = new AbortController()

    try {
      setLoading(true)
      setError(null)
      
      const result = await fetchFn({
        signal: abortController.current.signal,
        ...options
      })
      
      setData(result)
      return result
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('[useDataLoading] Erreur:', err)
        setError(err)
      }
      throw err
    } finally {
      setLoading(false)
    }
  }, [fetchFn])

  // Chargement initial
  useEffect(() => {
    loadData()
    
    return () => {
      if (abortController.current) {
        abortController.current.abort()
      }
    }
  }, dependencies)

  return { data, loading, error, reload: loadData }
}

/**
 * Hook pour debounce sur input de recherche
 */
export const useDebounce = (value, delay = 300) => {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}

export default RealtimeSync
