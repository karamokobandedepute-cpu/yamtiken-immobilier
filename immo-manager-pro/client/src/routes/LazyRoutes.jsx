import { lazy, Suspense } from 'react';
import { SkeletonCard } from '../components/ui/Skeleton';

// Lazy loading de toutes les pages pour réduire le bundle initial
const DashboardPage = lazy(() => import('../pages/DashboardPage'));
const ClientsPage = lazy(() => import('../pages/ClientsPage'));
const BuildingsPage = lazy(() => import('../pages/BuildingsPage'));
const LeasesPage = lazy(() => import('../pages/LeasesPage'));
const PaymentsPage = lazy(() => import('../pages/PaymentsPage'));
const BiensPage = lazy(() => import('../pages/BiensPage'));
const ContratsPage = lazy(() => import('../pages/ContratsPage'));
const VisitesPage = lazy(() => import('../pages/VisitesPage'));
const AlertesPage = lazy(() => import('../pages/AlertesPage'));
const NotificationsPage = lazy(() => import('../pages/NotificationsPage'));
const DocumentsPage = lazy(() => import('../pages/DocumentsPage'));
const UsersPage = lazy(() => import('../pages/UsersPage'));
const SettingsPage = lazy(() => import('../pages/SettingsPage'));
const LoginPage = lazy(() => import('../pages/LoginPage'));

// Composant de fallback ultra-léger
const PageLoader = () => (
  <div className="p-6 space-y-4">
    {Array.from({ length: 3 }).map((_, i) => (
      <SkeletonCard key={i} />
    ))}
  </div>
);

// HOC pour wrapper les pages avec Suspense
export const withLazy = (Component) => (props) => (
  <Suspense fallback={<PageLoader />}>
    <Component {...props} />
  </Suspense>
);

// Export des pages lazy
export {
  DashboardPage,
  ClientsPage,
  BuildingsPage,
  LeasesPage,
  PaymentsPage,
  BiensPage,
  ContratsPage,
  VisitesPage,
  AlertesPage,
  NotificationsPage,
  DocumentsPage,
  UsersPage,
  SettingsPage,
  LoginPage,
  PageLoader
};
