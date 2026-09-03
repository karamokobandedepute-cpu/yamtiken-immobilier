import { useState, useEffect, useRef, useCallback } from 'react'

// Cache global pour éviter les rechargements inutiles
const dataCache = new Map()
const cacheTimestamps = new Map()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export const useDataCache = (key, fetchFn, options = {}) => {
  const {
    cacheTime = CACHE_DURATION,
    refetchInterval = null,
    enabled = true,
    dependencies = []
  } = options

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const isMounted = useRef(true)
  const abortController = useRef(null)

  const fetchData = useCallback(async (force = false) => {
    if (!enabled) return

    // Vérifier le cache
    const cached = dataCache.get(key)
    const timestamp = cacheTimestamps.get(key)
    const now = Date.now()

    if (!force && cached && timestamp && (now - timestamp) < cacheTime) {
      setData(cached)
      setLoading(false)
      return cached
    }

    // Annuler la requête précédente
    if (abortController.current) {
      abortController.current.abort()
    }
    abortController.current = new AbortController()

    try {
      setLoading(true)
      setError(null)

      const result = await fetchFn({ signal: abortController.current.signal })
      
      if (isMounted.current) {
        setData(result)
        dataCache.set(key, result)
        cacheTimestamps.set(key, Date.now())
        setLoading(false)
      }

      return result
    } catch (err) {
      if (err.name === 'AbortError') return
      
      if (isMounted.current) {
        setError(err)
        setLoading(false)
      }
      throw err
    }
  }, [key, fetchFn, enabled, cacheTime])

  useEffect(() => {
    isMounted.current = true
    fetchData()

    // Refetch interval
    let interval
    if (refetchInterval && enabled) {
      interval = setInterval(() => fetchData(true), refetchInterval)
    }

    return () => {
      isMounted.current = false
      if (abortController.current) {
        abortController.current.abort()
      }
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [fetchData, refetchInterval, enabled, ...dependencies])

  const refetch = useCallback(() => fetchData(true), [fetchData])
  const invalidate = useCallback(() => {
    dataCache.delete(key)
    cacheTimestamps.delete(key)
  }, [key])

  return { data, loading, error, refetch, invalidate }
}

// Fonction pour invalider tout le cache
export const invalidateAllCache = () => {
  dataCache.clear()
  cacheTimestamps.clear()
}

// Fonction pour invalider un cache spécifique
export const invalidateCache = (key) => {
  dataCache.delete(key)
  cacheTimestamps.delete(key)
}
