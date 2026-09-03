import NodeCache from 'node-cache';

// ============================================
// CACHE MÉMOIRE - IMMO MANAGER PRO (OPTIMISÉ)
// ============================================
// TTL par défaut : 5 minutes (300 secondes)
// Vérification expiration : toutes les 60 secondes
// useClones désactivé pour de meilleures performances

const cache = new NodeCache({
  stdTTL: 300,
  checkperiod: 60,
  useClones: false  // Désactivé pour de meilleures perfs (pas de deep copy)
});

// Clés de cache utilisées dans l'application
export const CACHE_KEYS = {
  DASHBOARD_KPI: 'dashboard:kpi',
  DASHBOARD_STATS: 'dashboard:stats',
  DASHBOARD_REVENUS: 'dashboard:revenus',
  DASHBOARD_OCCUPATION: 'dashboard:occupation',
  DASHBOARD_REVENUS_IMMEUBLE: 'dashboard:revenus-immeuble',
  DASHBOARD_ACTIVITES: 'dashboard:activites',
  RECOUVREMENT_DASHBOARD: 'recouvrement:dashboard',
  // Nouvelles clés ajoutées pour les routes lentes
  LEASES_LIST: 'leases:list',
  LEASES_STATS: 'leases:stats',
  CLIENTS_STATS: 'clients:stats',
  BUILDINGS_STATS: 'buildings:stats',
  ALERTES_URGENTES: 'alertes:urgentes',
  ALERTES_COUNT: 'alertes:count',
  RECOUVREMENT_STATS_MENSUELLES: 'recouvrement:stats-mensuelles',
  RECOUVREMENT_CLIENTS_RETARD: 'recouvrement:clients-retard',
  COMMISSIONS_CLASSEMENT: 'commissions:classement',
};

// Helper : get or compute (cache-aside pattern)
export const getOrCompute = async (key, computeFn, ttl = 300) => {
  const cached = cache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const result = await computeFn();
  cache.set(key, result, ttl);
  return result;
};

// Invalider tout le cache dashboard
export const invalidateDashboard = () => {
  Object.values(CACHE_KEYS).forEach(key => cache.del(key));
};

// Invalider une clé spécifique
export const invalidateKey = (key) => {
  cache.del(key);
};

// Invalider les clés liées aux paiements/baux (appelé lors de création de paiement)
export const invalidateLeaseData = () => {
  [
    CACHE_KEYS.LEASES_LIST,
    CACHE_KEYS.LEASES_STATS,
    CACHE_KEYS.RECOUVREMENT_DASHBOARD,
    CACHE_KEYS.RECOUVREMENT_CLIENTS_RETARD,
    CACHE_KEYS.RECOUVREMENT_STATS_MENSUELLES,
    CACHE_KEYS.DASHBOARD_KPI,
    CACHE_KEYS.DASHBOARD_STATS,
    CACHE_KEYS.DASHBOARD_REVENUS,
    CACHE_KEYS.ALERTES_URGENTES,
    CACHE_KEYS.ALERTES_COUNT,
  ].forEach(key => cache.del(key));
};

// Invalider les clés liées aux clients
export const invalidateClientData = () => {
  [
    CACHE_KEYS.CLIENTS_STATS,
    CACHE_KEYS.DASHBOARD_KPI,
    CACHE_KEYS.DASHBOARD_STATS,
    CACHE_KEYS.DASHBOARD_ACTIVITES,
  ].forEach(key => cache.del(key));
};

// Stats du cache (pour monitoring)
export const getCacheStats = () => {
  return cache.getStats();
};

export default cache;
