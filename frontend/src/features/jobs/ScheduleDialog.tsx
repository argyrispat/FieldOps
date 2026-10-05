import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { addMinutes, differenceInMinutes, endOfDay, startOfDay } from 'date-fns'
import { AlertTriangle, ExternalLink } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { FormField } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useTechnicians } from '@/features/lookups'
import { fetchList, fetchPaged, getErrorBody, getErrorMessage } from '@/lib/api'
import { formatTime, fromLocalInput, fullName, toDate, toLocalInput } from '@/lib/utils'
import type { Job } from '@/types'
import { describeConflicts, useScheduleJob } from './hooks'

const schema = z
  .object({
    jobId: z.string().min(1, 'Choose a job'),
    technicianId: z.string().min(1, 'Assign a technician'),
    start: z.string().min(1, 'Start time is required'),
    end: z.string().min(1, 'End time is required'),
  })
  .refine((v) => !v.start || !v.end || new Date(v.end) > new Date(v.start), {
    path: ['end'],
    message: 'End must be after the start',
  })
type FormValues = z.infer<typeof schema>

interface ScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When provided the dialog edits/schedules that job; otherwise the user picks an unscheduled job. */
  job?: Job | null
  defaultStart?: Date | null
  defaultTechnicianId?: string
}

