/**
 * Constantes globales de l'application
 * Source unique de vérité — évite les duplications dans chaque fichier
 */

export const SUPER_ADMIN_EMAIL = (
  import.meta.env.VITE_SUPER_ADMIN_EMAIL || 'munokolive@gmail.com'
).toLowerCase()

export const isSuperAdminUser = (user) =>
  user?.email?.toLowerCase() === SUPER_ADMIN_EMAIL
