import { useQuery } from '@tanstack/react-query'
import { endOfDay, format, startOfDay } from 'date-fns'
import {
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock,
  HardHat,
  MapPin,
  MessageSquarePlus,
  Package,
  Pause,
  Play,
  Wrench,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { QueryError } from '@/components/QueryError'
import { PriorityBadge, StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/AuthContext'
import { AddMaterialDialog, AddNoteDialog, CompleteJobDialog, ReasonDialog, UploadPhotoDialog } from '@/features/jobs/dialogs'
import { useJobAction } from '@/features/jobs/hooks'
import { capabilitiesFor } from '@/features/jobs/transitions'
import { fetchList, fetchPaged } from '@/lib/api'
import { cn, formatTime, toDate } from '@/lib/utils'
import type { Job } from '@/types'

type Dialogs = 'note' | 'photo' | 'material' | 'complete' | 'hold' | null

function MyJobCard({ job }: { job: Job }) {
  const action = useJobAction(job.id)
  const [dialog, setDialog] = useState<Dialogs>(null)
  const cap = capabilitiesFor(job)
  const start = toDate(job.scheduledStart)
  const end = toDate(job.scheduledEnd)
  const active = job.status === 'InProgress'

  return (
    <Card className={cn('overflow-hidden', active && 'border-primary ring-1 ring-primary/25')}>
      <Link to={`/jobs/${job.id}`} className="block space-y-3 p-4 active:bg-surface-muted">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
              {job.jobNumber}
              {start && (
                <span className="inline-flex items-center gap-1 font-medium text-muted-foreground">
                  · <Clock className="size-3" aria-hidden />
                  {formatTime(start)}
                  {end ? ` – ${formatTime(end)}` : ''}
                </span>
              )}
            </p>
            <h3 className="mt-0.5 text-base font-semibold leading-snug">{job.title}</h3>
          </div>
          <ChevronRight className="mt-1 size-5 shrink-0 text-muted-foreground" aria-hidden />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={job.status} />
          <PriorityBadge priority={job.priority} />
        </div>
        <div className="space-y-1 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">{job.customerName}</p>
          {(job.locationAddress || job.locationName) && (
            <p className="flex items-start gap-1.5">
              <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{job.locationAddress ?? job.locationName}</span>
            </p>
          )}
          {job.equipmentName && (
            <p className="flex items-center gap-1.5">
              <Wrench className="size-4 shrink-0" aria-hidden /> {job.equipmentName}
            </p>
          )}
        </div>
      </Link>

      <div className="grid gap-2 border-t border-border bg-surface-muted/50 p-3">
        {(cap.canStart || cap.canResume || cap.canComplete) && (
          <div className="grid grid-cols-2 gap-2">
            {(cap.canStart || cap.canResume) && (
              <Button
                size="lg"
                className={cn(!cap.canComplete && 'col-span-2')}
                loading={action.isPending && action.variables?.action === 'start'}
                onClick={() => action.mutate({ action: 'start' })}
              >
                <Play /> {cap.canResume ? 'Resume' : 'Start job'}
              </Button>
            )}
            {cap.canComplete && (
              <Button size="lg" className={cn(!(cap.canStart || cap.canResume) && 'col-span-2')} onClick={() => setDialog('complete')}>
                <CheckCircle2 /> Complete
              </Button>
            )}
          </div>
        )}
        {cap.canRecordWork && (
          <div className="grid grid-cols-3 gap-2">
            <Button variant="secondary" onClick={() => setDialog('note')} className="flex-col gap-1 py-6 text-xs h-auto">
              <MessageSquarePlus className="size-5" /> Note
            </Button>
            <Button variant="secondary" onClick={() => setDialog('photo')} className="flex-col gap-1 py-6 text-xs h-auto">
              <Camera className="size-5" /> Photo
            </Button>
            <Button variant="secondary" onClick={() => setDialog('material')} className="flex-col gap-1 py-6 text-xs h-auto">
              <Package className="size-5" /> Material
            </Button>
          </div>
        )}
        {cap.canHold && (
          <Button variant="ghost" size="sm" onClick={() => setDialog('hold')}>
            <Pause /> Put on hold
          </Button>
        )}
      </div>

      {dialog === 'note' && <AddNoteDialog jobId={job.id} open onOpenChange={() => setDialog(null)} />}
      {dialog === 'photo' && <UploadPhotoDialog jobId={job.id} open onOpenChange={() => setDialog(null)} />}
      {dialog === 'material' && <AddMaterialDialog jobId={job.id} open onOpenChange={() => setDialog(null)} />}
      {dialog === 'complete' && <CompleteJobDialog job={job} open showCosts={false} onOpenChange={() => setDialog(null)} />}
      {dialog === 'hold' && <ReasonDialog jobId={job.id} kind="hold" open onOpenChange={() => setDialog(null)} />}
    </Card>
  )
}

function ListSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-56" />
      ))}
    </div>
  )
}

export default function MyJobsPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<'today' | 'open'>('today')
  const technicianId = user?.technicianId ?? undefined
  const now = new Date()

  const today = useQuery({
    queryKey: ['my-jobs', 'today', technicianId, format(now, 'yyyy-MM-dd')],
    queryFn: async () => {
      const jobs = await fetchList<Job>('/schedule', {
        from: startOfDay(now).toISOString(),
        to: endOfDay(now).toISOString(),
        technicianId,
      })
      return jobs
        .filter((j) => j.status !== 'Cancelled')
        .sort((a, b) => (a.scheduledStart ?? '').localeCompare(b.scheduledStart ?? ''))
    },
    enabled: tab === 'today',
    refetchInterval: 60_000,
  })

  const open = useQuery({
    queryKey: ['my-jobs', 'open', technicianId],
    queryFn: async () => {
      const res = await fetchPaged<Job>('/jobs', { page: 1, pageSize: 50, technicianId, sortBy: 'scheduledStart', sortDir: 'asc' })
      return res.items.filter((j) => j.status !== 'Completed' && j.status !== 'Cancelled')
    },
    enabled: tab === 'open',
  })

  const q = tab === 'today' ? today : open
  const jobs = q.data ?? []
  const doneToday = tab === 'today' ? jobs.filter((j) => j.status === 'Completed').length : 0

  return (
    <>
      <PageHeader
        title="My jobs"
        description={tab === 'today' ? format(now, 'EEEE, MMMM d') : 'Everything assigned to you that’s still open'}
      />

      <div className="mb-5 inline-flex w-full rounded-md border border-border bg-surface p-0.5 sm:w-auto" role="tablist">
        {(
          [
            ['today', 'Today'],
            ['open', 'All open'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              'flex-1 rounded-md px-6 py-2.5 text-sm font-medium sm:flex-none',
              tab === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {q.isLoading ? (
        <ListSkeleton />
      ) : q.isError ? (
        <Card>
          <QueryError error={q.error} onRetry={() => q.refetch()} />
        </Card>
      ) : jobs.length === 0 ? (
        <Card>
          <EmptyState
            icon={HardHat}
            title={tab === 'today' ? 'No jobs scheduled today' : 'No open jobs'}
            description={tab === 'today' ? 'Enjoy the breathing room — check “All open” for upcoming work.' : 'You’re all caught up.'}
          />
        </Card>
      ) : (
        <>
          {tab === 'today' && (
            <p className="mb-3 text-sm text-muted-foreground">
              {jobs.length} job{jobs.length === 1 ? '' : 's'} today · {doneToday} completed
            </p>
          )}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {jobs.map((j) => (
              <MyJobCard key={j.id} job={j} />
            ))}
          </div>
        </>
      )}
    </>
  )
}
