import React, { Suspense, lazy } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from 'react-router-dom';
import { RootProvider, useAuth } from './providers';
import { AppShell } from '@trades-saas/core-ui';
import { useActiveModules, useOnlineStatus } from '@trades-saas/core-ui';
import { NAV_ITEMS } from './nav';

// =============================================================================
// ROUTE COMPONENTS (lazy-loaded for smaller initial bundle)
// =============================================================================

const LoginPage       = lazy(() => import('./pages/auth/LoginPage'));
const DashboardPage   = lazy(() => import('./pages/DashboardPage'));
const JobsPage        = lazy(() => import('./pages/JobsPage'));
const JobDetailPage   = lazy(() => import('./pages/JobDetailPage'));
const CustomersPage   = lazy(() => import('./pages/CustomersPage'));
const CalendarPage    = lazy(() => import('./pages/CalendarPage'));
const SettingsPage    = lazy(() => import('./pages/settings/SettingsPage'));
const BillingPage     = lazy(() => import('./pages/settings/BillingPage'));
const PriceBookPage   = lazy(() => import('./pages/settings/PriceBookPage'));

// Module pages — each only loads if the module is active
const EstimatesPage   = lazy(() => import('./pages/EstimatesPage'));
const LeadsPage       = lazy(() => import('./pages/LeadsPage'));
const ReviewsPage     = lazy(() => import('./pages/ReviewsPage'));
const LeadDetailPage  = lazy(() =>
  import('@trades-saas/leads').then(m => ({ default: m.LeadDetailPage }))
);
const EstimateDetailPage = lazy(() =>
  import('@trades-saas/estimates').then(m => ({ default: m.EstimateDetailPage }))
);

// =============================================================================
// LOADING FALLBACK
// =============================================================================

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-[100dvh] bg-surface">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
        <p className="text-field-sm text-content-muted">Loading...</p>
      </div>
    </div>
  );
}

// =============================================================================
// AUTH GUARD
// Redirects to /auth/login if no session
// =============================================================================

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;
  if (!user)   return <Navigate to="/auth/login" replace />;

  return <>{children}</>;
}

// =============================================================================
// AUTHENTICATED SHELL
// Wraps all protected routes with AppShell + nav
// =============================================================================

function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  const navigate       = useNavigate();
  const location       = useLocation();
  const activeModules  = useActiveModules();
  const syncState      = useOnlineStatus();

  return (
    <AppShell
      navItems={NAV_ITEMS}
      activeModules={activeModules}
      currentPath={location.pathname}
      syncState={syncState}
      onNavigate={navigate}
    >
      {children}
    </AppShell>
  );
}

// =============================================================================
// ROUTER
// =============================================================================

export function App() {
  return (
    <BrowserRouter>
      <RootProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public routes */}
            <Route path="/auth/login" element={<LoginPage />} />

            {/* Redirect root → dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            {/* Protected routes */}
            <Route
              path="/*"
              element={
                <AuthGuard>
                  <AuthenticatedShell>
                    <Suspense fallback={<PageLoader />}>
                      <Routes>
                        <Route path="/dashboard"    element={<DashboardPage />} />
                        <Route path="/jobs"         element={<JobsPage />} />
                        <Route path="/jobs/new"     element={<JobDetailPage mode="new" />} />
                        <Route path="/jobs/:id"     element={<JobDetailPage mode="edit" />} />
                        <Route path="/customers"    element={<CustomersPage />} />
                        <Route path="/calendar"     element={<CalendarPage />} />
                        <Route path="/estimates"              element={<EstimatesPage />} />
                        <Route path="/estimates/:estimateId"  element={<EstimateDetailPage />} />
                        <Route path="/leads"           element={<LeadsPage />} />
                        <Route path="/leads/:leadId"   element={<LeadDetailPage />} />
                        <Route path="/reviews"      element={<ReviewsPage />} />
                        <Route path="/settings"              element={<SettingsPage />} />
                        <Route path="/settings/billing"    element={<BillingPage />} />
                        <Route path="/settings/price-book" element={<PriceBookPage />} />
                        {/* Fallback */}
                        <Route path="*" element={<Navigate to="/dashboard" replace />} />
                      </Routes>
                    </Suspense>
                  </AuthenticatedShell>
                </AuthGuard>
              }
            />
          </Routes>
        </Suspense>
      </RootProvider>
    </BrowserRouter>
  );
}
