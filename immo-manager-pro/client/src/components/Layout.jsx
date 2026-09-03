import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import {
  LayoutDashboard,
  Building2,
  Users,
  FileText,
  Wallet,
  CalendarDays,
  HandCoins,
  UserPlus,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ClipboardList,
  DollarSign,
  Shield,
  Sun,
  Banknote
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { getRoleLabel } from '../utils/formatters'
import { fetchAlertesCount } from '../utils/api'
import { subscribeToTable } from '../lib/supabase'
import NotificationCenter from './NotificationCenter'
import ConfirmDialog from './ConfirmDialog'
import ServerStatus from './ServerStatus'
import { SearchBar } from './SearchBar'
import { ConnectionStatus } from './ui/ConnectionStatus'
import logoImg from '../assets/logo/logo behemoth.png'

const Layout = () => {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [pageTitle, setPageTitle] = useState('Tableau de bord')
  const [alertesCount, setAlertesCount] = useState(0)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  // Gestion du Mode Sombre
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme')
    if (saved) return saved === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [isDarkMode])

  // Détecter mobile et ajuster sidebar
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024
      setIsMobile(mobile)
      if (mobile) {
        setIsSidebarOpen(false)
      }
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Charger le nombre d'alertes en temps réel
  useEffect(() => {
    if (!user) return // Ne pas requêter sans authentification
    
    let isSubscribed = true
    
    const loadAlertes = async () => {
      try {
        const response = await fetchAlertesCount()
        if (isSubscribed) setAlertesCount(response.data.count)
      } catch (error) {
        console.error('Erreur chargement alertes:', error)
      }
    }
    
    // Chargement initial
    loadAlertes()
    
    // Rafraîchir lors d'un changement en temps réel
    const unsubscribe = subscribeToTable('alertes', () => {
      loadAlertes()
    })
    
    return () => {
      isSubscribed = false
      if (unsubscribe && typeof unsubscribe === 'function') {
         unsubscribe()
      }
    }
  }, [user])

  // Mettre à jour le titre selon la page
  useEffect(() => {
    const titles = {
      '/': 'Tableau de bord',
      '/dashboard': 'Dashboard Direction',
      '/biens': 'Patrimoine Immobilier',
      '/clients': 'Clients & Souscripteurs',
      '/contrats': 'Gestion des Baux',
      '/paiements': 'Paiements Échelonnés',
      '/secretariat': 'Secrétariat & Visites',
      '/recouvrement': 'Agent de Recouvrement',
      '/visites': 'Visites',
      '/documents': 'Documents',
      '/relances': 'Relances',
      '/commissions': 'Apporteurs d\'Affaires',
      '/admin': 'Administration'
    }
    const title = titles[location.pathname] || 'IMMO MANAGER PRO'
    setPageTitle(title)
    document.title = `${title} — YAMTIKEN BEHEMOTH`
  }, [location.pathname])

  const handleLogout = () => {
    setShowLogoutConfirm(true)
  }

  const confirmLogout = () => {
    setShowLogoutConfirm(false)
    logout()
    navigate('/login')
  }

  // Menu complet YAMTIKEN BEHEMOTH (filtré par rôle)
  const getMenuItems = () => {
    const allMenus = [
      { path: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard, roles: ['SUPER_ADMIN', 'ADMIN', 'SECRETAIRE', 'AGENT_RECOUVREMENT', 'DIRECTION'] },
      { path: '/biens', label: 'Patrimoine', icon: Building2, roles: ['SUPER_ADMIN', 'ADMIN', 'SECRETAIRE'] },
      { path: '/clients', label: 'Clients', icon: Users, roles: ['SUPER_ADMIN', 'ADMIN', 'SECRETAIRE'] },
      { path: '/contrats', label: 'Baux', icon: FileText, roles: ['SUPER_ADMIN', 'ADMIN', 'SECRETAIRE', 'AGENT_RECOUVREMENT'] },
      { path: '/paiements', label: 'Paiements', icon: Wallet, roles: ['SUPER_ADMIN', 'ADMIN', 'AGENT_RECOUVREMENT'] },
      { path: '/secretariat', label: 'Secrétariat', icon: ClipboardList, roles: ['SUPER_ADMIN', 'ADMIN', 'SECRETAIRE'] },
      { path: '/recouvrement', label: 'Recouvrement', icon: DollarSign, roles: ['SUPER_ADMIN', 'ADMIN', 'AGENT_RECOUVREMENT'] },
      { path: '/caisse', label: 'Caisse', icon: Banknote, roles: ['SUPER_ADMIN', 'ADMIN', 'SECRETAIRE'] },
      { path: '/commissions', label: 'Commissions', icon: HandCoins, roles: ['SUPER_ADMIN', 'ADMIN'] },
      { path: '/admin', label: 'Administration', icon: Shield, roles: ['SUPER_ADMIN'] }
    ]

    return allMenus.filter(item => item.roles.includes(user?.role))
  }

  const menuItems = getMenuItems()

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen)
  }

  return (
    <div className="flex h-screen" style={{ background: '#F9FFF9' }}>
      <ConfirmDialog
        open={showLogoutConfirm}
        title="Déconnexion"
        message="Voulez-vous vraiment vous déconnecter de l'application ?"
        type="warning"
        confirmText="Se déconnecter"
        cancelText="Annuler"
        onConfirm={confirmLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />
      {/* Overlay mobile */}
      {isMobile && isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - 240px fixe */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out`}
        style={{
          width: '240px',
          background: '#0D3B1F',
          transform: isSidebarOpen ? 'translateX(0)' : 'translateX(-100%)'
        }}
      >
        {/* Logo */}
        <div
          className="h-16 flex items-center px-4 border-b gap-3"
          style={{ borderColor: 'rgba(255,255,255,0.1)' }}
        >
          <img src={logoImg} alt="BEHEMOTH" className="w-10 h-10 object-contain rounded" />
          <div>
            <h1 className="text-white font-bold text-sm tracking-wide">
              IMMO MANAGER
            </h1>
            <p className="text-xs" style={{ color: '#C8960C' }}>PRO</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-1.5 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 180px)' }}>
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path === '/secretariat' && alertesCount > 0 ? '/secretariat?tab=alertes' : item.path}
              onClick={() => isMobile && setIsSidebarOpen(false)}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${isActive
                  ? 'shadow-lg'
                  : ''
                }`
              }
              style={({ isActive }) => ({
                background: isActive
                  ? 'linear-gradient(90deg, rgba(200,150,12,0.25) 0%, rgba(200,150,12,0.1) 100%)'
                  : 'transparent',
                borderLeft: isActive ? '3px solid #C8960C' : '3px solid transparent',
                color: '#FFFFFF'
              })}
              onMouseEnter={(e) => {
                if (!e.currentTarget.style.borderLeft.includes('#C8960C')) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
                }
              }}
              onMouseLeave={(e) => {
                if (!e.currentTarget.style.borderLeft.includes('#C8960C')) {
                  e.currentTarget.style.background = 'transparent'
                }
              }}
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    size={20}
                    style={{
                      color: isActive ? '#C8960C' : '#FFFFFF',
                      strokeWidth: isActive ? 2.5 : 2,
                      transition: 'all 0.2s'
                    }}
                  />
                  <span
                    className="font-semibold text-sm tracking-wide"
                    style={{
                      color: '#FFFFFF',
                      textShadow: '0 1px 2px rgba(0,0,0,0.2)'
                    }}
                  >
                    {item.label}
                  </span>
                  {/* Badge rouge pour les alertes sur le menu Secrétariat */}
                  {item.path === '/secretariat' && alertesCount > 0 && (
                    <span className="ml-auto px-2 py-0.5 rounded-full text-xs bg-red-500 text-white font-bold animate-pulse">
                      {alertesCount}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User info en bas */}
        <div
          className="absolute bottom-0 left-0 right-0 p-4 border-t"
          style={{ borderColor: 'rgba(255,255,255,0.1)' }}
        >
          <button
            onClick={() => navigate('/profil')}
            className="w-full flex items-center gap-3 rounded-lg px-2 py-1 transition-all hover:bg-white/10"
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: '#1A6B35' }}
            >
              <span className="text-white font-semibold text-sm">
                {user?.prenom?.[0]}{user?.nom?.[0]}
              </span>
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium text-white truncate">
                {user?.prenom} {user?.nom}
              </p>
              <p className="text-xs text-white/60">
                {getRoleLabel(user?.role)}
              </p>
            </div>
            <ChevronDown size={16} className="text-white/60" />
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header - 64px avec bordure gold */}
        <header
          className="h-16 bg-white flex items-center justify-between px-6 flex-shrink-0"
          style={{
            borderBottom: '2px solid #C8960C',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}
        >
          <div className="flex items-center gap-4">
            {/* Bouton hamburger mobile */}
            <button
              onClick={toggleSidebar}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
              style={{ color: '#0D3B1F' }}
            >
              {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <h2 className="text-xl font-bold" style={{ color: '#0D3B1F' }}>
              {pageTitle}
            </h2>
          </div>

          {/* Barre de recherche centrale - Masquée */}
          <div className="hidden">
            <SearchBar onSelect={(item) => console.log('Selected:', item)} />
          </div>

          <div className="flex items-center gap-4">
            {/* Indicateur de connexion */}
            <ConnectionStatus showLabel={false} compact={true} />

            {/* Dark Mode Toggle */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title={isDarkMode ? "Passer en mode clair" : "Passer en mode sombre"}
            >
              {isDarkMode ? (
                <Sun size={20} className="text-yellow-500" />
              ) : (
                <Moon size={20} className="text-gray-500" />
              )}
            </button>

            {/* Notifications Center - Composant complet */}
            <NotificationCenter />

            {/* Avatar et déconnexion */}
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: '#E8F5EC' }}
              >
                <span className="font-semibold text-sm" style={{ color: '#1A6B35' }}>
                  {user?.prenom?.[0]}{user?.nom?.[0]}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all hover:opacity-90"
                style={{
                  background: '#fee2e2',
                  color: '#dc2626'
                }}
              >
                <LogOut size={18} />
                <span className="hidden sm:inline text-sm">Déconnexion</span>
              </button>
            </div>
          </div>
        </header>

        {/* Page content - padding 24px */}
        <main
          className="flex-1 overflow-auto"
          style={{
            background: '#F9FFF9',
            padding: '24px'
          }}
        >
          <Outlet />
        </main>
      </div>

      {/* Vérification du statut serveur - affiche un overlay si injoignable */}
      <ServerStatus />
    </div>
  )
}

export default Layout
