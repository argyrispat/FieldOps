import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  addDays,
  addMinutes,
  addWeeks,
  differenceInMinutes,
  eachDayOfInterval,
  endOfDay,
  endOfWeek,
  format,
  isSameDay,
  isToday,
  setHours,
  startOfDay,
  startOfWeek,
} from 'date-fns'
import { AlertTriangle, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { QueryError } from '@/components/QueryError'
import { STATUS_COLOR, statusLabel } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useTechnicians } from '@/features/lookups'
import { ScheduleDialog } from '@/features/jobs/ScheduleDialog'
import { fetchList } from '@/lib/api'
import { cn, formatTime, fullName, toDate } from '@/lib/utils'
import type { Job } from '@/types'

const HOUR_START = 6
const HOUR_END = 21
const HOUR_HEIGHT = 56
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i)
const GRID_HEIGHT = HOURS.length * HOUR_HEIGHT

type View = 'day' | 'week'

interface Placed {
  job: Job
  start: Date
  end: Date
  col: number
  cols: number
  conflict: boolean
}

function overlaps(a: { start: Date; end: Date }, b: { start: Date; end: Date }) {
  return a.start < b.end && a.end > b.start
}

/** Lay out a day's events in side-by-side lanes and flag technician double-bookings. */
function placeEvents(jobs: Job[]): Placed[] {
  const items = jobs
    .map((job) => {
      const start = toDate(job.scheduledStart)
      let end = toDate(job.scheduledEnd)
      if (!start) return null
      if (!end || end <= start) end = addMinutes(start, job.estimatedDurationMinutes ?? 60)
      return { job, start, end }
    })
    .filter((x): x is { job: Job; start: Date; end: Date } => x !== null)
    .sort((a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime())

  const placed: Placed[] = []
  let cluster: Placed[] = []
  let laneEnds: Date[] = []
  const state: { clusterEnd: Date | null } = { clusterEnd: null }

  const flush = () => {
    const cols = Math.max(laneEnds.length, 1)
    cluster.forEach((p) => placed.push({ ...p, cols }))
    cluster = []
    laneEnds = []
    state.clusterEnd = null
  }

  for (const it of items) {
    if (state.clusterEnd && it.start >= state.clusterEnd) flush()
    let col = laneEnds.findIndex((end) => end <= it.start)
    if (col === -1) {
      col = laneEnds.length
      laneEnds.push(it.end)
    } else {
      laneEnds[col] = it.end
    }
    state.clusterEnd = state.clusterEnd && state.clusterEnd > it.end ? state.clusterEnd : it.end
    const conflict =
      Boolean(it.job.hasConflict) ||
      items.some(
        (o) =>
          o.job.id !== it.job.id &&
          Boolean(o.job.technicianId) &&
          o.job.technicianId === it.job.technicianId &&
          o.job.status !== 'Cancelled' &&
          it.job.status !== 'Cancelled' &&
          overlaps(o, it),
      )
    cluster.push({ ...it, col, cols: 1, conflict })
  }
  flush()
  return placed
}

export default function CalendarPage() {
  const [view, setView] = useState<View>(() => (window.innerWidth < 768 ? 'day' : 'week'))
  const [anchor, setAnchor] = useState(() => new Date())
  const [technicianId, setTechnicianId] = useState('')
  const [dialog, setDialog] = useState<{ open: boolean; job: Job | null; start: Date | null }>({
    open: false,
    job: null,
    start: null,
  })

  const { data: technicians = [] } = useTechnicians()

  const range = useMemo(() => {
    if (view === 'day') return { from: startOfDay(anchor), to: endOfDay(anchor) }
    return {
      from: startOfWeek(anchor, { weekStartsOn: 1 }),
      to: endOfWeek(anchor, { weekStartsOn: 1 }),
    }
  }, [view, anchor])

  const days = useMemo(() => eachDayOfInterval({ start: range.from, end: range.to }), [range])

  const { data, isLoading, isError, error, refetch, isPlaceholderData } = useQuery({
    queryKey: ['schedule', range.from.toISOString(), range.to.toISOString(), technicianId],
    queryFn: () =>
      fetchList<Job>('/schedule', {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        technicianId,
      }),
    placeholderData: keepPreviousData,
  })

  const byDay = useMemo(() => {
    const scheduled = (data ?? []).filter((j) => j.scheduledStart && j.status !== 'Cancelled')
    return days.map((d) =>
      placeEvents(scheduled.filter((j) => isSameDay(toDate(j.scheduledStart) ?? 0, d))),
    )
  }, [data, days])

  const conflictCount = byDay.flat().filter((p) => p.conflict).length
  const total = byDay.reduce((n, d) => n + d.length, 0)

  const step = (dir: 1 | -1) => setAnchor((a) => (view === 'day' ? addDays(a, dir) : addWeeks(a, dir)))

  const title =
    view === 'day'
      ? format(anchor, 'EEEE, MMMM d, yyyy')
      : `${format(range.from, 'MMM d')} – ${format(range.to, 'MMM d, yyyy')}`

  const openNew = (start?: Date) => setDialog({ open: true, job: null, start: start ?? null })

  const onGridClick = (day: Date, e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const minutes = Math.floor(((e.clientY - rect.top) / HOUR_HEIGHT) * 2) * 30 // snap to 30 min
    openNew(addMinutes(setHours(startOfDay(day), HOUR_START), minutes))
  }

  const now = new Date()
  const nowTop = ((now.getHours() - HOUR_START) * 60 + now.getMinutes()) / 60 * HOUR_HEIGHT

  return (
    <>
      <PageHeader
        title="Calendar"
        description="Schedule technicians and spot double-bookings at a glance."
        actions={
          <Button onClick={() => openNew()}>
            <Plus /> New appointment
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="icon" onClick={() => step(-1)} aria-label="Previous">
              <ChevronLeft />
            </Button>
            <Button variant="secondary" size="icon" onClick={() => step(1)} aria-label="Next">
              <ChevronRight />
            </Button>
            <Button variant="secondary" onClick={() => setAnchor(new Date())}>
              Today
            </Button>
            <h2 className="ml-2 text-base font-semibold">{title}</h2>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="inline-flex rounded-md border border-border bg-surface p-0.5" role="group" aria-label="View">
              {(['day', 'week'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  aria-pressed={view === v}
                  className={cn(
                    'flex-1 rounded px-4 py-1.5 text-sm font-medium capitalize',
                    view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
            <div className="sm:w-56">
              <Select value={technicianId} onChange={(e) => setTechnicianId(e.target.value)} aria-label="Filter by technician">
                <option value="">All technicians</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {fullName(t)}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        {conflictCount > 0 && (
          <div className="notice flex items-center gap-2 border-b px-4 py-2.5 text-sm" role="alert">
            <AlertTriangle className="size-4 shrink-0" aria-hidden />
            {conflictCount} appointment{conflictCount === 1 ? '' : 's'} overlap for the same technician — highlighted below.
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-10" />
            <Skeleton className="h-96" />
          </div>
        ) : isError ? (
          <QueryError error={error} onRetry={() => refetch()} />
        ) : (
          <div className={cn('overflow-x-auto', isPlaceholderData && 'opacity-60 transition-opacity')}>
            <div style={{ minWidth: view === 'week' ? 760 : undefined }}>
              {/* Day headers */}
              <div className="grid border-b border-border bg-surface-muted/60" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))` }}>
                <div />
                {days.map((d) => (
                  <div key={d.toISOString()} className="border-l border-border px-2 py-2 text-center">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{format(d, 'EEE')}</p>
                    <p
                      className={cn(
                        'mx-auto mt-0.5 flex size-8 items-center justify-center rounded-full text-sm font-semibold',
                        isToday(d) && 'bg-primary text-primary-foreground',
                      )}
                    >
                      {format(d, 'd')}
                    </p>
                  </div>
                ))}
              </div>

              {/* Time grid */}
              <div className="grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))` }}>
                <div className="relative" style={{ height: GRID_HEIGHT }}>
                  {HOURS.map((h, i) => (
                    <span
                      key={h}
                      className="absolute right-2 -translate-y-1/2 text-[11px] text-muted-foreground"
                      style={{ top: i * HOUR_HEIGHT, display: i === 0 ? 'none' : undefined }}
                    >
                      {format(setHours(new Date(), h), 'h a')}
                    </span>
                  ))}
                </div>

                {days.map((d, di) => (
                  <div
                    key={d.toISOString()}
                    className={cn('relative cursor-cell border-l border-border', isToday(d) && 'bg-accent/30')}
                    style={{ height: GRID_HEIGHT }}
                    onClick={(e) => onGridClick(d, e)}
                    role="presentation"
                  >
                    {HOURS.map((h, i) => (
                      <div
                        key={h}
                        className="pointer-events-none absolute inset-x-0 border-t border-border/70"
                        style={{ top: i * HOUR_HEIGHT }}
                      />
                    ))}
                    {isToday(d) && nowTop >= 0 && nowTop <= GRID_HEIGHT && (
                      <div className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-destructive" style={{ top: nowTop }}>
                        <span className="absolute -left-1 -top-[5px] size-2 rounded-full bg-destructive" />
                      </div>
                    )}

                    {byDay[di].map((p) => {
                      const dayStart = setHours(startOfDay(d), HOUR_START)
                      const rawTop = (differenceInMinutes(p.start, dayStart) / 60) * HOUR_HEIGHT
                      const top = Math.max(rawTop, 0)
                      const height = Math.max(
                        (differenceInMinutes(p.end, p.start) / 60) * HOUR_HEIGHT - (top - rawTop),
                        24,
                      )
                      if (top > GRID_HEIGHT) return null
                      const color = STATUS_COLOR[p.job.status]
                      return (
                        <button
                          key={p.job.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDialog({ open: true, job: p.job, start: null })
                          }}
                          className={cn(
                            'absolute z-[5] overflow-hidden rounded-md border border-border border-l-4 px-2 py-1 text-left text-xs transition hover:z-20',
                            p.conflict ? 'bg-danger-bg ring-1 ring-destructive/40' : 'bg-surface',
                          )}
                          style={{
                            top,
                            height: Math.min(height, GRID_HEIGHT - top),
                            left: `calc(${(p.col / p.cols) * 100}% + 2px)`,
                            width: `calc(${100 / p.cols}% - 4px)`,
                            borderLeftColor: p.conflict ? 'var(--destructive)' : color,
                          }}
                          title={`${p.job.jobNumber} · ${p.job.title} (${statusLabel(p.job.status)})`}
                        >
                          <span className="flex items-center gap-1 font-semibold leading-tight">
                            {p.conflict && <AlertTriangle className="size-3 shrink-0 text-destructive" aria-label="Conflict" />}
                            <span className="truncate">{p.job.title}</span>
                          </span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {formatTime(p.start)} – {formatTime(p.end)}
                          </span>
                          {height > 56 && (
                            <span className="block truncate text-[11px] text-muted-foreground">
                              {p.job.technicianName ?? 'Unassigned'}
                              {p.job.customerName ? ` · ${p.job.customerName}` : ''}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{total} appointment{total === 1 ? '' : 's'}</span>
          {(['Scheduled', 'InProgress', 'OnHold', 'Completed'] as const).map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ background: STATUS_COLOR[s] }} />
              {statusLabel(s)}
            </span>
          ))}
          <span className="ml-auto hidden sm:inline">Click an empty slot to book, or an appointment to edit.</span>
        </div>
      </Card>

      <ScheduleDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((s) => ({ ...s, open }))}
        job={dialog.job}
        defaultStart={dialog.start}
        defaultTechnicianId={technicianId || undefined}
      />
    </>
  )
}
