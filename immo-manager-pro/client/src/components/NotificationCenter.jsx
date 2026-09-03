import { useState, useEffect, useRef } from 'react'
import { Bell, X, FileText, Users, FileSpreadsheet, Trash2, LogIn } from 'lucide-react'
import { useActivityStore } from '../stores/activityStore'
import { useAuthStore } from '../stores/authStore'
import { isSuperAdminUser } from '../utils/constants'

const getRelativeTime = (dateString) => {
  const diff = Date.now() - new Date(dateString).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (m < 1)  return 'À l\'instant'
  if (m < 60) return `Il y a ${m} min`
  if (h < 24) return `Il y a ${h}h`
  if (d <  7) return `Il y a ${d}j`
  return new Date(dateString).toLocaleDateString('fr-FR')
}

const TYPE_CONFIG = {
  LOGIN:           { icon: LogIn,          bg: '#DCFCE7', color: '#166534', label: 'Connexion' },
  PDF_GENERATED:   { icon: FileText,       bg: '#FEF3C7', color: '#92400E', label: 'PDF' },
  EXCEL_GENERATED: { icon: FileSpreadsheet,bg: '#DBEAFE', color: '#1E40AF', label: 'Excel' },
}

const NotificationCenter = () => {
  const [isOpen, setIsOpen]   = useState(false)
  const [filter, setFilter]   = useState('ALL')
  const [readIds, setReadIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('notif-read') || '[]')) } catch { return new Set() }
  })
  const dropdownRef = useRef(null)

  const { user } = useAuthStore()
  const { logs, clearLogs } = useActivityStore()

  const isSuperAdmin = isSuperAdminUser(user)

  // Fermer au clic extérieur
  useEffect(() => {
    const h = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const markRead = (id) => {
    setReadIds(prev => {
      const next = new Set(prev)
      next.add(id)
      localStorage.setItem('notif-read', JSON.stringify([...next]))
      return next
    })
  }

  const markAllRead = () => {
    const allIds = logs.map(l => l.id)
    setReadIds(new Set(allIds))
    localStorage.setItem('notif-read', JSON.stringify(allIds))
  }

  const filtered = logs.filter(l => {
    if (filter === 'ALL')             return true
    if (filter === 'UNREAD')          return !readIds.has(l.id)
    if (filter === 'LOGIN')           return l.type === 'LOGIN'
    if (filter === 'DOCS')            return ['PDF_GENERATED','EXCEL_GENERATED'].includes(l.type)
    return true
  })

  const unread = logs.filter(l => !readIds.has(l.id)).length

  // Couleur de la cloche selon le nombre de non-lus
  const bellState = unread === 0
    ? { color: 'rgba(255,255,255,0.55)', glow: 'transparent', anim: '' }
    : unread <= 3
      ? { color: '#FCD34D', glow: 'rgba(251,191,36,0.25)', anim: 'animate-pulse' }
      : { color: '#F87171', glow: 'rgba(239,68,68,0.30)',  anim: 'animate-bounce' }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bouton cloche */}
      <button
        onClick={() => { setIsOpen(o => !o); if (!isOpen) markAllRead() }}
        className={`relative p-2 rounded-lg transition-all ${unread > 0 ? bellState.anim : 'hover:bg-white/10'}`}
        style={unread > 0 ? { background: bellState.glow, boxShadow: `0 0 8px 2px ${bellState.glow}` } : {}}
        title={unread > 0 ? `${unread} notification${unread > 1 ? 's' : ''} non lue${unread > 1 ? 's' : ''}` : 'Notifications'}
      >
        <Bell size={22} style={{ color: bellState.color, transition: 'color 0.4s' }} />
        {unread > 0 && (
          <span
            className="absolute -top-1 -right-1 w-5 h-5 text-white text-xs font-bold rounded-full flex items-center justify-center"
            style={{ background: unread <= 3 ? '#F59E0B' : '#EF4444' }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-2xl overflow-hidden z-50"
             style={{ width: '380px' }}>
          {/* Header */}
          <div className="p-4 border-b" style={{ background: '#0D3B1F' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold flex items-center gap-2 text-sm">
                <Bell size={16} />
                Activité utilisateurs
                {unread > 0 && (
                  <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">{unread}</span>
                )}
              </h3>
              <div className="flex items-center gap-1">
                {isSuperAdmin && logs.length > 0 && (
                  <button onClick={clearLogs} className="p-1.5 hover:bg-white/20 rounded-lg" title="Effacer tout">
                    <Trash2 size={14} className="text-white/70" />
                  </button>
                )}
                <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-white/20 rounded-lg">
                  <X size={16} className="text-white" />
                </button>
              </div>
            </div>
            {/* Filtres */}
            <div className="flex gap-1.5 flex-wrap">
              {[
                { key: 'ALL',   label: 'Tout' },
                { key: 'UNREAD',label: 'Non lus' },
                { key: 'LOGIN', label: 'Connexions' },
                { key: 'DOCS',  label: 'Documents' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className="px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors"
                  style={filter === key
                    ? { background: '#C8960C', color: '#0D3B1F' }
                    : { background: 'rgba(255,255,255,0.15)', color: 'white' }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Liste */}
          <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div className="p-10 text-center text-gray-400">
                <Bell size={36} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Aucune activité enregistrée</p>
                {isSuperAdmin && <p className="text-xs mt-1 opacity-60">Mode fantôme actif — vos actions ne sont pas tracées</p>}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filtered.map((log) => {
                  const cfg = TYPE_CONFIG[log.type] || TYPE_CONFIG.LOGIN
                  const Icon = cfg.icon
                  const isUnread = !readIds.has(log.id)
                  return (
                    <div
                      key={log.id}
                      onClick={() => markRead(log.id)}
                      className="p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                      style={{ background: isUnread ? '#F0FDF4' : undefined }}
                    >
                      <div className="flex gap-3 items-start">
                        {/* Avatar utilisateur */}
                        <div className="flex-shrink-0">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white"
                               style={{ background: '#1A6B35' }}>
                            {log.userName?.slice(0,2).toUpperCase() || <Users size={14} />}
                          </div>
                        </div>
                        {/* Contenu */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                            <span className="text-xs font-semibold text-gray-900 truncate max-w-[120px]">
                              {log.userName || log.userEmail}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0"
                                  style={{ background: cfg.bg, color: cfg.color }}>
                              <Icon size={10} className="inline mr-0.5" />
                              {cfg.label}
                            </span>
                            {isUnread && <span className="w-1.5 h-1.5 bg-green-500 rounded-full flex-shrink-0" />}
                          </div>
                          <p className="text-xs text-gray-600 truncate">{log.description}</p>
                          {log.type !== 'LOGIN' && log.metadata?.filename && (
                            <p className="text-[11px] text-gray-400 truncate mt-0.5 font-mono">
                              📄 {log.metadata.filename}
                            </p>
                          )}
                        </div>
                        {/* Heure */}
                        <span className="text-[11px] text-gray-400 flex-shrink-0 pt-0.5">
                          {getRelativeTime(log.createdAt)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer stats */}
          {logs.length > 0 && (
            <div className="px-4 py-2 border-t text-xs text-gray-500 flex justify-between items-center"
                 style={{ background: '#F9FFF9' }}>
              <span>{logs.length} événement{logs.length > 1 ? 's' : ''} enregistré{logs.length > 1 ? 's' : ''}</span>
              <span className="text-gray-400">
                {logs.filter(l => l.type === 'LOGIN').length} connexion{logs.filter(l => l.type === 'LOGIN').length > 1 ? 's' : ''} •{' '}
                {logs.filter(l => ['PDF_GENERATED','EXCEL_GENERATED'].includes(l.type)).length} doc{logs.filter(l => ['PDF_GENERATED','EXCEL_GENERATED'].includes(l.type)).length > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default NotificationCenter
