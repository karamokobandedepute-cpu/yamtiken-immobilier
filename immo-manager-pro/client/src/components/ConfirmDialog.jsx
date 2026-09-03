import { AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react'

const icons = {
  success: CheckCircle,
  warning: AlertTriangle,
  danger: XCircle,
  info: Info
}

const colors = {
  success: '#1A6B35',
  warning: '#F59E0B',
  danger: '#DC2626',
  info: '#3B82F6'
}

const ConfirmDialog = ({ open, title, message, type = 'warning', confirmText = 'Confirmer', cancelText = 'Annuler', onConfirm, onCancel, cause }) => {
  if (!open) return null

  const Icon = icons[type] || icons.warning
  const color = colors[type] || colors.warning

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-sm p-6" style={{ background: 'white', borderRadius: '16px' }}>
        <div className="flex items-center gap-3 mb-4">
          <Icon size={24} style={{ color }} />
          <h3 className="text-lg font-bold" style={{ color: '#0D3B1F' }}>{title}</h3>
        </div>
        <p className="text-sm mb-2" style={{ color: '#374151' }}>{message}</p>
        {cause && (
          <p className="text-xs mb-4 p-2 rounded" style={{ color: '#DC2626', background: '#FEF2F2' }}>
            Cause : {cause}
          </p>
        )}
        <div className="flex gap-3 mt-4">
          <button
            onClick={onCancel}
            className="flex-1 py-2 px-4 rounded-lg font-medium text-sm border-2 transition-all"
            style={{ borderColor: '#E5E7EB', color: '#6B7280' }}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2 px-4 rounded-lg font-medium text-sm text-white transition-all"
            style={{ background: color }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDialog
