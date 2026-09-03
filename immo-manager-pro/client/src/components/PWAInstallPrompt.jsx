import { useState, useEffect } from 'react'
import { Download, X, Smartphone } from 'lucide-react'

/**
 * Composant pour inviter l'utilisateur à installer la PWA
 * Affiche un prompt élégant quand l'app est installable
 */
const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Vérifier si déjà installé
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }

    // Vérifier si déjà refusé
    const dismissed = localStorage.getItem('pwa-install-dismissed')
    if (dismissed) {
      const dismissedDate = new Date(dismissed)
      const now = new Date()
      const daysSince = (now - dismissedDate) / (1000 * 60 * 60 * 24)
      
      // Réafficher après 7 jours
      if (daysSince < 7) {
        return
      }
    }

    // Écouter l'événement beforeinstallprompt
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      
      // Afficher le prompt après 30 secondes
      setTimeout(() => {
        setShowPrompt(true)
      }, 30000)
    }

    window.addEventListener('beforeinstallprompt', handler)

    // Écouter l'installation
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true)
      setShowPrompt(false)
      setDeferredPrompt(null)
    })

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    // Afficher le prompt natif
    deferredPrompt.prompt()

    // Attendre la réponse
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      console.log('✅ PWA installée')
    } else {
      console.log('❌ Installation refusée')
    }

    setDeferredPrompt(null)
    setShowPrompt(false)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    localStorage.setItem('pwa-install-dismissed', new Date().toISOString())
  }

  // Ne rien afficher si installé ou pas de prompt
  if (isInstalled || !showPrompt || !deferredPrompt) {
    return null
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 animate-slide-up">
      <div 
        className="bg-white rounded-2xl shadow-2xl border-2 overflow-hidden"
        style={{ borderColor: '#1A6B35' }}
      >
        {/* Header */}
        <div 
          className="p-4 text-white flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg, #1A6B35 0%, #2D9E57 100%)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center">
              <Smartphone className="w-6 h-6" style={{ color: '#1A6B35' }} />
            </div>
            <div>
              <h3 className="font-bold text-lg">Installer l'application</h3>
              <p className="text-sm text-green-100">Accès rapide depuis votre écran d'accueil</p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          <p className="text-gray-700 text-sm">
            Installez <span className="font-semibold">YAMTIKEN Immo Manager</span> sur votre appareil pour :
          </p>
          
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: '#1A6B35' }}>✓</span>
              <span>Accès instantané depuis l'écran d'accueil</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: '#1A6B35' }}>✓</span>
              <span>Fonctionnement hors ligne</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: '#1A6B35' }}>✓</span>
              <span>Expérience app native</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: '#1A6B35' }}>✓</span>
              <span>Notifications push (bientôt)</span>
            </li>
          </ul>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleInstall}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-white font-semibold rounded-xl transition-all hover:shadow-lg"
              style={{ background: 'linear-gradient(135deg, #1A6B35 0%, #2D9E57 100%)' }}
            >
              <Download className="w-5 h-5" />
              Installer maintenant
            </button>
            <button
              onClick={handleDismiss}
              className="px-4 py-3 text-gray-600 font-medium rounded-xl border-2 border-gray-200 hover:bg-gray-50 transition-colors"
            >
              Plus tard
            </button>
          </div>

          <p className="text-xs text-gray-500 text-center pt-2">
            Gratuit • Aucune donnée collectée • Désinstallable à tout moment
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * Badge "Installé" pour indiquer que l'app est en mode PWA
 */
export const PWAInstalledBadge = () => {
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
    }
  }, [])

  if (!isInstalled) return null

  return (
    <div className="fixed top-4 right-4 z-50">
      <div 
        className="px-3 py-1 rounded-full text-xs font-medium text-white flex items-center gap-2 shadow-lg"
        style={{ background: '#1A6B35' }}
      >
        <span className="w-2 h-2 bg-green-300 rounded-full animate-pulse" />
        Mode App
      </div>
    </div>
  )
}

export default PWAInstallPrompt
