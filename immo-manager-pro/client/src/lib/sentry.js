import * as Sentry from '@sentry/react'

/**
 * Configuration Sentry pour le monitoring des erreurs en production
 * 
 * ÉTAPES DE CONFIGURATION :
 * 1. Créer un compte gratuit sur https://sentry.io
 * 2. Créer un nouveau projet React
 * 3. Copier le DSN fourni
 * 4. Ajouter VITE_SENTRY_DSN dans .env
 */

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN
const ENVIRONMENT = import.meta.env.MODE // 'development' ou 'production'
const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0'

/**
 * Initialiser Sentry
 * Ne s'active qu'en production et si le DSN est configuré
 */
export const initSentry = () => {
  // Ne pas initialiser en développement ou si pas de DSN
  if (ENVIRONMENT === 'development' || !SENTRY_DSN) {
    console.log('[Sentry] Désactivé en développement ou DSN manquant')
    return
  }

  Sentry.init({
    // 🔑 DSN du projet Sentry
    dsn: SENTRY_DSN,

    // 🏷️ Environnement et version
    environment: ENVIRONMENT,
    release: `immo-manager-pro@${APP_VERSION}`,

    // 📊 Performance Monitoring
    integrations: [
      Sentry.browserTracingIntegration({
        tracePropagationTargets: ['localhost', '54.36.209.70', /^https:\/\/yourserver\.io\/api/],
      }),
      // Replay des sessions (optionnel, plan payant)
      // new Sentry.Replay({
      //   maskAllText: true,
      //   blockAllMedia: true,
      // }),
    ],

    // 🎯 Taux d'échantillonnage des transactions (performance)
    tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0, // 10% en prod, 100% en dev

    // 🎬 Replay des sessions (optionnel)
    // replaysSessionSampleRate: 0.1, // 10% des sessions
    // replaysOnErrorSampleRate: 1.0, // 100% des sessions avec erreur

    // 🔍 Filtrer les erreurs non pertinentes
    beforeSend(event, hint) {
      // Ignorer les erreurs réseau temporaires
      if (event.exception?.values?.[0]?.value?.includes('NetworkError')) {
        return null
      }

      // Ignorer les erreurs de chargement de chunks (lazy loading)
      if (event.exception?.values?.[0]?.value?.includes('ChunkLoadError')) {
        return null
      }

      // Ignorer les erreurs d'extensions navigateur
      if (event.exception?.values?.[0]?.stacktrace?.frames?.some(
        frame => frame.filename?.includes('chrome-extension://')
      )) {
        return null
      }

      return event
    },

    // 🏷️ Tags par défaut
    initialScope: {
      tags: {
        app: 'immo-manager-pro',
        platform: 'web',
      },
    },

    // 🔒 Données sensibles à masquer
    beforeBreadcrumb(breadcrumb) {
      // Masquer les données sensibles dans les breadcrumbs
      if (breadcrumb.category === 'console') {
        return null // Ne pas envoyer les console.log
      }
      
      if (breadcrumb.data?.url) {
        // Masquer les tokens dans les URLs
        breadcrumb.data.url = breadcrumb.data.url.replace(/token=[^&]+/, 'token=***')
      }

      return breadcrumb
    },
  })

  console.log('[Sentry] ✅ Initialisé en production')
}

/**
 * Configurer le contexte utilisateur
 * À appeler après la connexion
 */
export const setSentryUser = (user) => {
  if (!user) {
    Sentry.setUser(null)
    return
  }

  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.nom ? `${user.nom} ${user.prenom || ''}`.trim() : user.email,
    role: user.role,
  })

  // Ajouter des tags personnalisés
  Sentry.setTag('user_role', user.role)
  Sentry.setTag('user_id', user.id)
}

/**
 * Ajouter du contexte à une erreur
 */
export const addSentryContext = (context, data) => {
  Sentry.setContext(context, data)
}

/**
 * Ajouter un breadcrumb (fil d'Ariane)
 */
export const addSentryBreadcrumb = (message, category = 'action', level = 'info', data = {}) => {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
    timestamp: Date.now() / 1000,
  })
}

/**
 * Capturer une erreur manuellement
 */
export const captureError = (error, context = {}) => {
  Sentry.captureException(error, {
    contexts: context,
  })
}

/**
 * Capturer un message (warning, info)
 */
export const captureMessage = (message, level = 'info', context = {}) => {
  Sentry.captureMessage(message, {
    level,
    contexts: context,
  })
}

/**
 * Wrapper pour les appels API avec Sentry
 */
export const withSentryAPI = async (apiCall, context = {}) => {
  try {
    const result = await apiCall()
    return { data: result, error: null }
  } catch (error) {
    // Capturer l'erreur dans Sentry
    Sentry.captureException(error, {
      contexts: {
        api: context,
      },
      tags: {
        api_endpoint: context.endpoint || 'unknown',
        api_method: context.method || 'unknown',
      },
    })

    return { data: null, error }
  }
}

/**
 * HOC pour wrapper un composant avec Sentry
 */
export const withSentry = (Component, componentName) => {
  return Sentry.withProfiler(Component, { name: componentName })
}

export default Sentry
