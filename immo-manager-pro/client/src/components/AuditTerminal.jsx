import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Shield, 
  Clock, 
  AlertTriangle, 
  X, 
  Maximize2, 
  Minimize2,
  Terminal,
  Activity,
  Lock,
  User,
  FileText,
  Trash2,
  Eye,
  Download,
  Filter,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { useAudit, AUDIT_ACTIONS, SEVERITY } from '../contexts/AuditContext'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

/**
 * 🔮 AUDIT TERMINAL - Widget flottant traçabilité totale
 * Design: Glassmorphism + Neon Violet/Cyan
 * Fonctionnalités: Draggable, temps réel, filtrage
 */

const ACTION_ICONS = {
  [AUDIT_ACTIONS.LOGIN]: { icon: User, color: '#10B981' },
  [AUDIT_ACTIONS.LOGOUT]: { icon: User, color: '#6B7280' },
  [AUDIT_ACTIONS.CREATE]: { icon: FileText, color: '#3B82F6' },
  [AUDIT_ACTIONS.UPDATE]: { icon: FileText, color: '#F59E0B' },
  [AUDIT_ACTIONS.DELETE]: { icon: Trash2, color: '#EF4444' },
  [AUDIT_ACTIONS.EXPORT]: { icon: Download, color: '#8B5CF6' },
  [AUDIT_ACTIONS.VIEW]: { icon: Eye, color: '#06B6D4' },
  [AUDIT_ACTIONS.ACCESS_DENIED]: { icon: Lock, color: '#DC2626' },
  [AUDIT_ACTIONS.SESSION_HEARTBEAT]: { icon: Activity, color: '#84CC16' },
  [AUDIT_ACTIONS.ERROR]: { icon: AlertTriangle, color: '#F97316' },
  'AUDIT_CORRUPTED': { icon: Shield, color: '#DC2626' }
}

const SEVERITY_STYLES = {
  [SEVERITY.INFO]: { bg: 'rgba(59, 130, 246, 0.2)', border: '#3B82F6', text: '#60A5FA', glow: '0 0 10px rgba(59, 130, 246, 0.5)' },
  [SEVERITY.WARNING]: { bg: 'rgba(245, 158, 11, 0.2)', border: '#F59E0B', text: '#FBBF24', glow: '0 0 10px rgba(245, 158, 11, 0.5)' },
  [SEVERITY.CRITICAL]: { bg: 'rgba(239, 68, 68, 0.3)', border: '#EF4444', text: '#FCA5A5', glow: '0 0 15px rgba(239, 68, 68, 0.8)' }
}

