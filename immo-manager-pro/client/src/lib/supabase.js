import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Indique si Supabase est réellement configuré (sans crasher l'app)
export const isSupabaseEnabled = !!(supabaseUrl && supabaseKey
  && supabaseUrl.startsWith('https://')
  && supabaseKey.length > 20)

if (!isSupabaseEnabled) {
  console.warn('[Supabase] Non configuré — mode local actif. Définissez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans .env pour activer le temps réel.')
}

// Valeurs de fallback pour éviter le crash createClient
const _url = supabaseUrl || 'https://placeholder.supabase.co'
const _key = supabaseKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MTkxNTM2MjQwMH0.placeholder'

// ============================================================
// CLIENT SUPABASE - OPTIMISÉ POUR REALTIME
// ============================================================
export const supabase = createClient(_url, _key, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'yamtiken-auth',
    storage: window.localStorage,
    flowType: 'pkce'
  },
  realtime: {
    params: { 
      eventsPerSecond: 100,
      maxJoinsPerSecond: 20
    },
    timeout: 60000,
    heartbeatIntervalMs: 10000,
  },
  global: {
    headers: {
      'x-app-name': 'IMMO-MANAGER-PRO',
      'x-app-version': '2.0.0'
    },
    fetch: (url, options) => {
      // Ajouter cache: 'no-store' pour éviter le cache navigateur
      return fetch(url, {
        ...options,
        cache: 'no-store',
        headers: {
          ...options?.headers,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      })
    }
  },
  db: { schema: 'public' }
})

// ============================================================
// TABLES CRITIQUES - Surveillance temps réel
// ============================================================
export const REALTIME_TABLES = [
  'clients', 'biens', 'leases', 'payments',
  'contrats', 'visites', 'alertes', 'buildings',
  'commissions', 'users'
]

// ============================================================
// SUBSCRIBE - Abonnement universel avec reconnexion auto
// ============================================================
export const subscribeToTable = (table, callback, filter = null) => {
  const channelName = `${table}_${Date.now()}`
  let channel = null
  let retryCount = 0
  const MAX_RETRIES = 5

  const connect = () => {
    channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table,
        ...(filter && { filter: `${filter.column}=eq.${filter.value}` })
      }, (payload) => {
        retryCount = 0
        callback(payload)
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' && retryCount < MAX_RETRIES) {
          retryCount++
          setTimeout(() => {
            supabase.removeChannel(channel)
            connect()
          }, Math.min(1000 * 2 ** retryCount, 30000))
        }
      })
  }

  connect()
  return () => { if (channel) supabase.removeChannel(channel) }
}

// ============================================================
// SUBSCRIBE MULTI-TABLES - Écoute plusieurs tables en 1 channel
// ============================================================
export const subscribeToMultipleTables = (tables, onUpdate) => {
  const channel = supabase.channel('global_sync')

  tables.forEach(table => {
    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table
    }, (payload) => onUpdate(table, payload))
  })

  channel.subscribe()
  return () => supabase.removeChannel(channel)
}

// ============================================================
// STATUS - Monitoring connexion Supabase Realtime
// ============================================================
export const onRealtimeStatusChange = (callback) => {
  const channel = supabase.channel('status_monitor')
  channel.subscribe((status) => callback(status))
  return () => supabase.removeChannel(channel)
}
