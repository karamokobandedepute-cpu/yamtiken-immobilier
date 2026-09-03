import { useEffect, useState } from 'react'
import logoSrc from '../assets/logo/logo behemoth.png'

/**
 * Composant de chargement amélioré pour le lazy loading des pages
 * Affiche un loader élégant avec logo et barre de progression
 */
const LoadingFallback = ({ message = 'Chargement de la page...' }) => {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    // Simuler une progression pour l'UX
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return prev
        return prev + 10
      })
    }, 100)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-green-50 to-white">
      <div className="flex flex-col items-center gap-6 max-w-md w-full px-8">
        {/* Logo */}
        <div className="w-24 h-24 rounded-full bg-white shadow-lg flex items-center justify-center animate-pulse">
          <img 
            src={logoSrc} 
            alt="YAMTIKEN" 
            className="w-16 h-16 object-contain"
          />
        </div>

        {/* Spinner */}
        <div className="relative">
          <div 
            className="w-16 h-16 border-4 border-t-transparent rounded-full animate-spin" 
            style={{ 
              borderColor: '#1A6B35', 
              borderTopColor: 'transparent' 
            }}
          />
          <div 
            className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-green-300 rounded-full animate-spin" 
            style={{ 
              animationDirection: 'reverse',
              animationDuration: '1.5s'
            }}
          />
        </div>

        {/* Message */}
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold" style={{ color: '#0D3B1F' }}>
            {message}
          </p>
          <p className="text-sm" style={{ color: '#6B7280' }}>
            Veuillez patienter...
          </p>
        </div>

        {/* Barre de progression */}
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div 
            className="h-full rounded-full transition-all duration-300 ease-out"
            style={{ 
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #1A6B35 0%, #2D9E57 100%)'
            }}
          />
        </div>

        {/* Pourcentage */}
        <p className="text-xs font-medium" style={{ color: '#1A6B35' }}>
          {progress}%
        </p>
      </div>
    </div>
  )
}

/**
 * Loader minimaliste pour les composants plus petits
 */
export const MiniLoader = () => (
  <div className="flex items-center justify-center p-8">
    <div className="flex flex-col items-center gap-3">
      <div 
        className="w-8 h-8 border-3 border-t-transparent rounded-full animate-spin" 
        style={{ borderColor: '#1A6B35', borderTopColor: 'transparent' }}
      />
      <p className="text-xs font-medium" style={{ color: '#6B7280' }}>
        Chargement...
      </p>
    </div>
  </div>
)

/**
 * Skeleton loader pour les listes
 */
export const SkeletonLoader = ({ rows = 5 }) => (
  <div className="space-y-3 p-6">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="animate-pulse flex space-x-4">
        <div className="rounded-full bg-gray-200 h-12 w-12" />
        <div className="flex-1 space-y-2 py-1">
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
        </div>
      </div>
    ))}
  </div>
)

export default LoadingFallback
