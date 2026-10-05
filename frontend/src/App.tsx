import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import axios from 'axios'
import { lazy, Suspense } from 'react'
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import AppShell from '@/components/layout/AppShell'
import { buttonVariants } from '@/components/ui/button'
import { AppToaster } from '@/components/AppToaster'
import { AuthProvider } from '@/features/auth/AuthContext'
import { AuthGuard, FullPageSpinner, GuestGuard, HomeRoute, RoleGuard } from '@/features/auth/guards'
import { CookieConsentBanner } from '@/features/legal/CookieConsentBanner'
import { LegalLayout } from '@/features/legal/LegalLayout'
import { ThemeProvider } from '@/features/theme/ThemeProvider'

const LoginPage = lazy(() => import('@/features/auth/LoginPage'))
const RegisterPage = lazy(() => import('@/features/auth/RegisterPage'))
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'))
const JobsPage = lazy(() => import('@/features/jobs/JobsPage'))
const JobDetailPage = lazy(() => import('@/features/jobs/JobDetailPage'))
const JobFormPage = lazy(() => import('@/features/jobs/JobFormPage'))
const CalendarPage = lazy(() => import('@/features/calendar/CalendarPage'))
const CustomersPage = lazy(() => import('@/features/customers/CustomersPage'))
const CustomerDetailPage = lazy(() => import('@/features/customers/CustomerDetailPage'))
const CustomerFormPage = lazy(() => import('@/features/customers/CustomerFormPage'))
const EquipmentPage = lazy(() => import('@/features/equipment/EquipmentPage'))
const EquipmentDetailPage = lazy(() => import('@/features/equipment/EquipmentDetailPage'))
const InventoryPage = lazy(() => import('@/features/inventory/InventoryPage'))
const MyJobsPage = lazy(() => import('@/features/my-jobs/MyJobsPage'))
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'))
const PrivacyPage = lazy(() => import('@/features/legal/PrivacyPage'))
const CookiesPage = lazy(() => import('@/features/legal/CookiesPage'))
const TermsPage = lazy(() => import('@/features/legal/TermsPage'))
const CookieSettingsPage = lazy(() => import('@/features/legal/CookieSettingsPage'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Don't hammer the API on client errors (4xx).
        if (axios.isAxiosError(error) && error.response && error.response.status < 500) return false
        return failureCount < 2
      },
    },
  },
})

function NotFound() {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-primary">404</p>
      <h1 className="mt-2 text-xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-1 text-sm text-muted-foreground">The page you’re looking for doesn’t exist or was moved.</p>
      <Link to="/" className={buttonVariants({ className: 'mt-6' })}>
        Back to home
      </Link>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<FullPageSpinner />}>
              <Routes>
                <Route element={<LegalLayout />}>
                  <Route path="/privacy" element={<PrivacyPage />} />
                  <Route path="/cookies" element={<CookiesPage />} />
                  <Route path="/terms" element={<TermsPage />} />
                  <Route path="/cookie-settings" element={<CookieSettingsPage />} />
                </Route>

                <Route element={<GuestGuard />}>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                </Route>

                <Route element={<AuthGuard />}>
                  <Route element={<AppShell />}>
                    <Route
                      index
                      element={
                        <HomeRoute>
                          <DashboardPage />
                        </HomeRoute>
                      }
                    />

                    {/* Job detail is shared by every role (technicians reach it from My Jobs). */}
                    <Route path="jobs/:id" element={<JobDetailPage />} />

                    <Route element={<RoleGuard allow={['Owner', 'Dispatcher']} />}>
                      <Route path="jobs" element={<JobsPage />} />
                      <Route path="jobs/new" element={<JobFormPage />} />
                      <Route path="jobs/:id/edit" element={<JobFormPage />} />
                      <Route path="calendar" element={<CalendarPage />} />
                      <Route path="customers" element={<CustomersPage />} />
                      <Route path="customers/new" element={<CustomerFormPage />} />
                      <Route path="customers/:id" element={<CustomerDetailPage />} />
                      <Route path="customers/:id/edit" element={<CustomerFormPage />} />
                      <Route path="equipment" element={<EquipmentPage />} />
                      <Route path="equipment/:id" element={<EquipmentDetailPage />} />
                      <Route path="inventory" element={<InventoryPage />} />
                    </Route>

                    <Route element={<RoleGuard allow={['Technician']} />}>
                      <Route path="my-jobs" element={<MyJobsPage />} />
                    </Route>

                    <Route element={<RoleGuard allow={['Owner']} />}>
                      <Route path="settings" element={<SettingsPage />} />
                    </Route>

                    <Route path="*" element={<NotFound />} />
                  </Route>
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            <CookieConsentBanner />
            <AppToaster />
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
