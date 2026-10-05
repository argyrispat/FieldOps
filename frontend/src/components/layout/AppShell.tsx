import { useQuery } from '@tanstack/react-query'
import { Loader2, LogOut, Menu, X } from 'lucide-react'
import { Suspense, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Logo } from '@/features/auth/AuthLayout'
import { useAuth } from '@/features/auth/AuthContext'
import { ThemeToggle } from '@/features/theme/ThemeToggle'
import { api } from '@/lib/api'
import { cn, fullName, initials } from '@/lib/utils'
import type { Company } from '@/types'
import { SiteFooter } from './SiteFooter'
import { GlobalSearch } from './GlobalSearch'
import { navFor, type NavItem } from './nav'

function SidebarLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-sidebar-active text-foreground'
            : 'text-sidebar-foreground hover:bg-sidebar-active/70 hover:text-foreground',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span
              className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-sidebar-indicator"
              aria-hidden
            />
          )}
          <item.icon className="size-4 shrink-0 opacity-80" aria-hidden />
          {item.label}
        </>
      )}
    </NavLink>
  )
}

export default function AppShell() {
  const { user, roles, logout, isStaff } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const items = navFor(roles)

  const { data: company } = useQuery({
    queryKey: ['company'],
    queryFn: async () => (await api.get<Company>('/company')).data,
    enabled: Boolean(user) && !user?.companyName && isStaff,
    staleTime: 5 * 60_000,
  })
  const companyName = user?.companyName ?? company?.name ?? 'FieldOps'

  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  const handleLogout = async () => {
    await logout()
    toast.success('Signed out')
    navigate('/login', { replace: true })
  }

  const name = fullName(user) || user?.email || ''
  const roleLabel = roles.join(' · ')
  const bottomItems = items.slice(0, 4)

  return (
    <div className="min-h-dvh bg-background" data-theme-surface>
      {/* Desktop sidebar */}
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-sidebar-border bg-sidebar lg:flex"
        data-theme-surface
      >
        <div className="flex h-14 items-center border-b border-sidebar-border px-4">
          <Logo />
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3" aria-label="Primary">
          {items.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2.5 px-1">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary-soft text-xs font-semibold text-accent-foreground">
              {initials(name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{name}</p>
              <p className="truncate text-xs text-sidebar-muted">{roleLabel}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 animate-fade-in bg-black/40"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] animate-slide-in-left flex-col border-r border-sidebar-border bg-sidebar">
            <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
              <Logo />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-md p-1.5 text-sidebar-foreground hover:bg-sidebar-active"
                aria-label="Close menu"
              >
                <X className="size-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3" aria-label="Mobile primary">
              {items.map((item) => (
                <SidebarLink key={item.to} item={item} onNavigate={() => setDrawerOpen(false)} />
              ))}
            </nav>
            <div className="safe-bottom border-t border-sidebar-border p-3">
              <div className="mb-2 flex items-center justify-between gap-2 px-1">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{name}</p>
                  <p className="truncate text-xs text-sidebar-muted">{user?.email}</p>
                </div>
                <ThemeToggle size="sm" />
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-active hover:text-foreground"
              >
                <LogOut className="size-4" aria-hidden /> Sign out
              </button>
            </div>
          </aside>
        </div>
      )}

      <div className="lg:pl-56">
        {/* Top bar */}
        <header
          className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-surface/95 px-4 sm:px-6"
          data-theme-surface
        >
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="-ml-1 rounded-md p-2 text-foreground hover:bg-surface-muted lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>
          <div className="min-w-0 lg:min-w-44">
            <p className="truncate text-sm font-semibold leading-tight">{companyName}</p>
            <p className="hidden truncate text-xs text-muted-foreground sm:block">Field service workspace</p>
          </div>
          <div className="ml-2 hidden flex-1 justify-center md:flex">{isStaff && <GlobalSearch />}</div>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight">{name}</p>
              <p className="text-xs text-muted-foreground">{roleLabel}</p>
            </div>
            <div className="flex size-8 items-center justify-center rounded-md bg-accent text-xs font-semibold text-accent-foreground">
              {initials(name)}
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm font-medium hover:bg-surface-muted"
              aria-label="Sign out"
            >
              <LogOut className="size-4" aria-hidden />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 pb-28 pt-5 sm:px-6 lg:pb-10">
          <Suspense
            fallback={
              <div className="flex justify-center py-24" role="status" aria-label="Loading">
                <Loader2 className="size-6 animate-spin text-primary" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
          <SiteFooter />
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        className="safe-bottom fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-surface lg:hidden"
        aria-label="Bottom"
        data-theme-surface
      >
        {bottomItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium',
                isActive ? 'text-primary' : 'text-muted-foreground',
              )
            }
          >
            <item.icon className="size-5" aria-hidden />
            {item.label}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-muted-foreground"
        >
          <Menu className="size-5" aria-hidden />
          Menu
        </button>
      </nav>
    </div>
  )
}
