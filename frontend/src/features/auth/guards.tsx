import { Loader2 } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { Role } from '@/types'
import { homePathFor, useAuth } from './AuthContext'

export function FullPageSpinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background" role="status" aria-label="Loading">
      <Loader2 className="size-8 animate-spin text-primary" />
    </div>
  )
}

/** Requires an authenticated session; otherwise redirects to /login and remembers where the user was heading. */
export function AuthGuard() {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullPageSpinner />
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return <Outlet />
}

/** Redirects signed-in users away from /login and /register. */
export function GuestGuard() {
  const { isAuthenticated, loading, user } = useAuth()
  if (loading) return <FullPageSpinner />
  if (isAuthenticated) return <Navigate to={homePathFor(user)} replace />
  return <Outlet />
}

/** Restricts a route subtree to the given roles. */
export function RoleGuard({ allow }: { allow: Role[] }) {
  const { hasRole, user } = useAuth()
  if (!hasRole(...allow)) return <Navigate to={homePathFor(user)} replace />
  return <Outlet />
}

/** Index route: technicians go straight to My Jobs, everyone else sees the dashboard. */
export function HomeRoute({ children }: { children: React.ReactNode }) {
  const { isTechnician } = useAuth()
  if (isTechnician) return <Navigate to="/my-jobs" replace />
  return <>{children}</>
}
