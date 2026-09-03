import { useState, useEffect, useCallback } from 'react';

/**
 * Hook personnalisé pour un chargement rapide des données
 * - Pas de spinner initial
 * - Chargement immédiat au montage
 * - Cache local optionnel
 * 
 * @param {Function} fetchFunction - Fonction async pour charger les données
 * @param {Object} options - Options de configuration
 * @returns {Object} { data, loading, error, reload }
 */
export const useFastLoad = (fetchFunction, options = {}) => {
  const {
    initialData = [],
    cacheKey = null,
    cacheDuration = 60000, // 1 minute par défaut
    onError = null
  } = options;

  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Charger depuis le cache si disponible
  const loadFromCache = useCallback(() => {
    if (!cacheKey) return null;
    
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (!cached) return null;
      
      const { data: cachedData, timestamp } = JSON.parse(cached);
      const age = Date.now() - timestamp;
      
      if (age < cacheDuration) {
        return cachedData;
      }
      
      // Cache expiré
      sessionStorage.removeItem(cacheKey);
      return null;
    } catch (err) {
      console.error('Erreur lecture cache:', err);
      return null;
    }
  }, [cacheKey, cacheDuration]);

  // Sauvegarder dans le cache
  const saveToCache = useCallback((newData) => {
    if (!cacheKey) return;
    
    try {
      const cacheData = {
        data: newData,
        timestamp: Date.now()
      };
      sessionStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (err) {
      console.error('Erreur sauvegarde cache:', err);
    }
  }, [cacheKey]);

  // Fonction de chargement
  const loadData = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) setLoading(true);
      
      const result = await fetchFunction();
      const newData = result?.data?.data || result?.data || result || [];
      
      setData(newData);
      setError(null);
      saveToCache(newData);
      
    } catch (err) {
      console.error('Erreur chargement:', err);
      setError(err);
      if (onError) onError(err);
    } finally {
      setLoading(false);
    }
  }, [fetchFunction, saveToCache, onError]);

  // Chargement initial
  useEffect(() => {
    // Essayer de charger depuis le cache
    const cachedData = loadFromCache();
    
    if (cachedData) {
      // Afficher les données en cache immédiatement
      setData(cachedData);
      // Recharger en arrière-plan pour avoir les données fraîches
      loadData(false);
    } else {
      // Pas de cache, charger normalement
      loadData(false);
    }
  }, []);

  // Fonction de rechargement manuel
  const reload = useCallback(() => {
    loadData(true);
  }, [loadData]);

  return {
    data,
    loading,
    error,
    reload
  };
};

export default useFastLoad;