export function ScheduleDialog({ open, onOpenChange, job, defaultStart, defaultTechnicianId }: ScheduleDialogProps) {
  const { data: technicians = [] } = useTechnicians(open)
  const schedule = useScheduleJob()
  const [serverConflicts, setServerConflicts] = useState<string[]>([])
  const [serverError, setServerError] = useState<string | null>(null)

  const { data: unscheduled = [] } = useQuery({
    queryKey: ['jobs', 'unscheduled-options'],
    queryFn: async () => {
      const [fresh, held] = await Promise.all([
        fetchPaged<Job>('/jobs', { page: 1, pageSize: 100, status: 'New' }),
        fetchPaged<Job>('/jobs', { page: 1, pageSize: 100, status: 'OnHold' }),
      ])
      return [...fresh.items, ...held.items]
    },
    enabled: open && !job,
  })

  const {
    register,
    handleSubmit,
    reset,
    watch,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { jobId: '', technicianId: '', start: '', end: '' },
  })

  useEffect(() => {
    if (!open) return
    setServerConflicts([])
    setServerError(null)
    const existingStart = toDate(job?.scheduledStart)
    const start = existingStart ?? defaultStart ?? addMinutes(startOfDay(new Date()), 9 * 60)
    const existingEnd = toDate(job?.scheduledEnd)
    const duration = job?.estimatedDurationMinutes ?? 60
    const end = existingEnd && existingStart ? existingEnd : addMinutes(start, duration)
    reset({
      jobId: job?.id ?? '',
      technicianId: job?.technicianId ?? defaultTechnicianId ?? '',
      start: toLocalInput(start),
      end: toLocalInput(end),
    })
  }, [open, job, defaultStart, defaultTechnicianId, reset])

  const jobId = watch('jobId')
  const technicianId = watch('technicianId')
  const start = watch('start')
  const end = watch('end')

  // Live conflict preview against the technician's existing schedule that day.
  const dayStart = toDate(start) ? startOfDay(toDate(start)!) : null
  const { data: dayJobs = [] } = useQuery({
    queryKey: ['schedule', 'conflict-check', technicianId, dayStart?.toISOString()],
    queryFn: () =>
      fetchList<Job>('/schedule', {
        from: dayStart!.toISOString(),
        to: endOfDay(dayStart!).toISOString(),
        technicianId,
      }),
    enabled: open && Boolean(technicianId && dayStart),
  })

  const liveConflicts = useMemo(() => {
    const s = toDate(start)
    const e = toDate(end)
    if (!s || !e || e <= s) return []
    return dayJobs.filter((j) => {
      if (j.id === jobId || !j.scheduledStart || !j.scheduledEnd) return false
      if (j.status === 'Cancelled' || j.status === 'Completed') return false
      if (j.technicianId && j.technicianId !== technicianId) return false
      const js = toDate(j.scheduledStart)!
      const je = toDate(j.scheduledEnd)!
      return js < e && je > s
    })
  }, [dayJobs, start, end, jobId, technicianId])

  const onSubmit = handleSubmit(async (v) => {
    setServerConflicts([])
    setServerError(null)
    try {
      const res = await schedule.mutateAsync({
        jobId: v.jobId,
        technicianId: v.technicianId,
        scheduledStart: fromLocalInput(v.start)!,
        scheduledEnd: fromLocalInput(v.end)!,
      })
      if (res.warnings.length > 0 || res.hasConflict) {
        toast.warning('Scheduled with a conflict', {
          description: res.warnings.join(' • ') || 'This technician has an overlapping appointment.',
          duration: 8000,
        })
      } else {
        toast.success('Appointment saved')
      }
      onOpenChange(false)
    } catch (e) {
      const body = getErrorBody(e)
      const conflicts = describeConflicts(body ?? {})
      if (conflicts.length) setServerConflicts(conflicts)
      setServerError(getErrorMessage(e, 'Could not save the appointment.'))
    }
  })

  const isEdit = Boolean(job?.scheduledStart)

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Edit appointment' : 'Schedule appointment'}
      description={job ? `${job.jobNumber} · ${job.title}` : 'Assign a technician and time slot to a job.'}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} loading={schedule.isPending}>
            {isEdit ? 'Save changes' : 'Schedule job'}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {job && (
          <Link
            to={`/jobs/${job.id}`}
            onClick={() => onOpenChange(false)}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Open job details <ExternalLink className="size-3.5" aria-hidden />
          </Link>
        )}
        {!job && (
          <FormField label="Job" htmlFor="sched-job" error={errors.jobId?.message} required>
            <Select id="sched-job" aria-invalid={!!errors.jobId} {...register('jobId')}>
              <option value="">{unscheduled.length ? 'Select a job to schedule' : 'No unscheduled jobs available'}</option>
              {unscheduled.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.jobNumber} · {j.title}
                  {j.customerName ? ` — ${j.customerName}` : ''}
                </option>
              ))}
            </Select>
          </FormField>
        )}
        <FormField label="Technician" htmlFor="sched-tech" error={errors.technicianId?.message} required>
          <Select id="sched-tech" aria-invalid={!!errors.technicianId} {...register('technicianId')}>
            <option value="">Select technician</option>
            {technicians
              .filter((t) => t.isActive || t.id === job?.technicianId)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {fullName(t)}
                  {t.specialty ? ` — ${t.specialty}` : ''}
                </option>
              ))}
          </Select>
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Starts" htmlFor="sched-start" error={errors.start?.message} required>
            <Input
              id="sched-start"
              type="datetime-local"
              aria-invalid={!!errors.start}
              {...register('start', {
                onChange: (e) => {
                  const prevStart = toDate(getValues('start'))
                  const newStart = toDate(e.target.value)
                  const curEnd = toDate(getValues('end'))
                  if (newStart && curEnd && prevStart) {
                    // Keep duration stable when moving the start.
                    const dur = Math.max(differenceInMinutes(curEnd, prevStart), 15)
                    setValue('end', toLocalInput(addMinutes(newStart, dur)))
                  }
                },
              })}
            />
          </FormField>
          <FormField label="Ends" htmlFor="sched-end" error={errors.end?.message} required>
            <Input id="sched-end" type="datetime-local" aria-invalid={!!errors.end} {...register('end')} />
          </FormField>
        </div>

        {(liveConflicts.length > 0 || serverConflicts.length > 0 || serverError) && (
          <div
            role="alert"
            className="notice flex gap-3 rounded-md px-3 py-3 text-sm"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div className="space-y-1">
              {serverError && <p className="font-medium">{serverError}</p>}
              {serverConflicts.length === 0 && liveConflicts.length > 0 && (
                <p className="font-medium">This technician already has an overlapping appointment:</p>
              )}
              <ul className="list-disc space-y-0.5 pl-4">
                {serverConflicts.map((c) => (
                  <li key={c}>{c}</li>
                ))}
                {serverConflicts.length === 0 &&
                  liveConflicts.map((j) => (
                    <li key={j.id}>
                      {j.jobNumber} · {j.title} ({formatTime(j.scheduledStart)}–{formatTime(j.scheduledEnd)})
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        )}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Dialog>
  )
}