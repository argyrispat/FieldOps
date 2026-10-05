import { clsx, type ClassValue } from 'clsx'
import { format, formatDistanceToNowStrict, isValid, parseISO } from 'date-fns'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function toDate(value?: string | Date | null): Date | null {
  if (!value) return null
  const d = typeof value === 'string' ? parseISO(value) : value
  return isValid(d) ? d : null
}

export function formatDate(value?: string | Date | null, pattern = 'MMM d, yyyy') {
  const d = toDate(value)
  return d ? format(d, pattern) : '—'
}

export function formatDateTime(value?: string | Date | null) {
  return formatDate(value, 'MMM d, yyyy · h:mm a')
}

export function formatTime(value?: string | Date | null) {
  return formatDate(value, 'h:mm a')
}

export function timeAgo(value?: string | Date | null) {
  const d = toDate(value)
  return d ? `${formatDistanceToNowStrict(d)} ago` : '—'
}

const currency = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' })
export function formatCurrency(value?: number | null) {
  return currency.format(value ?? 0)
}

export function formatNumber(value?: number | null) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value ?? 0)
}

export function formatDuration(minutes?: number | null) {
  if (!minutes) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h && m) return `${h}h ${m}m`
  return h ? `${h}h` : `${m}m`
}

export function formatBytes(bytes?: number) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** Convert an ISO string to the value format expected by <input type="datetime-local">. */
export function toLocalInput(value?: string | Date | null) {
  const d = toDate(value)
  return d ? format(d, "yyyy-MM-dd'T'HH:mm") : ''
}

/** Convert a datetime-local input value back to an ISO string (UTC). */
export function fromLocalInput(value?: string | null) {
  if (!value) return null
  const d = new Date(value)
  return isValid(d) ? d.toISOString() : null
}

/** Convert an ISO date to the value format expected by <input type="date">. */
export function toDateInput(value?: string | Date | null) {
  const d = toDate(value)
  return d ? format(d, 'yyyy-MM-dd') : ''
}

export function fromDateInput(value?: string | null) {
  if (!value) return null
  const d = new Date(`${value}T00:00:00`)
  return isValid(d) ? d.toISOString() : null
}

export function fullName(p?: { firstName?: string; lastName?: string; fullName?: string } | null) {
  if (!p) return ''
  return p.fullName || `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim()
}

export function customerName(c?: {
  displayName?: string
  companyName?: string | null
  firstName?: string
  lastName?: string
}) {
  if (!c) return ''
  return c.displayName || c.companyName || `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim()
}

export function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '?'
  )
}

/** Turn '' into undefined/null for optional API fields. */
export function emptyToNull(value?: string | null) {
  const v = value?.trim()
  return v ? v : null
}