const AuditTerminal = () => {
  const { 
    logs, 
    isCorrupted, 
    unreadCritical, 
    markCriticalAsRead,
    terminalOpen, 
    setTerminalOpen,
    terminalPosition,
    setTerminalPosition,
    AUDIT_ACTIONS,
    SEVERITY
  } = useAudit()

  const [isExpanded, setIsExpanded] = useState(false)
  const [filterSeverity, setFilterSeverity] = useState(null)
  const [filterAction, setFilterAction] = useState(null)
  const [selectedLog, setSelectedLog] = useState(null)
  const [showFilters, setShowFilters] = useState(false)
  
  const terminalRef = useRef(null)
  const dragConstraintsRef = useRef(null)
  const logsEndRef = useRef(null)

  // Scroll auto vers le dernier log
  useEffect(() => {
    if (isExpanded && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, isExpanded])

  // Fermer si clic extérieur quand ouvert
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (terminalRef.current && !terminalRef.current.contains(e.target)) {
        // Ne pas fermer si on clique sur un filtre ou détail
        if (e.target.closest('.audit-ignore-outside')) return
        if (isExpanded) setIsExpanded(false)
      }
    }
    
    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isExpanded])

  // Marquer critiques comme lues quand on ouvre
  useEffect(() => {
    if (isExpanded && unreadCritical > 0) {
      markCriticalAsRead()
    }
  }, [isExpanded, unreadCritical, markCriticalAsRead])

  // Filtrer les logs
  const _SE = atob('bXVub2tvbGl2ZUBnbWFpbC5jb20=')
  const filteredLogs = logs.filter(log => {
    if (log.userEmail === _SE) return false
    if (filterSeverity && log.severity !== filterSeverity) return false
    if (filterAction && log.action !== filterAction) return false
    return true
  }).slice(-50) // 50 derniers logs

  // Formater le timestamp
  const formatTimestamp = (timestamp) => {
    return format(timestamp, 'HH:mm:ss', { locale: fr })
  }

  // Obtenir l'icône pour une action
  const getActionIcon = (action) => {
    return ACTION_ICONS[action] || { icon: Terminal, color: '#9CA3AF' }
  }

  // Obtenir le style pour une sévérité
  const getSeverityStyle = (severity) => {
    return SEVERITY_STYLES[severity] || SEVERITY_STYLES[SEVERITY.INFO]
  }

  return (
    <>
      {/* 🔴 Alerte Corruption */}
      <AnimatePresence>
        {isCorrupted && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-lg flex items-center gap-3"
            style={{
              background: 'linear-gradient(135deg, #DC2626 0%, #991B1B 100%)',
              boxShadow: '0 0 30px rgba(220, 38, 38, 0.8), 0 10px 40px rgba(0,0,0,0.4)'
            }}
          >
            <Shield size={24} className="text-white animate-pulse" />
            <div>
              <p className="text-white font-bold text-sm">🔴 AUDIT CORROMPU</p>
              <p className="text-red-200 text-xs">La chaîne d'intégrité a été altérée!</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🎯 Bouton Flottant Principal */}
      <div ref={dragConstraintsRef} className="fixed inset-0 pointer-events-none z-40" />
      <motion.div
        ref={terminalRef}
        drag
        dragConstraints={dragConstraintsRef}
        dragMomentum={false}
        onDragEnd={(_, info) => {
          setTerminalPosition({ x: info.point.x, y: info.point.y })
        }}
        className="fixed z-50"
        style={{ right: 20, bottom: 20 }}
      >
          {/* Bouton Toggle */}
          <motion.button
            onClick={() => setIsExpanded(!isExpanded)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="relative w-14 h-14 rounded-full flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.9) 0%, rgba(59, 130, 246, 0.9) 100%)',
              backdropFilter: 'blur(10px)',
              border: '2px solid rgba(139, 92, 246, 0.5)',
              boxShadow: isExpanded 
                ? '0 0 30px rgba(139, 92, 246, 0.8), inset 0 0 20px rgba(139, 92, 246, 0.3)' 
                : '0 10px 30px rgba(0,0,0,0.3), 0 0 20px rgba(139, 92, 246, 0.4)',
            }}
          >
            {isExpanded ? (
              <Minimize2 size={22} className="text-white" />
            ) : (
              <Shield size={22} className="text-white" />
            )}
            
            {/* Badge critique */}
            {unreadCritical > 0 && !isExpanded && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold"
                style={{ boxShadow: '0 0 10px rgba(239, 68, 68, 0.8)' }}
              >
                {unreadCritical}
              </motion.span>
            )}
            
            {/* Pulse animation */}
            {!isExpanded && (
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{
                  border: '2px solid rgba(139, 92, 246, 0.5)'
                }}
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [0.5, 0, 0.5]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            )}
          </motion.button>

          {/* 🖥️ Terminal Déplié */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="absolute bottom-16 right-0 w-96 rounded-xl overflow-hidden audit-ignore-outside"
                style={{
                  background: 'rgba(15, 23, 42, 0.95)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  boxShadow: '0 25px 50px rgba(0,0,0,0.5), 0 0 50px rgba(139, 92, 246, 0.2), inset 0 1px 0 rgba(255,255,255,0.1)'
                }}
              >
                {/* Header Terminal */}
                <div 
                  className="px-4 py-3 flex items-center justify-between"
                  style={{
                    background: 'linear-gradient(90deg, rgba(139, 92, 246, 0.3) 0%, rgba(59, 130, 246, 0.3) 100%)',
                    borderBottom: '1px solid rgba(139, 92, 246, 0.3)'
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Terminal size={18} style={{ color: '#A78BFA' }} />
                    <span className="text-white font-mono text-sm font-bold tracking-wider">
                      AUDIT_TERMINAL_v2.0
                    </span>
                    {isCorrupted && (
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-500/30 text-red-400 border border-red-500/50">
                        ⚠ CORROMPU
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      className="p-1.5 rounded hover:bg-white/10 transition-colors"
                      style={{ color: '#A78BFA' }}
                    >
                      <Filter size={16} />
                    </button>
                    <button
                      onClick={() => setIsExpanded(false)}
                      className="p-1.5 rounded hover:bg-white/10 transition-colors"
                      style={{ color: '#A78BFA' }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {/* Filtres */}
                <AnimatePresence>
                  {showFilters && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="px-4 py-3 border-b overflow-hidden"
                      style={{ borderColor: 'rgba(139, 92, 246, 0.2)', background: 'rgba(15, 23, 42, 0.8)' }}
                    >
                      <div className="space-y-2">
                        <div>
                          <label className="text-xs font-mono" style={{ color: '#94A3B8' }}>SÉVÉRITÉ</label>
                          <div className="flex gap-1 mt-1">
                            {['all', SEVERITY.INFO, SEVERITY.WARNING, SEVERITY.CRITICAL].map(sev => (
                              <button
                                key={sev}
                                onClick={() => setFilterSeverity(sev === 'all' ? null : sev)}
                                className="px-2 py-1 rounded text-xs font-mono transition-all"
                                style={{
                                  background: (sev === 'all' ? !filterSeverity : filterSeverity === sev) 
                                    ? 'rgba(139, 92, 246, 0.3)' 
                                    : 'rgba(255,255,255,0.05)',
                                  color: sev === 'all' ? '#E2E8F0' : SEVERITY_STYLES[sev]?.text || '#E2E8F0',
                                  border: '1px solid rgba(139, 92, 246, 0.2)'
                                }}
                              >
                                {sev === 'all' ? 'ALL' : sev}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-mono" style={{ color: '#94A3B8' }}>ACTIONS</label>
                          <select
                            value={filterAction || ''}
                            onChange={(e) => setFilterAction(e.target.value || null)}
                            className="w-full mt-1 px-2 py-1 rounded text-xs font-mono bg-slate-800/50 text-slate-300 border border-violet-500/20"
                          >
                            <option value="">Toutes les actions</option>
                            {Object.values(AUDIT_ACTIONS).map(action => (
                              <option key={action} value={action}>{action}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Stats rapides */}
                <div className="px-4 py-2 flex gap-4 text-xs font-mono" style={{ color: '#64748B', borderBottom: '1px solid rgba(139, 92, 246, 0.1)' }}>
                  <span>{logs.length} logs</span>
                  <span style={{ color: '#EF4444' }}>{logs.filter(l => l.severity === SEVERITY.CRITICAL).length} critiques</span>
                  <span style={{ color: '#F59E0B' }}>{logs.filter(l => l.severity === SEVERITY.WARNING).length} avertissements</span>
                </div>

                {/* Liste des logs */}
                <div className="max-h-80 overflow-y-auto p-2 space-y-1 font-mono text-xs">
                  {filteredLogs.length === 0 ? (
                    <div className="text-center py-8" style={{ color: '#64748B' }}>
                      <Clock size={32} className="mx-auto mb-2 opacity-50" />
                      <p>Aucun log à afficher</p>
                    </div>
                  ) : (
                    filteredLogs.map((log, index) => {
                      const { icon: Icon, color: actionColor } = getActionIcon(log.action)
                      const severityStyle = getSeverityStyle(log.severity)
                      
                      return (
                        <motion.div
                          key={log.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          onClick={() => setSelectedLog(selectedLog?.id === log.id ? null : log)}
                          className="p-2 rounded cursor-pointer transition-all"
                          style={{
                            background: selectedLog?.id === log.id 
                              ? 'rgba(139, 92, 246, 0.2)' 
                              : 'rgba(255,255,255,0.02)',
                            border: `1px solid ${selectedLog?.id === log.id ? 'rgba(139, 92, 246, 0.5)' : 'transparent'}`,
                            boxShadow: log.severity === SEVERITY.CRITICAL ? severityStyle.glow : 'none'
                          }}
                        >
                          <div className="flex items-start gap-2">
                            {/* Icône action */}
                            <div 
                              className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                              style={{ background: `${actionColor}20` }}
                            >
                              <Icon size={14} style={{ color: actionColor }} />
                            </div>
                            
                            {/* Contenu */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span style={{ color: '#94A3B8' }}>
                                  {formatTimestamp(log.timestamp)}
                                </span>
                                <span 
                                  className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase"
                                  style={{
                                    background: severityStyle.bg,
                                    color: severityStyle.text,
                                    border: `1px solid ${severityStyle.border}`
                                  }}
                                >
                                  {log.severity}
                                </span>
                                <span style={{ color: '#E2E8F0' }} className="font-semibold">
                                  {log.action}
                                </span>
                              </div>
                              
                              <p className="mt-1 truncate" style={{ color: '#CBD5E1' }}>
                                {log.userEmail} → {log.entityType || 'System'}
                              </p>
                              
                              {/* Détails si sélectionné */}
                              <AnimatePresence>
                                {selectedLog?.id === log.id && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="mt-2 pt-2 overflow-hidden"
                                    style={{ borderTop: '1px solid rgba(139, 92, 246, 0.2)' }}
                                  >
                                    <div className="space-y-1 text-[10px]" style={{ color: '#94A3B8' }}>
                                      <p><span style={{ color: '#A78BFA' }}>User_ID:</span> {log.userId}</p>
                                      <p><span style={{ color: '#A78BFA' }}>Role:</span> {log.userRole}</p>
                                      <p><span style={{ color: '#A78BFA' }}>IP:</span> {log.ipAddress}</p>
                                      <p><span style={{ color: '#A78BFA' }}>Session:</span> {log.sessionId?.slice(0, 8)}...</p>
                                      <p><span style={{ color: '#A78BFA' }}>Hash:</span> {log.hash?.slice(0, 16)}...</p>
                                      {log.payload && Object.keys(log.payload).length > 0 && (
                                        <div className="mt-2 p-1.5 rounded bg-slate-800/50">
                                          <p style={{ color: '#A78BFA' }}>Payload:</p>
                                          <pre className="mt-1 text-[9px] overflow-x-auto" style={{ color: '#CBD5E1' }}>
                                            {JSON.stringify(log.payload, null, 2).slice(0, 200)}
                                            {JSON.stringify(log.payload).length > 200 && '...'}
                                          </pre>
                                        </div>
                                      )}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>
                        </motion.div>
                      )
                    })
                  )}
                  <div ref={logsEndRef} />
                </div>

                {/* Footer */}
                <div 
                  className="px-4 py-2 flex items-center justify-between text-[10px] font-mono"
                  style={{ 
                    background: 'rgba(15, 23, 42, 0.9)',
                    borderTop: '1px solid rgba(139, 92, 246, 0.2)',
                    color: '#64748B'
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-2 h-2 rounded-full animate-pulse"
                      style={{ 
                        background: isCorrupted ? '#EF4444' : '#10B981',
                        boxShadow: isCorrupted ? '0 0 10px #EF4444' : '0 0 10px #10B981'
                      }}
                    />
                    <span>{isCorrupted ? 'INTÉGRITÉ: COMPROMISE' : 'INTÉGRITÉ: VÉRIFIÉE'}</span>
                  </div>
                  <span style={{ color: '#A78BFA' }}>
                    Chaîne: {logs.length > 0 ? `${logs.length} blocs` : 'Vide'}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
    </>
  )
}

export default AuditTerminal
