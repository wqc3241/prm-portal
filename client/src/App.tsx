import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'react-hot-toast';

import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { RoleGuard } from './components/auth/RoleGuard';
import { AppLayout } from './components/layout/AppLayout';

// Auth pages
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';

// App pages
import { DashboardPage } from './pages/DashboardPage';
import { TiersPage } from './pages/admin/TiersPage';
import { PartnerList } from './pages/admin/PartnerList';
import { PartnerDetail } from './pages/admin/PartnerDetail';
import { ApprovalsPage } from './pages/admin/ApprovalsPage';
import { ProductsPage } from './pages/products/ProductsPage';
import { SettingsPage } from './pages/settings/SettingsPage';
import { AnalyticsPage } from './pages/dashboard/AnalyticsPage';
import { DealList, DealForm, DealDetail, DealEdit } from './pages/deals';
import { QuoteList, QuoteForm, QuoteDetail, QuoteEdit } from './pages/quotes';
import { LeadList, LeadDetail, LeadCreate } from './pages/leads';
import { MdfOverview, MdfRequestList, MdfRequestForm, MdfRequestDetail } from './pages/mdf';
import { CourseCatalog, CourseDetail, CertificationList } from './pages/training';
import { ContentLibrary, DocumentDetail } from './pages/library';
import { NotificationList } from './pages/notifications/NotificationList';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public auth routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Protected app routes */}
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="deals" element={<DealList />} />
              <Route path="deals/new" element={<DealForm />} />
              <Route path="deals/:id" element={<DealDetail />} />
              <Route path="deals/:id/edit" element={<DealEdit />} />
              <Route path="quotes" element={<QuoteList />} />
              <Route path="quotes/new" element={<QuoteForm />} />
              <Route path="quotes/:id" element={<QuoteDetail />} />
              <Route path="quotes/:id/edit" element={<QuoteEdit />} />
              <Route path="leads" element={<LeadList />} />
              <Route
                path="leads/new"
                element={
                  <RoleGuard roles={['admin', 'channel_manager']}>
                    <LeadCreate />
                  </RoleGuard>
                }
              />
              <Route path="leads/:id" element={<LeadDetail />} />
              <Route path="mdf" element={<MdfOverview />} />
              <Route path="mdf/requests" element={<MdfRequestList />} />
              <Route path="mdf/requests/new" element={<MdfRequestForm />} />
              <Route path="mdf/requests/:id" element={<MdfRequestDetail />} />
              <Route path="products" element={<ProductsPage />} />
              <Route path="training" element={<CourseCatalog />} />
              <Route path="training/:id" element={<CourseDetail />} />
              <Route path="certifications" element={<CertificationList />} />
              <Route path="library" element={<ContentLibrary />} />
              <Route path="library/:id" element={<DocumentDetail />} />
              <Route path="notifications" element={<NotificationList />} />
              <Route path="settings" element={<SettingsPage />} />

              {/* Analytics (admin + CM only) */}
              <Route
                path="analytics"
                element={
                  <RoleGuard roles={['admin', 'channel_manager']}>
                    <AnalyticsPage />
                  </RoleGuard>
                }
              />

              {/* Admin routes */}
              <Route
                path="admin/partners"
                element={
                  <RoleGuard roles={['admin', 'channel_manager']}>
                    <PartnerList />
                  </RoleGuard>
                }
              />
              <Route
                path="admin/partners/:id"
                element={
                  <RoleGuard roles={['admin', 'channel_manager']}>
                    <PartnerDetail />
                  </RoleGuard>
                }
              />
              <Route
                path="admin/approvals"
                element={
                  <RoleGuard roles={['admin', 'channel_manager']}>
                    <ApprovalsPage />
                  </RoleGuard>
                }
              />
              <Route
                path="admin/tiers"
                element={
                  <RoleGuard roles={['admin']}>
                    <TiersPage />
                  </RoleGuard>
                }
              />

              {/* Catch-all for unbuilt routes */}
              <Route
                path="*"
                element={
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <h2 className="text-xl font-semibold text-panw-gray-800 mb-2">
                      Page Not Found
                    </h2>
                    <p className="text-panw-gray-400 mb-4">
                      This page does not exist or has not been built yet.
                    </p>
                    <a
                      href="/"
                      className="text-sm font-medium text-panw-blue hover:text-panw-navy"
                    >
                      Return to Dashboard
                    </a>
                  </div>
                }
              />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>

      {/* Toast notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#003B5C',
            color: '#fff',
            fontSize: '14px',
          },
          success: {
            style: {
              background: '#065f46',
            },
          },
          error: {
            style: {
              background: '#991b1b',
            },
            duration: 5000,
          },
        }}
      />

      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
