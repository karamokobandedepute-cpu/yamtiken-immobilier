import React from 'react'
import * as Sentry from '@sentry/react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import logoSrc from '../assets/logo/logo behemoth.png'

/**
 * Composant d'erreur personnalisé affiché quand l'app crash
 */
const ErrorFallback = ({ error, componentStack, resetError }) => {
  const isDev = import.meta.env.DEV

  const handleReload = () => {
    window.location.href = '/'
  }

  const handleReset = () => {
    resetError()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-white p-4">
      <div className="max-w-2xl w-full">
        {/* Card principale */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-red-500 to-red-600 p-8 text-white">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Oups ! Une erreur est survenue</h1>
                <p className="text-red-100 mt-1">L'application a rencontré un problème inattendu</p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-8 space-y-6">
            {/* Message rassurant */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-sm font-bold">ℹ</span>
                </div>
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Ne vous inquiétez pas !</p>
                  <p>
                    Cette erreur a été automatiquement signalée à notre équipe technique. 
                    Vos données sont en sécurité et nous travaillons à résoudre le problème.
                  </p>
                </div>
              </div>
            </div>

            {/* Détails de l'erreur (en dev uniquement) */}
            {isDev && error && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <span className="text-red-500">⚠️</span>
                  Détails de l'erreur (mode développement)
                </h3>
                <div className="bg-gray-900 text-green-400 p-4 rounded font-mono text-xs overflow-auto max-h-48">
                  <div className="mb-2">
                    <span className="text-red-400">Error:</span> {error.message}
                  </div>
                  {componentStack && (
                    <div className="text-gray-400 text-xs">
                      {componentStack}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleReset}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold rounded-lg hover:from-green-600 hover:to-green-700 transition-all shadow-lg hover:shadow-xl"
              >
                <RefreshCw className="w-5 h-5" />
                Réessayer
              </button>
              <button
                onClick={handleReload}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-all"
              >
                <Home className="w-5 h-5" />
                Retour à l'accueil
              </button>
            </div>

            {/* Support */}
            <div className="text-center text-sm text-gray-500 pt-4 border-t">
              <p>
                Si le problème persiste, contactez le support à{' '}
                <a href="mailto:support@yamtiken.com" className="text-green-600 hover:underline font-medium">
                  support@yamtiken.com
                </a>
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-8 py-4 flex items-center justify-between border-t">
            <div className="flex items-center gap-2">
              <img src={logoSrc} alt="YAMTIKEN" className="w-8 h-8 object-contain" />
              <span className="text-sm font-medium text-gray-600">YAMTIKEN Immo Manager Pro</span>
            </div>
            <span className="text-xs text-gray-400">
              Error ID: {error?.digest || 'N/A'}
            </span>
          </div>
        </div>

        {/* Message de sécurité */}
        <div className="mt-4 text-center text-xs text-gray-500">
          <p>🔒 Vos données sont sécurisées et n'ont pas été affectées par cette erreur</p>
        </div>
      </div>
    </div>
  )
}

/**
 * ErrorBoundary global avec Sentry
 * Capture toutes les erreurs React et les envoie à Sentry
 */
export const SentryErrorBoundary = ({ children }) => {
  return (
    <Sentry.ErrorBoundary
      fallback={ErrorFallback}
      showDialog={false} // Ne pas afficher le dialog Sentry par défaut
      beforeCapture={(scope, error, errorInfo) => {
        // Ajouter du contexte avant d'envoyer à Sentry
        scope.setContext('errorBoundary', {
          componentStack: errorInfo.componentStack,
        })
        
        scope.setTag('error_boundary', 'react')
        
        // Ajouter les props du composant qui a crashé
        if (errorInfo.componentStack) {
          scope.setContext('component', {
            stack: errorInfo.componentStack,
          })
        }
      }}
    >
      {children}
    </Sentry.ErrorBoundary>
  )
}

export default SentryErrorBoundary
