import { useQuery } from '@tanstack/react-query'
import { Clock, ClipboardList, Loader2, Search, Users, Wrench, X, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDebounced } from '@/components/SearchInput'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { customerName } from '@/lib/utils'
import type { SearchResults } from '@/types'

const RECENT_KEY = 'fieldops-recent-searches'
const MAX_RECENT = 8

type RecentKind = 'job' | 'customer' | 'equipment'

interface RecentItem {
  id: string
  kind: RecentKind
  title: string
  sub?: string
  to: string
}

const KIND_ICON: Record<RecentKind, LucideIcon> = {
  job: ClipboardList,
  customer: Users,
  equipment: Wrench,
}

function loadRecent(): RecentItem[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((x): x is RecentItem => {
        if (!x || typeof x !== 'object') return false
        const item = x as Partial<RecentItem>
        return (
          typeof item.id === 'string' &&
          typeof item.title === 'string' &&
          typeof item.to === 'string' &&
          (item.kind === 'job' || item.kind === 'customer' || item.kind === 'equipment')
        )
      })
      .slice(0, MAX_RECENT)
  } catch {
    return []
  }
}

function persistRecent(items: RecentItem[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(items.slice(0, MAX_RECENT)))
  } catch {
    /* ignore */
  }
}

function pushRecent(item: RecentItem, current: RecentItem[]): RecentItem[] {
  const next = [item, ...current.filter((x) => !(x.kind === item.kind && x.id === item.id))].slice(0, MAX_RECENT)
  persistRecent(next)
  return next
}

export function GlobalSearch() {
  const navigate = useNavigate()
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const [recent, setRecent] = useState<RecentItem[]>(() => loadRecent())
  const ref = useRef<HTMLDivElement>(null)
  const q = useDebounced(term.trim(), 300)

  const { data, isFetching } = useQuery({
    queryKey: ['search', q],
    queryFn: async () => (await api.get<SearchResults>('/search', { params: { q } })).data,
    enabled: q.length >= 2,
    staleTime: 30_000,
  })

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const go = (item: { id: string; kind: RecentKind; title: string; sub?: string; to: string }) => {
    setRecent((prev) => pushRecent(item, prev))
    setOpen(false)
    setTerm('')
    navigate(item.to)
  }

  const removeRecent = (item: RecentItem) => {
    setRecent((prev) => {
      const next = prev.filter((x) => !(x.kind === item.kind && x.id === item.id))
      persistRecent(next)
      return next
    })
  }

  const groups = [
    {
      label: 'Jobs',
      kind: 'job' as RecentKind,
      icon: ClipboardList,
      rows: (data?.jobs ?? []).map((j) => ({
        id: j.id,
        title: `${j.jobNumber} · ${j.title}`,
        sub: j.customerName ?? undefined,
        to: `/jobs/${j.id}`,
      })),
    },
    {
      label: 'Customers',
      kind: 'customer' as RecentKind,
      icon: Users,
      rows: (data?.customers ?? []).map((c) => ({
        id: c.id,
        title: customerName(c),
        sub: c.email ?? c.phone ?? undefined,
        to: `/customers/${c.id}`,
      })),
    },
    {
      label: 'Equipment',
      kind: 'equipment' as RecentKind,
      icon: Wrench,
      rows: (data?.equipment ?? []).map((e) => ({
        id: e.id,
        title: e.name,
        sub: [e.customerName, e.serialNumber].filter(Boolean).join(' · ') || undefined,
        to: `/equipment/${e.id}`,
      })),
    },
  ].filter((g) => g.rows.length > 0)

  const showResults = open && q.length >= 2
  const showRecent = open && q.length < 2 && recent.length > 0
  const showPanel = showResults || showRecent

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        value={term}
        onChange={(e) => {
          setTerm(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        placeholder="Search jobs, customers, equipment…"
        className="h-9 bg-surface-muted/70 pl-9"
        aria-label="Global search"
        aria-expanded={showPanel}
        aria-controls="global-search-panel"
        autoComplete="off"
      />
      {isFetching && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}

      {showPanel && (
        <div
          id="global-search-panel"
          role="listbox"
          className="absolute left-0 right-0 top-full z-40 mt-1.5 max-h-96 overflow-y-auto rounded-md border border-border bg-surface p-1 animate-pop-in"
        >
          {showRecent && (
            <div className="py-1">
              <p className="px-2.5 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent</p>
              {recent.map((item) => {
                const Icon = KIND_ICON[item.kind] ?? Clock
                return (
                  <div key={`${item.kind}-${item.id}`} className="group flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => go(item)}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-2.5 py-2 text-left hover:bg-surface-muted"
                    >
                      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{item.title}</span>
                        {item.sub && <span className="block truncate text-xs text-muted-foreground">{item.sub}</span>}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRecent(item)}
                      className="mr-1 rounded-md p-1.5 text-muted-foreground opacity-0 hover:bg-surface-muted hover:text-foreground group-hover:opacity-100 focus:opacity-100"
                      aria-label={`Remove “${item.title}” from recent`}
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {showResults &&
            (groups.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {isFetching ? 'Searching…' : `No results for “${q}”`}
              </p>
            ) : (
              groups.map((g) => (
                <div key={g.label} className="py-1">
                  <p className="px-2.5 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</p>
                  {g.rows.slice(0, 5).map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => go({ ...r, kind: g.kind })}
                      className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left hover:bg-surface-muted"
                    >
                      <g.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{r.title}</span>
                        {r.sub && <span className="block truncate text-xs text-muted-foreground">{r.sub}</span>}
                      </span>
                    </button>
                  ))}
                </div>
              ))
            ))}
        </div>
      )}
    </div>
  )
}
