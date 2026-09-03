import { useState, useEffect } from 'react'
import { WifiOff, RefreshCw, X, Server, AlertTriangle } from 'lucide-react'
import { healthCheck } from '../lib/healthCheck'

/**
 * GlobalHealthStatus - Indicateur global de connexion
 * Affiche une barre discrète en haut de l'application quand le serveur est injoignable
 * Remplace les toasts en cascade par une UI cohérente et non-intrusive
 */
export function GlobalHealthStatus() {
  const [isOnline, setIsOnline] = useState(true)
  const [isChecking, setIsChecking] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)

  useEffect(() => {
    // S'abonner aux changements d'état
    const unsubscribe = healthCheck.subscribe((online) => {
      setIsOnline(online)
      if (online) {
        setIsDismissed(false) // Réafficher quand ça revient
      }
    })

    // Démarrer le health check
    healthCheck.start()

    return () => {
      unsubscribe()
    }
  }, [])

  const handleRetry = async () => {
    setIsChecking(true)
    await healthCheck.forceCheck()
    setIsChecking(false)
  }

  const handleDismiss = () => {
    setIsDismissed(true)
    // Réactiver automatiquement après 5 minutes
    setTimeout(() => setIsDismissed(false), 5 * 60 * 1000)
  }

  // Ne rien afficher si tout va bien ou si l'utilisateur a dismiss
  if (isOnline || isDismissed) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-50 border-b border-amber-200">
      <div className="max-w-7xl mx-auto px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 bg-amber-100 rounded-full">
              <WifiOff className="w-4 h-4 text-amber-600" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-amber-800">
                Serveur injoignable
              </span>
              <span className="text-amber-600 text-sm hidden sm:inline">
                Certaines fonctionnalités peuvent être indisponibles
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRetry}
              disabled={isChecking}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-md transition-colors disabled:opacity-50"
            >
              {isChecking ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Vérification...
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  Réessayer
                </>
              )}
            </button>

            <button
              onClick={handleDismiss}
              className="p-1.5 text-amber-500 hover:text-amber-700 hover:bg-amber-100 rounded-md transition-colors"
              title="Masquer (5 minutes)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * ServerOfflineModal - Modal bloquante quand le serveur est complètement hors ligne
 * S'affiche uniquement après plusieurs échecs consécutifs
 */
export function ServerOfflineModal() {
  const [isOffline, setIsOffline] = useState(false)
  const [isChecking, setIsChecking] = useState(false)

  useEffect(() => {
    const unsubscribe = healthCheck.subscribe((online) => {
      setIsOffline(!online)
    })

    healthCheck.start()

    return () => unsubscribe()
  }, [])

  const handleRetry = async () => {
    setIsChecking(true)
    const isOnline = await healthCheck.forceCheck()
    setIsChecking(false)
    if (isOnline) {
      window.location.reload()
    }
  }

  if (!isOffline) return null

  return (
    <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
          <Server className="w-10 h-10 text-red-600" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-gray-900">
            Serveur injoignable
          </h2>
          <p className="text-gray-600">
            Impossible de se connecter au serveur YAMTIKEN. Vérifiez votre connexion internet ou réessayez.
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-amber-800">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">Données locales</span>
          </div>
          <p className="text-sm text-amber-700 mt-1">
            Les modifications seront synchronisées automatiquement quand le serveur reviendra.
          </p>
        </div>

        <button
          onClick={handleRetry}
          disabled={isChecking}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#1A6B35] text-white font-medium rounded-lg hover:bg-[#145028] transition-colors disabled:opacity-50"
        >
          {isChecking ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              Vérification...
            </>
          ) : (
            <>
              <RefreshCw className="w-5 h-5" />
              Réessayer la connexion
            </>
          )}
        </button>

        <p className="text-xs text-gray-500">
          Si le problème persiste, contactez le support technique.
        </p>
      </div>
    </div>
  )
}

export default GlobalHealthStatus
