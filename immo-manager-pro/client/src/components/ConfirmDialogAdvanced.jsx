import { useState } from 'react'
import { AlertTriangle, X, Info, CheckCircle } from 'lucide-react'

/**
 * Composant de confirmation avancé avec:
 - Typologie des actions (warning/danger/info/success)
 - Vérification de dépendances
 - Texte de confirmation à taper
 - Liste des conséquences
 */
const ConfirmDialogAdvanced = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirmation',
  message = 'Êtes-vous sûr ?',
  type = 'warning', // 'warning' | 'danger' | 'info' | 'success'
  itemName = '',
  itemType = '',
  dependencies = [], // [{ table: 'contrats', count: 3, label: 'contrats actifs' }]
  consequences = [], // ['Les paiements associés seront archivés', ...]
  requireText = null, // Texte à taper pour confirmer (ex: "SUPPRIMER")
  confirmButtonText = 'Confirmer',
  cancelButtonText = 'Annuler',
  isLoading = false
}) => {
  const [confirmationText, setConfirmationText] = useState('')
  const [showDetails, setShowDetails] = useState(false)

  if (!isOpen) return null

  const styles = {
    warning: {
      icon: AlertTriangle,
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      iconColor: '#F59E0B',
      buttonBg: '#DC2626',
      buttonHover: '#B91C1C'
    },
    danger: {
      icon: AlertTriangle,
      bg: 'bg-red-50',
      border: 'border-red-200',
      iconColor: '#DC2626',
      buttonBg: '#DC2626',
      buttonHover: '#B91C1C'
    },
    info: {
      icon: Info,
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      iconColor: '#3B82F6',
      buttonBg: '#1A6B35',
      buttonHover: '#0D3B1F'
    },
    success: {
      icon: CheckCircle,
      bg: 'bg-green-50',
      border: 'border-green-200',
      iconColor: '#10B981',
      buttonBg: '#10B981',
      buttonHover: '#059669'
    }
  }

  const currentStyle = styles[type]
  const Icon = currentStyle.icon

  const canConfirm = !requireText || confirmationText === requireText

  const hasDependencies = dependencies.length > 0
  const totalDependencies = dependencies.reduce((sum, dep) => sum + dep.count, 0)

  const handleConfirm = () => {
    if (canConfirm && !isLoading) {
      onConfirm()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div 
        className={`bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200 ${currentStyle.border} border-2`}
      >
        {/* Header avec icône */}
        <div className={`${currentStyle.bg} p-6 flex items-start gap-4`}>
          <div 
            className="p-3 rounded-full bg-white shadow-sm flex-shrink-0"
            style={{ color: currentStyle.iconColor }}
          >
            <Icon size={28} />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-900">
              {title}
            </h3>
            <p className="text-gray-600 mt-1">
              {message}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
          >
            <X size={24} />
          </button>
        </div>

        {/* Corps du dialog */}
        <div className="p-6 space-y-4">
          {/* Item concerné */}
          {itemName && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-500 uppercase tracking-wide">
                {itemType || 'Élément'}:
              </span>
              <span className="font-semibold text-gray-900">
                {itemName}
              </span>
            </div>
          )}

          {/* Alertes dépendances */}
          {hasDependencies && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={18} className="text-amber-600" />
                <span className="font-semibold text-amber-800">
                  ⚠️ Cet élément a des dépendances ({totalDependencies})
                </span>
              </div>
              <ul className="space-y-1 ml-6">
                {dependencies.map((dep, idx) => (
                  <li key={idx} className="text-sm text-amber-700">
                    • {dep.count} {dep.label || dep.table}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-amber-600 mt-2">
                La suppression est bloquée car ces éléments dépendent de celui-ci.
              </p>
            </div>
          )}

          {/* Conséquences */}
          {consequences.length > 0 && (
            <div>
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                {showDetails ? 'Masquer' : 'Voir'} les conséquences
              </button>
              {showDetails && (
                <ul className="mt-2 space-y-2 bg-gray-50 rounded-lg p-3">
                  {consequences.map((consequence, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-red-500 mt-0.5">•</span>
                      {consequence}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Champ de confirmation */}
          {requireText && !hasDependencies && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Pour confirmer, tapez : <strong className="text-red-600">{requireText}</strong>
              </label>
              <input
                type="text"
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                className={`w-full px-4 py-2 border-2 rounded-lg focus:outline-none focus:ring-2 transition-all ${
                  confirmationText === requireText
                    ? 'border-green-500 focus:ring-green-200'
                    : 'border-gray-300 focus:border-gray-400 focus:ring-gray-200'
                }`}
                placeholder={`Tapez ${requireText}...`}
              />
            </div>
          )}
        </div>

        {/* Footer avec boutons */}
        <div className="p-6 pt-0 flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 border-2 border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {cancelButtonText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm || isLoading || hasDependencies}
            className="flex-1 px-4 py-2.5 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ 
              backgroundColor: canConfirm && !hasDependencies ? currentStyle.buttonBg : '#9CA3AF'
            }}
          >
            {isLoading ? (
              <>
                <span className="animate-spin inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                Traitement...
              </>
            ) : (
              confirmButtonText
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDialogAdvanced
