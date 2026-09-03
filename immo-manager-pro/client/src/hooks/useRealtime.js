import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase, REALTIME_TABLES } from '../lib/supabase'

/**
 * Hook pour souscription temps réel Supabase
 * @param {string} table - Nom de la table à surveiller
 * @param {function} onChange - Callback appelé quand des changements surviennent
 * @param {object} options - Options de filtrage { column, value }
 */
export const useRealtime = (table, onChange, options = {}) => {
  const channelRef = useRef(null)
  const retryCount = useRef(0)
  const MAX_RETRIES = 5

  useEffect(() => {
    if (!table || !onChange) return

    const setupSubscription = () => {
      const channelName = `${table}_realtime_${Date.now()}`
      
      let query = supabase
        .channel(channelName)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table,
          ...(options.column && options.value && {
            filter: `${options.column}=eq.${options.value}`
          })
        }, (payload) => {
          retryCount.current = 0
          console.log(`[Realtime] ${table} mis à jour:`, payload.eventType)
          onChange(payload)
        })

      const channel = query.subscribe((status) => {
        console.log(`[Realtime] ${table} status:`, status)
        
        if (status === 'SUBSCRIBED') {
          retryCount.current = 0
        }
        
        if (status === 'CHANNEL_ERROR' && retryCount.current < MAX_RETRIES) {
          retryCount.current++
          console.warn(`[Realtime] Erreur sur ${table}, tentative ${retryCount.current}/${MAX_RETRIES}`)
          
          setTimeout(() => {
            if (channelRef.current) {
              supabase.removeChannel(channelRef.current)
            }
            setupSubscription()
          }, Math.min(1000 * 2 ** retryCount.current, 30000))
        }
      })

      channelRef.current = channel
    }

    setupSubscription()

    return () => {
      if (channelRef.current) {
        console.log(`[Realtime] Déconnexion de ${table}`)
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [table, onChange, options.column, options.value])
}

/**
 * Hook pour souscription multi-tables
 * @param {string[]} tables - Liste des tables à surveiller
 * @param {function} onChange - Callback(table, payload)
 */
export const useRealtimeMulti = (tables, onChange) => {
  const channelRef = useRef(null)

  useEffect(() => {
    if (!tables?.length || !onChange) return

    const channelName = `multi_realtime_${Date.now()}`
    const channel = supabase.channel(channelName)

    tables.forEach(table => {
      channel.on('postgres_changes', {
        event: '*',
        schema: 'public',
        table
      }, (payload) => {
        console.log(`[Realtime] ${table} changement:`, payload.eventType)
        onChange(table, payload)
      })
    })

    channel.subscribe((status) => {
      console.log('[Realtime Multi] Status:', status)
    })

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [tables, onChange])
}

/**
 * Hook pour rafraîchissement automatique des données
 * @param {function} fetchFn - Fonction pour récupérer les données
 * @param {string[]} tables - Tables à surveiller pour déclencher le refresh
 * @param {number} interval - Intervalle de polling en ms (optionnel)
 */
export const useAutoRefresh = (fetchFn, tables = [], interval = null) => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const intervalRef = useRef(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await fetchFn()
      setData(result)
    } catch (err) {
      console.error('[useAutoRefresh] Erreur:', err)
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [fetchFn])

  // Chargement initial
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Souscription temps réel
  useRealtimeMulti(tables, useCallback(() => {
    console.log('[useAutoRefresh] Changement détecté, refresh...')
    fetchData()
  }, [fetchData]))

  // Polling optionnel
  useEffect(() => {
    if (interval && document.visibilityState === 'visible') {
      intervalRef.current = setInterval(fetchData, interval)
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchData()
        if (interval) {
          intervalRef.current = setInterval(fetchData, interval)
        }
      } else {
        clearInterval(intervalRef.current)
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearInterval(intervalRef.current)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [fetchData, interval])

  return { data, loading, error, refetch: fetchData }
}

/**
 * Hook pour statut de connexion realtime
 */
export const useRealtimeStatus = () => {
  const [status, setStatus] = useState('disconnected')
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    const channel = supabase.channel('status_check')
    
    channel.subscribe((state) => {
      setStatus(state)
      setIsConnected(state === 'SUBSCRIBED')
    })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return { status, isConnected }
}

export default useRealtime
