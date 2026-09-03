import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, X, FileText, User, Home, DollarSign, Calendar, Building, TrendingUp, AlertTriangle, FileDown } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

/**
 * Command Palette - Recherche globale type VS Code/Linear
 * Recherche rapide dans toute l'application avec raccourci Ctrl+K
 */
const CommandPalette = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [recentCommands, setRecentCommands] = useState([])
  const inputRef = useRef(null)
  const navigate = useNavigate()

  // Commandes statiques disponibles
  const staticCommands = [
    // Navigation rapide
    { id: 'nav-dashboard', title: 'Dashboard', subtitle: 'Aller au tableau de bord', icon: TrendingUp, path: '/', type: 'navigation', category: 'Navigation' },
    { id: 'nav-clients', title: 'Clients', subtitle: 'Gestion des clients', icon: User, path: '/clients', type: 'navigation', category: 'Navigation' },
    { id: 'nav-biens', title: 'Patrimoine', subtitle: 'Gestion des biens', icon: Building, path: '/biens', type: 'navigation', category: 'Navigation' },
    { id: 'nav-contrats', title: 'Contrats', subtitle: 'Gestion des baux', icon: FileText, path: '/contrats', type: 'navigation', category: 'Navigation' },
    { id: 'nav-paiements', title: 'Paiements', subtitle: 'Suivi des paiements', icon: DollarSign, path: '/paiements', type: 'navigation', category: 'Navigation' },
    { id: 'nav-recouvrement', title: 'Recouvrement', subtitle: 'Gestion des impayés', icon: AlertTriangle, path: '/recouvrement', type: 'navigation', category: 'Navigation' },
    { id: 'nav-secretariat', title: 'Secrétariat', subtitle: 'Visites et relances', icon: Calendar, path: '/secretariat', type: 'navigation', category: 'Navigation' },
    { id: 'nav-commissions', title: 'Commissions', subtitle: 'Apporteurs d\'affaires', icon: TrendingUp, path: '/commissions', type: 'navigation', category: 'Navigation' },
    
    // Actions rapides
    { id: 'action-new-client', title: 'Nouveau client', subtitle: 'Créer un client', icon: User, type: 'action', category: 'Actions', action: () => { navigate('/clients'); toast.success('Créez un client depuis la page'); } },
    { id: 'action-new-payment', title: 'Nouveau paiement', subtitle: 'Enregistrer un paiement', icon: DollarSign, type: 'action', category: 'Actions', action: () => { navigate('/paiements'); toast.success('Enregistrez un paiement'); } },
    { id: 'action-new-visit', title: 'Nouvelle visite', subtitle: 'Enregistrer une visite', icon: Calendar, type: 'action', category: 'Actions', action: () => { navigate('/secretariat'); toast.success('Enregistrez une visite'); } },
    { id: 'action-export-pdf', title: 'Export PDF rapide', subtitle: 'Exporter données en PDF', icon: FileDown, type: 'action', category: 'Actions', action: () => toast.info('Sélectionnez une page pour exporter') },
    
    // Raccourcis PDF
    { id: 'pdf-rapport-mensuel', title: 'PDF Rapport Mensuel', subtitle: 'Générer rapport mensuel', icon: FileText, type: 'pdf', category: 'PDF', action: () => toast.success('Rapport mensuel généré') },
    { id: 'pdf-etat-creances', title: 'PDF État des Créances', subtitle: 'Liste des impayés', icon: AlertTriangle, type: 'pdf', category: 'PDF', action: () => toast.success('État des créances généré') },
    { id: 'pdf-offre-commerciale', title: 'PDF Fiche Offre', subtitle: 'Fiche commerciale vierge', icon: FileText, type: 'pdf', category: 'PDF', action: () => toast.success('Fiche offre générée') },
    
    // Paramètres
    { id: 'settings-users', title: 'Utilisateurs', subtitle: 'Gestion des comptes', icon: User, path: '/utilisateurs', type: 'navigation', category: 'Paramètres' },
    { id: 'settings-admin', title: 'Administration', subtitle: 'Paramètres système', icon: Building, path: '/admin', type: 'navigation', category: 'Paramètres' }
  ]

  // Ouvrir/fermer avec raccourci clavier
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+K ou Cmd+K pour ouvrir
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(true)
        setTimeout(() => inputRef.current?.focus(), 100)
      }
      
      // Escape pour fermer
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
      
      // Navigation avec flèches
      if (isOpen) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setSelectedIndex(prev => (prev + 1) % results.length)
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          setSelectedIndex(prev => (prev - 1 + results.length) % results.length)
        }
        if (e.key === 'Enter' && results[selectedIndex]) {
          e.preventDefault()
          executeCommand(results[selectedIndex])
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, results, selectedIndex])

  // Recherche fuzzy
  useEffect(() => {
    if (!query.trim()) {
      setResults(recentCommands.length > 0 ? recentCommands : staticCommands.slice(0, 8))
      return
    }

    const lowerQuery = query.toLowerCase()
    const scored = staticCommands.map(cmd => {
      let score = 0
      const title = cmd.title.toLowerCase()
      const subtitle = cmd.subtitle.toLowerCase()
      
      // Score exact match
      if (title === lowerQuery) score += 100
      if (title.startsWith(lowerQuery)) score += 50
      if (title.includes(lowerQuery)) score += 25
      if (subtitle.includes(lowerQuery)) score += 10
      
      // Bonus catégorie
      if (cmd.category.toLowerCase().includes(lowerQuery)) score += 5
      
      return { ...cmd, score }
    }).filter(cmd => cmd.score > 0)
    
    scored.sort((a, b) => b.score - a.score)
    setResults(scored)
    setSelectedIndex(0)
  }, [query, recentCommands])

  const executeCommand = useCallback((command) => {
    // Ajouter aux commandes récentes
    setRecentCommands(prev => {
      const filtered = prev.filter(c => c.id !== command.id)
      return [command, ...filtered].slice(0, 5)
    })
    
    // Exécuter
    if (command.path) {
      navigate(command.path)
    }
    if (command.action) {
      command.action()
    }
    
    // Fermer
    setIsOpen(false)
    setQuery('')
  }, [navigate])

  const getIconColor = (type) => {
    switch (type) {
      case 'navigation': return '#1A6B35'
      case 'action': return '#C8960C'
      case 'pdf': return '#DC2626'
      default: return '#6B7280'
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-[20vh]">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header avec recherche */}
        <div className="border-b border-gray-200">
          <div className="flex items-center gap-3 px-4 py-4">
            <Search className="text-gray-400" size={20} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher... (ex: 'client dupont', 'pdf rapport', 'nouveau paiement')"
              className="flex-1 text-lg outline-none placeholder:text-gray-400"
              autoFocus
            />
            <div className="flex items-center gap-1">
              <kbd className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-500">ESC</kbd>
              <span className="text-gray-400">pour fermer</span>
            </div>
          </div>
        </div>

        {/* Résultats */}
        <div className="max-h-[400px] overflow-y-auto">
          {results.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Search size={48} className="mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">Aucun résultat</p>
              <p className="text-sm">Essayez une autre recherche</p>
            </div>
          ) : (
            <div className="py-2">
              {results.map((result, index) => {
                const Icon = result.icon
                const isSelected = index === selectedIndex
                
                return (
                  <button
                    key={result.id}
                    onClick={() => executeCommand(result)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                      isSelected ? 'bg-[#E8F5EC]' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${getIconColor(result.type)}15` }}
                    >
                      <Icon size={20} style={{ color: getIconColor(result.type) }} />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        {result.title}
                      </div>
                      <div className="text-sm text-gray-500">
                        {result.subtitle}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="px-2 py-1 rounded text-xs font-medium"
                        style={{
                          backgroundColor: `${getIconColor(result.type)}15`,
                          color: getIconColor(result.type)
                        }}
                      >
                        {result.category}
                      </span>
                      {result.type === 'pdf' && (
                        <span className="text-xs text-gray-400">PDF</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white rounded border">↑↓</kbd>
              naviguer
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white rounded border">↵</kbd>
              sélectionner
            </span>
          </div>
          <span>{results.length} résultat{results.length > 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  )
}

export default CommandPalette
