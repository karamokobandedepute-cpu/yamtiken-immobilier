import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuthStore } from './stores/authStore'
import { AuditProvider } from './contexts/AuditContext'
import Layout from './components/Layout'
import CommandPalette from './components/CommandPalette'
import { GlobalHealthStatus, ServerOfflineModal } from './components/GlobalHealthStatus'
import { AuthGuard, PublicRoute } from './components/AuthGuard'
import { useRealtimeSync } from './hooks/useRealtimeSync'
import { useClients } from './hooks/useClients'
import PWAInstallPrompt from './components/PWAInstallPrompt'
import ErrorBoundary from './components/ErrorBoundary'
import { prefetchAllData } from './utils/api'

// ⚡ CHARGEMENT DIRECT - Toutes les pages chargent au démarrage, navigation instantanée
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ClientsPage from './pages/ClientsPage'
import BiensPage from './pages/BiensPage'
import ContratsPage from './pages/ContratsPage'
import PaiementsPage from './pages/PaiementsPage'
import SecretariatPage from './pages/SecretariatPage'
import CommissionsPage from './pages/CommissionsPage'
import RecouvrementPage from './pages/RecouvrementPage'
import AdminPage from './pages/AdminPage'
import PresentationMode from './pages/PresentationMode'
import CorbeillePage from './pages/CorbeillePage'
import PortesPage from './pages/PortesPage'
import LeasesPage from './pages/LeasesPage'
import ProfilPage from './pages/ProfilPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import CaissePage from './pages/CaissePage'

function AppInner() {
  const { isAuthenticated, checkAndRefreshToken, validateTokenOnline } = useAuthStore()
  const [tokenReady, setTokenReady] = useState(false)

  // Valider le token en ligne AU DÉMARRAGE avant tout prefetch
  useEffect(() => {
    validateTokenOnline().finally(() => setTokenReady(true))
  }, [])

  // Synchronisation temps réel
  useRealtimeSync({ enabled: isAuthenticated && tokenReady })

  // Précharger les clients dès la connexion
  useClients({ enabled: isAuthenticated && tokenReady })

  // ⚡ Précharger toutes les données dès l'authentification validée
  useEffect(() => {
    if (isAuthenticated && tokenReady) {
      prefetchAllData()
    }
  }, [isAuthenticated, tokenReady])

  // Refresh automatique du token toutes les 30 minutes
  useEffect(() => {
    if (!isAuthenticated || !tokenReady) return

    checkAndRefreshToken()

    const interval = setInterval(() => {
      checkAndRefreshToken()
    }, 30 * 60 * 1000)

    return () => clearInterval(interval)
  }, [isAuthenticated, tokenReady, checkAndRefreshToken])

  return null
}

function App() {
  const { isAuthenticated } = useAuthStore()

  return (
    <ErrorBoundary>
    <AuditProvider>
      <AppInner />
      
      {/* Surveillance globale de la connexion serveur */}
      <GlobalHealthStatus />
      <ServerOfflineModal />
      
      {/* PWA Install Prompt */}
      <PWAInstallPrompt />
      
      <>
        {/* Command Palette Global - accessible avec Ctrl+K */}
        {isAuthenticated && <CommandPalette />}
        
        <Routes>
          {/* Routes publiques - protégées par PublicRoute (redirige si déjà authentifié) */}
          <Route 
            path="/login" 
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            } 
          />
          <Route 
            path="/reset-password" 
            element={
              <PublicRoute>
                <ResetPasswordPage />
              </PublicRoute>
            } 
          />
          
          {/* Mode Présentation (Kiosk) - protégée par AuthGuard */}
          <Route 
            path="/presentation" 
            element={
              <AuthGuard>
                <PresentationMode />
              </AuthGuard>
            }
          />
          
          {/* Routes protégées - AuthGuard vérifie l'authentification */}
          <Route 
            path="/" 
            element={
              <AuthGuard>
                <Layout />
              </AuthGuard>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="clients" element={<ClientsPage />} />
            <Route path="biens" element={<BiensPage />} />
            <Route path="contrats" element={<ContratsPage />} />
            <Route path="paiements" element={<PaiementsPage />} />
            <Route path="secretariat" element={<SecretariatPage />} />
            <Route path="recouvrement" element={<RecouvrementPage />} />
            <Route path="commissions" element={<CommissionsPage />} />
            <Route path="caisse" element={<CaissePage />} />
            <Route path="utilisateurs" element={<Navigate to="/admin" replace />} />
            <Route path="admin" element={<AdminPage />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="corbeille" element={<CorbeillePage />} />
            <Route path="portes/:batimentId" element={<PortesPage />} />
            <Route path="baux" element={<LeasesPage />} />
            <Route path="profil" element={<ProfilPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </>
    </AuditProvider>
    </ErrorBoundary>
  )
}

export default App
