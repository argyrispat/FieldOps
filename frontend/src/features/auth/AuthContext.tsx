import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, AUTH_CLEARED_EVENT, tokenStore } from '@/lib/api'
import type { AuthResponse, Role, User } from '@/types'

export interface RegisterInput {
  companyName: string
  firstName: string
  lastName: string
  email: string
  password: string
}

interface AuthContextValue {
  user: User | null
  roles: Role[]
  loading: boolean
  isAuthenticated: boolean
  isOwner: boolean
  isDispatcher: boolean
  isTechnician: boolean
  /** Owner or Dispatcher — anyone with the full admin navigation. */
  isStaff: boolean
  hasRole: (...roles: Role[]) => boolean
  login: (email: string, password: string) => Promise<User>
  register: (input: RegisterInput) => Promise<User>
  logout: () => Promise<void>
  refreshUser: () => Promise<User | null>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** Tolerate `role: "Owner"` as well as `roles: ["Owner"]` from the API. */
function normaliseUser(raw: User & { role?: Role }): User {
  const roles = raw.roles ?? (raw.role ? [raw.role] : [])
  return { ...raw, roles }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState<boolean>(() => Boolean(tokenStore.access || tokenStore.refresh))

  const applyAuth = useCallback((auth: AuthResponse) => {
    tokenStore.set(auth)
    const u = normaliseUser(auth.user)
    tokenStore.setUser(u)
    setUser(u)
    return u
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await api.get<User>('/auth/me')
      const u = normaliseUser(data)
      tokenStore.setUser(u)
      setUser(u)
      return u
    } catch {
      return null
    }
  }, [])

  // Bootstrap session from stored tokens.
  useEffect(() => {
    if (!tokenStore.access && !tokenStore.refresh) return
    let cancelled = false
    refreshUser().finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [refreshUser])

  // Clear in-memory state whenever the API client wipes auth (refresh failure).
  useEffect(() => {
    const onCleared = () => {
      setUser(null)
      queryClient.clear()
    }
    window.addEventListener(AUTH_CLEARED_EVENT, onCleared)
    return () => window.removeEventListener(AUTH_CLEARED_EVENT, onCleared)
  }, [queryClient])

  const login = useCallback(
    async (email: string, password: string) => {
      const { data } = await api.post<AuthResponse>('/auth/login', { email, password })
      queryClient.clear()
      return applyAuth(data)
    },
    [applyAuth, queryClient],
  )

  const register = useCallback(
    async (input: RegisterInput) => {
      const { data } = await api.post<AuthResponse | undefined>('/auth/register', input)
      queryClient.clear()
      if (data?.accessToken) return applyAuth(data)
      // API returned no tokens on register — sign in with the new credentials.
      const login = await api.post<AuthResponse>('/auth/login', { email: input.email, password: input.password })
      return applyAuth(login.data)
    },
    [applyAuth, queryClient],
  )

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout', { refreshToken: tokenStore.refresh })
    } catch {
      // Logging out locally is what matters; the server call is best-effort.
    }
    tokenStore.clear()
    setUser(null)
    queryClient.clear()
  }, [queryClient])

  const value = useMemo<AuthContextValue>(() => {
    const roles = user?.roles ?? []
    const has = (...r: Role[]) => r.some((x) => roles.includes(x))
    return {
      user,
      roles,
      loading,
      isAuthenticated: Boolean(user),
      isOwner: has('Owner'),
      isDispatcher: has('Dispatcher'),
      isTechnician: has('Technician') && !has('Owner', 'Dispatcher'),
      isStaff: has('Owner', 'Dispatcher'),
      hasRole: has,
      login,
      register,
      logout,
      refreshUser,
    }
  }, [user, loading, login, register, logout, refreshUser])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

/** Where a user should land after signing in. */
export function homePathFor(user: User | null) {
  return user && user.roles.includes('Technician') && !user.roles.some((r) => r === 'Owner' || r === 'Dispatcher')
    ? '/my-jobs'
    : '/'
}
