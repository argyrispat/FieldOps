import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios'
import type { ApiErrorBody, AuthResponse, JobPriority, JobStatus, PagedQuery, PagedResult } from '@/types'

export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api'

const ACCESS_KEY = 'fieldops_access_token'
const REFRESH_KEY = 'fieldops_refresh_token'
const USER_KEY = 'fieldops_user'

export const AUTH_CLEARED_EVENT = 'fieldops:auth-cleared'

export const tokenStore = {
  get access() {
    return localStorage.getItem(ACCESS_KEY)
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY)
  },
  get user() {
    return localStorage.getItem(USER_KEY)
  },
  set(auth: Pick<AuthResponse, 'accessToken' | 'refreshToken'>) {
    localStorage.setItem(ACCESS_KEY, auth.accessToken)
    localStorage.setItem(REFRESH_KEY, auth.refreshToken)
  },
  setUser(user: unknown) {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
    localStorage.removeItem(USER_KEY)
  },
}

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
})

// A bare client for the refresh call so it never recurses through our interceptors.
const bare = axios.create({ baseURL: API_URL })

api.interceptors.request.use((config) => {
  const token = tokenStore.access
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  // Let the browser set the multipart boundary.
  if (config.data instanceof FormData) config.headers.delete('Content-Type')
  return config
})

// ---- enum normalisation (numeric -> string) --------------------------------

const STATUS_BY_NUMBER: JobStatus[] = ['New', 'Scheduled', 'InProgress', 'OnHold', 'Completed', 'Cancelled']
const PRIORITY_BY_NUMBER: JobPriority[] = ['Low', 'Normal', 'High', 'Urgent']

function normalise(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalise)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (typeof v === 'number' && (k === 'status' || k === 'fromStatus' || k === 'toStatus')) {
        out[k] = STATUS_BY_NUMBER[v] ?? v
      } else if (typeof v === 'number' && k === 'priority') {
        out[k] = PRIORITY_BY_NUMBER[v] ?? v
      } else if (k === 'allowedTransitions' && Array.isArray(v)) {
        out[k] = v.map((t) => (typeof t === 'number' ? (STATUS_BY_NUMBER[t] ?? t) : t))
      } else {
        out[k] = normalise(v)
      }
    }
    return out
  }
  return value
}

// ---- 401 handling with single-flight refresh --------------------------------

let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = tokenStore.refresh
  if (!refreshToken) return null
  if (!refreshPromise) {
    refreshPromise = bare
      .post<AuthResponse>('/auth/refresh', { refreshToken })
      .then((res) => {
        tokenStore.set(res.data)
        if (res.data.user) tokenStore.setUser(res.data.user)
        return res.data.accessToken
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

export function forceLogout() {
  tokenStore.clear()
  window.dispatchEvent(new Event(AUTH_CLEARED_EVENT))
  if (!window.location.pathname.startsWith('/login')) {
    window.location.assign('/login')
  }
}

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean }

api.interceptors.response.use(
  (response) => {
    if (response.data && response.config.responseType !== 'blob') {
      response.data = normalise(response.data)
    }
    return response
  },
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined
    const url = original?.url ?? ''
    const isAuthCall = url.includes('/auth/login') || url.includes('/auth/register') || url.includes('/auth/refresh')

    if (error.response?.status === 401 && original && !original._retry && !isAuthCall) {
      original._retry = true
      const token = await refreshAccessToken()
      if (token) {
        original.headers.set('Authorization', `Bearer ${token}`)
        return api(original)
      }
      forceLogout()
    }
    return Promise.reject(error)
  },
)

// ---- helpers ----------------------------------------------------------------

export function getErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) return 'Cannot reach the server. Check your connection and try again.'
    const data = error.response.data as ApiErrorBody | string | undefined
    if (typeof data === 'string' && data.trim() && data.length < 300) return data
    if (data && typeof data === 'object') {
      if (data.errors) {
        const msgs = Array.isArray(data.errors) ? data.errors : Object.values(data.errors).flat()
        if (msgs.length) return msgs.join(' ')
      }
      if (data.message) return data.message
      if (data.detail) return data.detail
      if (data.title) return data.title
    }
    if (error.response.status === 403) return 'You do not have permission to do that.'
    if (error.response.status === 404) return 'The requested resource was not found.'
    return fallback
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export function getErrorBody(error: unknown): ApiErrorBody | undefined {
  if (axios.isAxiosError(error) && error.response && typeof error.response.data === 'object') {
    return error.response.data as ApiErrorBody
  }
  return undefined
}

/** Drop empty-string / null / undefined params so the query string stays clean. */
export function cleanParams<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null),
  ) as Partial<T>
}

/** Accept either a bare array or a paged envelope and return the array. */
export function asList<T>(data: T[] | { items?: T[] } | null | undefined): T[] {
  if (!data) return []
  return Array.isArray(data) ? data : (data.items ?? [])
}

export async function fetchPaged<T>(
  url: string,
  params: PagedQuery & Record<string, unknown> = {},
  config?: AxiosRequestConfig,
): Promise<PagedResult<T>> {
  const { data } = await api.get<PagedResult<T> | T[]>(url, { ...config, params: cleanParams(params) })
  if (Array.isArray(data)) {
    return { items: data, page: 1, pageSize: data.length, totalCount: data.length, totalPages: 1 }
  }
  return data
}

export async function fetchList<T>(url: string, params: Record<string, unknown> = {}): Promise<T[]> {
  const { data } = await api.get<T[] | { items?: T[] }>(url, { params: cleanParams(params) })
  return asList(data)
}

export async function downloadBlob(url: string): Promise<Blob> {
  const { data } = await api.get<Blob>(url, { responseType: 'blob' })
  return data
}
