import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { AppShell } from './components/layout/AppShell';
import { Role } from './types';

// Auth Pages
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';

// Domain Pages
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { SubscriptionsPage } from './pages/subscriptions/SubscriptionsPage';
import { BillingPage } from './pages/billing/BillingPage';
import { InvoicesPage } from './pages/invoices/InvoicesPage';
import { CatalogPage } from './pages/catalog/CatalogPage';
import { CustomerPortalPage } from './pages/portal/CustomerPortalPage';

import { Toaster } from 'sonner';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const RootRedirect: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === Role.CUSTOMER) {
    return <Navigate to="/portal" replace />;
  }

  return <Navigate to="/dashboard" replace />;
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Toaster position="top-right" richColors theme="dark" />
          <Routes>
            {/* Public Auth Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Root Intelligent Redirect */}
            <Route path="/" element={<RootRedirect />} />

            {/* Admin & Staff App Layout */}
            <Route
              element={
                <ProtectedRoute allowedRoles={[Role.ADMIN, Role.STAFF]}>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/subscriptions" element={<SubscriptionsPage />} />
              <Route
                path="/billing"
                element={
                  <ProtectedRoute allowedRoles={[Role.ADMIN]}>
                    <BillingPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/invoices" element={<InvoicesPage />} />
              <Route path="/catalog" element={<CatalogPage />} />
            </Route>

            {/* Customer Self-Service Portal Layout */}
            <Route
              element={
                <ProtectedRoute allowedRoles={[Role.CUSTOMER]}>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route path="/portal" element={<CustomerPortalPage />} />
              <Route path="/portal/invoices" element={<CustomerPortalPage />} />
            </Route>

            {/* Catch-all fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
