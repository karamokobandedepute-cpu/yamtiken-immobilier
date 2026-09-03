import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Hook réutilisable pour écouter les changements en temps réel sur une table Supabase
 * Remplace le polling par les WebSockets natifs de Supabase
 * 
 * @param {string} tableName - Nom de la table à surveiller
 * @param {function} onInsert - Callback appelé lors d'un INSERT
 * @param {function} onUpdate - Callback appelé lors d'un UPDATE
 * @param {function} onDelete - Callback appelé lors d'un DELETE
 * @param {object} options - Options supplémentaires
 * @param {string} options.filter - Filtre SQL pour les événements (ex: "user_id=eq.123")
 * @param {boolean} options.enabled - Activer/désactiver l'écoute (défaut: true)
 * @returns {object} - { isConnected, error, channel }
 * 
 * @example
 * // Écouter tous les changements sur la table "paiements"
 * useRealtimeTable('paiements', {
 *   onInsert: (payload) => console.log('Nouveau paiement:', payload.new),
 *   onUpdate: (payload) => console.log('Paiement modifié:', payload.new),
 *   onDelete: (payload) => console.log('Paiement supprimé:', payload.old)
 * })
 * 
 * @example
 * // Écouter uniquement les paiements d'un client spécifique
 * useRealtimeTable('paiements', {
 *   onInsert: handleNewPayment,
 *   filter: `client_id=eq.${clientId}`,
 *   enabled: !!clientId
 * })
 */
export const useRealtimeTable = (
  tableName,
  {
    onInsert = null,
    onUpdate = null,
    onDelete = null,
    filter = null,
    enabled = true
  } = {}
) => {
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState(null)
  const channelRef = useRef(null)

  // ⚡ FIX Bug #6: Stocker les callbacks dans des refs stables pour éviter
  // que des fonctions inline dans les dépendances recréent le canal à l'infini
  const onInsertRef = useRef(onInsert)
  const onUpdateRef = useRef(onUpdate)
  const onDeleteRef = useRef(onDelete)
  useEffect(() => { onInsertRef.current = onInsert }, [onInsert])
  useEffect(() => { onUpdateRef.current = onUpdate }, [onUpdate])
  useEffect(() => { onDeleteRef.current = onDelete }, [onDelete])

  useEffect(() => {
    // Ne pas s'abonner si désactivé ou pas de table
    if (!enabled || !tableName) {
      return
    }

    // Créer un nom de canal unique
    const channelName = `realtime:${tableName}:${Date.now()}`
    
    // Créer le canal Supabase
    const channel = supabase.channel(channelName)

    // Configuration de l'écoute des changements PostgreSQL
    const postgresChanges = {
      event: '*', // Écouter tous les événements (INSERT, UPDATE, DELETE)
      schema: 'public',
      table: tableName
    }

    // Ajouter le filtre si spécifié
    if (filter) {
      postgresChanges.filter = filter
    }

    // S'abonner aux changements
    channel
      .on('postgres_changes', postgresChanges, (payload) => {
        const { eventType } = payload

        // Dispatcher vers le bon callback via les refs (stables, pas de boucle)
        switch (eventType) {
          case 'INSERT':
            if (onInsertRef.current) onInsertRef.current(payload)
            break
          case 'UPDATE':
            if (onUpdateRef.current) onUpdateRef.current(payload)
            break
          case 'DELETE':
            if (onDeleteRef.current) onDeleteRef.current(payload)
            break
          default:
            console.warn(`[useRealtimeTable] Événement non géré: ${eventType}`)
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true)
          setError(null)
          console.log(`[useRealtimeTable] ✅ Connecté à ${tableName}`)
        } else if (status === 'CHANNEL_ERROR') {
          setIsConnected(false)
          setError(new Error(`Erreur de connexion au canal ${tableName}`))
          console.error(`[useRealtimeTable] ❌ Erreur de connexion à ${tableName}`)
        } else if (status === 'TIMED_OUT') {
          setIsConnected(false)
          setError(new Error(`Timeout de connexion au canal ${tableName}`))
          console.error(`[useRealtimeTable] ⏱️ Timeout de connexion à ${tableName}`)
        }
      })

    // Stocker la référence du canal
    channelRef.current = channel

    // Nettoyage : se désabonner lors du démontage du composant
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        setIsConnected(false)
        console.log(`[useRealtimeTable] 🔌 Déconnecté de ${tableName}`)
      }
    }
  // ⚡ Dépendances stables uniquement (pas les callbacks — ils sont dans des refs)
  }, [tableName, filter, enabled])

  return {
    isConnected,
    error,
    channel: channelRef.current
  }
}

/**
 * Hook simplifié pour écouter une table et rafraîchir automatiquement les données
 * Combine useRealtimeTable avec une fonction de fetch
 * 
 * @param {string} tableName - Nom de la table
 * @param {function} fetchFunction - Fonction async pour récupérer les données
 * @param {object} options - Options (filter, enabled)
 * @returns {object} - { data, loading, error, isConnected, refetch }
 * 
 * @example
 * const { data: paiements, loading, refetch } = useRealtimeData(
 *   'paiements',
 *   async () => {
 *     const { data } = await supabase.from('paiements').select('*')
 *     return data
 *   }
 * )
 */
export const useRealtimeData = (tableName, fetchFunction, options = {}) => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Fonction pour charger les données
  const fetchData = async () => {
    try {
      setLoading(true)
      const result = await fetchFunction()
      setData(result)
      setError(null)
    } catch (err) {
      setError(err)
      console.error(`[useRealtimeData] Erreur fetch ${tableName}:`, err)
    } finally {
      setLoading(false)
    }
  }

  // Charger les données au montage
  useEffect(() => {
    fetchData()
  }, [tableName])

  // Écouter les changements en temps réel
  const { isConnected } = useRealtimeTable(tableName, {
    onInsert: () => fetchData(),
    onUpdate: () => fetchData(),
    onDelete: () => fetchData(),
    ...options
  })

  return {
    data,
    loading,
    error,
    isConnected,
    refetch: fetchData
  }
}

/**
 * Hook pour écouter plusieurs tables simultanément
 * 
 * @param {Array<{tableName: string, callbacks: object}>} tables - Liste des tables à écouter
 * @returns {object} - { connections, allConnected }
 * 
 * @example
 * const { allConnected } = useRealtimeTables([
 *   { tableName: 'paiements', callbacks: { onInsert: handleNewPayment } },
 *   { tableName: 'contrats', callbacks: { onUpdate: handleUpdateContrat } }
 * ])
 */
export const useRealtimeTables = (tables) => {
  const [connections, setConnections] = useState({})

  useEffect(() => {
    const channels = tables.map(({ tableName, callbacks, filter }) => {
      const channelName = `realtime:${tableName}:${Date.now()}`
      const channel = supabase.channel(channelName)

      const postgresChanges = {
        event: '*',
        schema: 'public',
        table: tableName
      }

      if (filter) postgresChanges.filter = filter

      channel
        .on('postgres_changes', postgresChanges, (payload) => {
          const { eventType } = payload
          const callback = callbacks[`on${eventType.charAt(0) + eventType.slice(1).toLowerCase()}`]
          if (callback) callback(payload)
        })
        .subscribe((status) => {
          setConnections(prev => ({
            ...prev,
            [tableName]: status === 'SUBSCRIBED'
          }))
        })

      return channel
    })

    return () => {
      channels.forEach(channel => supabase.removeChannel(channel))
    }
  }, [tables])

  return {
    connections,
    allConnected: Object.values(connections).every(Boolean)
  }
}

export default useRealtimeTable
