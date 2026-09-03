import { Bell } from 'lucide-react'
import { useAlertes } from '../hooks/useAlertes'
import { Link } from 'react-router-dom'

/**
 * Badge de notification d'alertes pour la barre de navigation
 * Affiche le nombre d'alertes non vues avec animation
 */
const AlertesBadge = () => {
  const { alertes, stats, loading } = useAlertes({ autoRefresh: true })

  // Compter les alertes non vues
  const alertesNonVues = alertes.filter(a => !a.vu).length

  if (loading) {
    return (
      <div className="relative">
        <Bell className="w-6 h-6 text-gray-400 animate-pulse" />
      </div>
    )
  }

  return (
    <Link to="/alertes" className="relative group">
      <div className="relative">
        <Bell 
          className={`w-6 h-6 transition-all ${
            alertesNonVues > 0 
              ? 'text-orange-500 animate-bounce' 
              : 'text-gray-600 group-hover:text-green-600'
          }`}
        />
        
        {/* Badge de compteur */}
        {alertesNonVues > 0 && (
          <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
            {alertesNonVues > 9 ? '9+' : alertesNonVues}
          </span>
        )}
      </div>

      {/* Tooltip au survol */}
      <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border-2 border-gray-200 p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-gray-900">Alertes</span>
            <span className="text-sm text-gray-500">{stats.total} total</span>
          </div>
          
          <div className="space-y-1 text-sm">
            {stats.danger > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-red-600">🚨 Urgent</span>
                <span className="font-semibold text-red-700">{stats.danger}</span>
              </div>
            )}
            {stats.warning > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-orange-600">⚠️ Attention</span>
                <span className="font-semibold text-orange-700">{stats.warning}</span>
              </div>
            )}
            {stats.info > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-blue-600">ℹ️ Info</span>
                <span className="font-semibold text-blue-700">{stats.info}</span>
              </div>
            )}
          </div>

          {alertesNonVues > 0 && (
            <div className="pt-2 border-t border-gray-200">
              <span className="text-xs text-gray-600">
                {alertesNonVues} alerte{alertesNonVues > 1 ? 's' : ''} non vue{alertesNonVues > 1 ? 's' : ''}
              </span>
            </div>
          )}

          <div className="pt-2">
            <span className="text-xs text-green-600 font-medium">
              Cliquez pour voir les détails →
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

export default AlertesBadge
