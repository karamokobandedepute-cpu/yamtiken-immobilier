import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase, REALTIME_TABLES, isSupabaseEnabled } from '../lib/supabase'
import { invalidateFromRealtime, queryClient } from '../lib/queryClient'

// ============================================================
// useRealtimeSync - SYNCHRONISATION TEMPS RÉEL GLOBALE
// "Ne décroche jamais" : reconnexion auto, exponential backoff
// Écoute INSERT, UPDATE, DELETE sur toutes les tables critiques
// ============================================================
export function useRealtimeSync({ enabled = true } = {}) {
  // Désactiver si Supabase non configuré (mode local)
  if (!isSupabaseEnabled) enabled = false
  const [status, setStatus] = useState('connecting') // connecting | connected | error | offline
  const [lastSync, setLastSync] = useState(null)
  const channelRef = useRef(null)
  const retryRef = useRef(0)
  const retryTimerRef = useRef(null)
  const channelIdRef = useRef(`dashboard_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)
  const mountedRef = useRef(false)
  const MAX_RETRIES = 10

  const connect = useCallback(() => {
    if (!enabled || !mountedRef.current) return
    
    // Nettoyer l'ancien channel proprement
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current).catch(() => {})
      channelRef.current = null
    }

    // Créer un nouveau channel avec un nom unique
    const channel = supabase.channel(channelIdRef.current, {
      config: { broadcast: { self: true } }
    })

    // Abonner chaque table critique AVANT subscribe()
    REALTIME_TABLES.forEach(table => {
      channel.on('postgres_changes', {
        event: '*',
        schema: 'public',
        table
      }, (payload) => {
        retryRef.current = 0
        setLastSync(new Date())
        // Invalider le cache TanStack Query pour cette table
        invalidateFromRealtime(table)
      })
    })

    // Subscribe après avoir ajouté tous les listeners
    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        setStatus('connected')
        retryRef.current = 0
        // Réhydratation ciblée à la reconnexion (évite le storm de refetch)
        REALTIME_TABLES.forEach(table => invalidateFromRealtime(table))
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setStatus('error')
        scheduleReconnect()
      } else if (status === 'CLOSED') {
        setStatus('offline')
        scheduleReconnect()
      } else {
        setStatus('connecting')
      }
    })

    channelRef.current = channel
  }, [enabled])

  const scheduleReconnect = useCallback(() => {
    if (retryRef.current >= MAX_RETRIES) {
      setStatus('offline')
      return
    }
    const delay = Math.min(1000 * 2 ** retryRef.current, 60000)
    retryRef.current++
    clearTimeout(retryTimerRef.current)
    retryTimerRef.current = setTimeout(connect, delay)
  }, [connect])

  // Reconnexion quand le réseau revient
  useEffect(() => {
    const handleOnline = () => {
      retryRef.current = 0
      connect()
    }
    const handleOffline = () => setStatus('offline')

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [connect])

  // Reconnexion quand la fenêtre reprend le focus
  useEffect(() => {
    const handleFocus = () => {
      if (status !== 'connected') connect()
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [connect, status])

  // Connexion initiale
  useEffect(() => {
    mountedRef.current = true
    connect()
    return () => {
      mountedRef.current = false
      clearTimeout(retryTimerRef.current)
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current).catch(() => {})
      }
    }
  }, [connect])

  const reconnect = useCallback(() => {
    retryRef.current = 0
    connect()
  }, [connect])

  return { status, lastSync, reconnect }
}

// ============================================================
// useTableRealtime - Hook léger pour une table spécifique
// ============================================================
export function useTableRealtime(table, onUpdate) {
  const callbackRef = useRef(onUpdate)
  callbackRef.current = onUpdate

  useEffect(() => {
    if (!table) return

    const channel = supabase
      .channel(`table_${table}_${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
        invalidateFromRealtime(table)
        callbackRef.current?.(payload)
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [table])
}
