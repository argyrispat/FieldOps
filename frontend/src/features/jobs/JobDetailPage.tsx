import {
  CalendarClock,
  CheckCircle2,
  FileText,
  MapPin,
  Pause,
  Pencil,
  Play,
  User as UserIcon,
  Wrench,
  XCircle,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { QueryError } from '@/components/QueryError'
import { PriorityBadge, StatusBadge } from '@/components/StatusBadge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/AuthContext'
import { downloadBlob, getErrorMessage } from '@/lib/api'
import { formatCurrency, formatDateTime, formatDuration } from '@/lib/utils'
import { CompleteJobDialog, ReasonDialog } from './dialogs'
import { useJob, useJobAction } from './hooks'
import { MaterialsSection, NotesSection, PhotosSection } from './JobSections'
import { ScheduleDialog } from './ScheduleDialog'
import { capabilitiesFor } from './transitions'

function Detail({ icon: Icon, label, children }: { icon?: typeof MapPin; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      {Icon && <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />}
      <div className="min-w-0">
        <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 text-sm">{children}</dd>
      </div>
    </div>
  )
}

export default function JobDetailPage() {
  const { id = '' } = useParams()
  const { isStaff } = useAuth()
  const { data: job, isLoading, isError, error, refetch } = useJob(id)
  const action = useJobAction(id)
  const [completeOpen, setCompleteOpen] = useState(false)
  const [reason, setReason] = useState<'hold' | 'cancel' | null>(null)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [reportLoading, setReportLoading] = useState(false)

  const openReport = async () => {
    setReportLoading(true)
    try {
      const blob = await downloadBlob(`/jobs/${id}/report`)
      const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
      const win = window.open(url, '_blank', 'noopener')
      if (!win) {
        // Pop-up blocked: fall back to a download.
        const a = document.createElement('a')
        a.href = url
        a.download = `${job?.jobNumber ?? 'job'}-report.pdf`
        a.click()
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e) {
      toast.error(getErrorMessage(e, 'Could not generate the report.'))
    } finally {
      setReportLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    )
  }
  if (isError || !job) {
    return (
      <Card>
        <QueryError error={error} onRetry={() => refetch()} />
      </Card>
    )
  }

  const cap = capabilitiesFor(job)
  const backTo = isStaff ? { to: '/jobs', label: 'Jobs' } : { to: '/my-jobs', label: 'My jobs' }

  return (
    <>
      <PageHeader
        backTo={backTo}
        title={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span>{job.jobNumber}</span>
            <StatusBadge status={job.status} />
            <PriorityBadge priority={job.priority} />
          </span>
        }
        description={job.title}
        actions={
          <>
            {(cap.canStart || cap.canResume) && (
              <Button onClick={() => action.mutate({ action: 'start' })} loading={action.isPending && action.variables?.action === 'start'}>
                <Play /> {cap.canResume ? 'Resume' : 'Start job'}
              </Button>
            )}
            {cap.canComplete && (
              <Button onClick={() => setCompleteOpen(true)}>
                <CheckCircle2 /> Complete
              </Button>
            )}
            {cap.canHold && (
              <Button variant="secondary" onClick={() => setReason('hold')}>
                <Pause /> Hold
              </Button>
            )}
            {isStaff && cap.canSchedule && (
              <Button variant="secondary" onClick={() => setScheduleOpen(true)}>
                <CalendarClock /> {job.scheduledStart ? 'Reschedule' : 'Schedule'}
              </Button>
            )}
            {isStaff && job.status !== 'Completed' && job.status !== 'Cancelled' && (
              <Link to={`/jobs/${job.id}/edit`} className={buttonVariants({ variant: 'secondary' })}>
                <Pencil /> Edit
              </Link>
            )}
            <Button variant="secondary" onClick={openReport} loading={reportLoading}>
              <FileText /> PDF report
            </Button>
            {cap.canCancel && isStaff && (
              <Button variant="outlineDestructive" onClick={() => setReason('cancel')}>
                <XCircle /> Cancel job
              </Button>
            )}
          </>
        }
      />

      {job.hasConflict && (
        <div className="notice mb-4 rounded-md px-4 py-3 text-sm" role="alert">
          This appointment overlaps with another job for the assigned technician.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <dl className="grid gap-5 sm:grid-cols-2">
                <Detail icon={UserIcon} label="Customer">
                  {isStaff ? (
                    <Link to={`/customers/${job.customerId}`} className="font-medium text-primary hover:underline">
                      {job.customerName}
                    </Link>
                  ) : (
                    <span className="font-medium">{job.customerName}</span>
                  )}
                </Detail>
                <Detail icon={MapPin} label="Location">
                  <span className="font-medium">{job.locationName}</span>
                  {job.locationAddress && (
                    <a
                      className="block text-muted-foreground hover:text-primary hover:underline"
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.locationAddress)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {job.locationAddress}
                    </a>
                  )}
                </Detail>
                <Detail icon={UserIcon} label="Technician">
                  {job.technicianName ?? <span className="text-muted-foreground">Unassigned</span>}
                </Detail>
                <Detail icon={Wrench} label="Equipment">
                  {job.equipmentId ? (
                    isStaff ? (
                      <Link to={`/equipment/${job.equipmentId}`} className="text-primary hover:underline">
                        {job.equipmentName}
                      </Link>
                    ) : (
                      job.equipmentName
                    )
                  ) : (
                    <span className="text-muted-foreground">None linked</span>
                  )}
                </Detail>
                <Detail icon={CalendarClock} label="Scheduled">
                  {job.scheduledStart ? (
                    <>
                      {formatDateTime(job.scheduledStart)}
                      {job.scheduledEnd && <span className="block text-muted-foreground">until {formatDateTime(job.scheduledEnd)}</span>}
                    </>
                  ) : (
                    <span className="text-muted-foreground">Not scheduled</span>
                  )}
                </Detail>
                <Detail label="Estimated duration">{formatDuration(job.estimatedDurationMinutes)}</Detail>
                {(job.actualStart || job.actualEnd) && (
                  <>
                    <Detail label="Started">{formatDateTime(job.actualStart)}</Detail>
                    <Detail label="Finished">{formatDateTime(job.actualEnd)}</Detail>
                  </>
                )}
              </dl>

              {job.description && (
                <div>
                  <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Description</h4>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{job.description}</p>
                </div>
              )}
              {job.workPerformed && (
                <div>
                  <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Work performed</h4>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{job.workPerformed}</p>
                </div>
              )}
              {isStaff && job.internalNotes && (
                <div className="notice rounded-md px-4 py-3">
                  <h4 className="text-xs font-medium uppercase tracking-wide opacity-80">Internal notes</h4>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{job.internalNotes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <MaterialsSection job={job} canEdit={cap.canRecordWork} />
          <NotesSection job={job} canEdit={cap.canRecordWork} />
        </div>

        <div className="space-y-6">
          <PhotosSection job={job} canEdit={cap.canRecordWork} />
          {isStaff && (job.laborCost != null || job.materialsCost != null) && (
            <Card>
              <CardHeader>
                <CardTitle>Costs</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Labor</span>
                  <span className="tabular-nums">{formatCurrency(job.laborCost)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Materials</span>
                  <span className="tabular-nums">{formatCurrency(job.materialsCost)}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-2 font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">{formatCurrency((job.laborCost ?? 0) + (job.materialsCost ?? 0))}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <CompleteJobDialog job={job} open={completeOpen} onOpenChange={setCompleteOpen} showCosts={isStaff} />
      <ReasonDialog jobId={job.id} kind={reason ?? 'hold'} open={reason !== null} onOpenChange={(o) => !o && setReason(null)} />
      {isStaff && <ScheduleDialog open={scheduleOpen} onOpenChange={setScheduleOpen} job={job} />}
    </>
  )
}
