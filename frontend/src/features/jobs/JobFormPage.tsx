import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { addMinutes } from 'date-fns'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { FormField } from '@/components/FormField'
import { PageHeader } from '@/components/PageHeader'
import { QueryError } from '@/components/QueryError'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CardSkeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCustomerOptions, useEquipmentOptions, useLocations, useTechnicians } from '@/features/lookups'
import { api, getErrorMessage } from '@/lib/api'
import { customerName, emptyToNull, fromLocalInput, fullName, toLocalInput } from '@/lib/utils'
import { JOB_PRIORITIES, type Job } from '@/types'
import { describeConflicts, useInvalidateJobs, useJob } from './hooks'

const schema = z
  .object({
    customerId: z.string().min(1, 'Choose a customer'),
    serviceLocationId: z.string().min(1, 'Choose a service location'),
    equipmentId: z.string(),
    technicianId: z.string(),
    title: z.string().trim().min(3, 'Give the job a short title').max(150),
    description: z.string().max(4000),
    priority: z.enum(JOB_PRIORITIES),
    estimatedDurationMinutes: z
      .string()
      .refine((v) => v.trim() === '' || (Number.isInteger(Number(v)) && Number(v) > 0), 'Enter whole minutes'),
    start: z.string(),
    end: z.string(),
    internalNotes: z.string().max(4000),
  })
  .superRefine((v, ctx) => {
    if (v.start || v.end) {
      if (!v.technicianId) ctx.addIssue({ code: 'custom', path: ['technicianId'], message: 'Choose a technician to schedule' })
      if (!v.start) ctx.addIssue({ code: 'custom', path: ['start'], message: 'Start time is required' })
      if (!v.end) ctx.addIssue({ code: 'custom', path: ['end'], message: 'End time is required' })
      if (v.start && v.end && new Date(v.end) <= new Date(v.start))
        ctx.addIssue({ code: 'custom', path: ['end'], message: 'End must be after the start' })
    }
  })
type FormValues = z.infer<typeof schema>

function JobForm({ job, presetCustomerId, presetEquipmentId }: { job?: Job; presetCustomerId?: string; presetEquipmentId?: string }) {
  const navigate = useNavigate()
  const invalidate = useInvalidateJobs()
  const isEdit = Boolean(job)

  const { data: customers = [], isLoading: customersLoading } = useCustomerOptions()
  const { data: technicians = [] } = useTechnicians()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      customerId: job?.customerId ?? presetCustomerId ?? '',
      serviceLocationId: job?.serviceLocationId ?? '',
      equipmentId: job?.equipmentId ?? presetEquipmentId ?? '',
      technicianId: job?.technicianId ?? '',
      title: job?.title ?? '',
      description: job?.description ?? '',
      priority: job?.priority ?? 'Normal',
      estimatedDurationMinutes: job?.estimatedDurationMinutes ? String(job.estimatedDurationMinutes) : '',
      start: '',
      end: '',
      internalNotes: job?.internalNotes ?? '',
    },
  })

  const customerId = watch('customerId')
  const locationId = watch('serviceLocationId')
  const { data: locations = [], isLoading: locationsLoading } = useLocations(customerId)
  const { data: equipment = [] } = useEquipmentOptions(customerId)

  // Auto-select the only / primary location for a customer.
  useEffect(() => {
    if (!customerId || locationsLoading || locationId || locations.length === 0) return
    const preferred = locations.find((l) => l.isPrimary) ?? (locations.length === 1 ? locations[0] : undefined)
    if (preferred) setValue('serviceLocationId', preferred.id)
  }, [customerId, locations, locationsLoading, locationId, setValue])

  const save = useMutation({
    mutationFn: async (v: FormValues) => {
      const body = {
        customerId: v.customerId,
        serviceLocationId: v.serviceLocationId,
        equipmentId: emptyToNull(v.equipmentId),
        technicianId: emptyToNull(v.technicianId),
        title: v.title.trim(),
        description: emptyToNull(v.description),
        priority: v.priority,
        estimatedDurationMinutes: v.estimatedDurationMinutes.trim() ? Number(v.estimatedDurationMinutes) : null,
        internalNotes: emptyToNull(v.internalNotes),
      }
      const saved = job
        ? (await api.put<Job>(`/jobs/${job.id}`, body)).data
        : (await api.post<Job>('/jobs', body)).data
      const id = saved?.id ?? job?.id
      let warnings: string[] = []
      if (!job && id && v.start && v.end && v.technicianId) {
        const res = await api.post(`/jobs/${id}/schedule`, {
          technicianId: v.technicianId,
          scheduledStart: fromLocalInput(v.start),
          scheduledEnd: fromLocalInput(v.end),
        })
        warnings = describeConflicts(res.data ?? {})
      }
      return { id, warnings }
    },
    onSuccess: ({ id, warnings }) => {
      invalidate(id)
      toast.success(isEdit ? 'Job updated' : 'Job created')
      if (warnings.length) toast.warning('Scheduling conflict', { description: warnings.join(' • '), duration: 8000 })
      navigate(id ? `/jobs/${id}` : '/jobs')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Job details</CardTitle>
          <CardDescription>What needs to be done and for whom.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField label="Title" htmlFor="title" error={errors.title?.message} required className="md:col-span-2">
            <Input id="title" placeholder="e.g. Annual HVAC inspection" aria-invalid={!!errors.title} {...register('title')} />
          </FormField>
          <FormField label="Customer" htmlFor="customerId" error={errors.customerId?.message} required>
            <Select
              id="customerId"
              disabled={isEdit || customersLoading}
              aria-invalid={!!errors.customerId}
              {...register('customerId', {
                onChange: () => {
                  setValue('serviceLocationId', '')
                  setValue('equipmentId', '')
                },
              })}
            >
              <option value="">{customersLoading ? 'Loading customers…' : 'Select a customer'}</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {customerName(c)}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Service location" htmlFor="serviceLocationId" error={errors.serviceLocationId?.message} required>
            <Select
              id="serviceLocationId"
              disabled={!customerId || locationsLoading}
              aria-invalid={!!errors.serviceLocationId}
              {...register('serviceLocationId')}
            >
              <option value="">{!customerId ? 'Choose a customer first' : 'Select a location'}</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} — {l.address}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Equipment" htmlFor="equipmentId" hint="Optional — link the asset being serviced.">
            <Select id="equipmentId" disabled={!customerId} {...register('equipmentId')}>
              <option value="">None</option>
              {equipment
                .filter((e) => !locationId || !e.serviceLocationId || e.serviceLocationId === locationId)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                    {e.serialNumber ? ` (${e.serialNumber})` : ''}
                  </option>
                ))}
            </Select>
          </FormField>
          <FormField label="Priority" htmlFor="priority" error={errors.priority?.message}>
            <Select id="priority" {...register('priority')}>
              {JOB_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Description" htmlFor="description" error={errors.description?.message} className="md:col-span-2">
            <Textarea id="description" rows={4} placeholder="Scope of work, access instructions, known issues…" {...register('description')} />
          </FormField>
          <FormField label="Internal notes" htmlFor="internalNotes" hint="Only visible to your team." className="md:col-span-2">
            <Textarea id="internalNotes" rows={2} {...register('internalNotes')} />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assignment & schedule</CardTitle>
          <CardDescription>
            {isEdit
              ? 'Use “Schedule” on the job page or the calendar to change the appointment time.'
              : 'Optionally assign a technician and book a time slot now.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField label="Technician" htmlFor="technicianId" error={errors.technicianId?.message}>
            <Select id="technicianId" {...register('technicianId')}>
              <option value="">Unassigned</option>
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
          <FormField label="Estimated duration (minutes)" htmlFor="estimatedDurationMinutes" error={errors.estimatedDurationMinutes?.message}>
            <Input
              id="estimatedDurationMinutes"
              type="number"
              inputMode="numeric"
              min="1"
              step="5"
              placeholder="60"
              {...register('estimatedDurationMinutes', {
                onChange: (e) => {
                  const mins = Number(e.target.value)
                  const start = watch('start')
                  if (start && mins > 0) setValue('end', toLocalInput(addMinutes(new Date(start), mins)))
                },
              })}
            />
          </FormField>
          {!isEdit && (
            <>
              <FormField label="Starts" htmlFor="start" error={errors.start?.message}>
                <Input
                  id="start"
                  type="datetime-local"
                  {...register('start', {
                    onChange: (e) => {
                      const mins = Number(watch('estimatedDurationMinutes')) || 60
                      if (e.target.value && !watch('end')) setValue('end', toLocalInput(addMinutes(new Date(e.target.value), mins)))
                    },
                  })}
                />
              </FormField>
              <FormField label="Ends" htmlFor="end" error={errors.end?.message}>
                <Input id="end" type="datetime-local" {...register('end')} />
              </FormField>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link to={job ? `/jobs/${job.id}` : '/jobs'} className={buttonVariants({ variant: 'secondary' })}>
          Cancel
        </Link>
        <Button type="submit" loading={save.isPending}>
          {isEdit ? 'Save changes' : 'Create job'}
        </Button>
      </div>
    </form>
  )
}

export default function JobFormPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const { data: job, isLoading, isError, error, refetch } = useJob(id)

  return (
    <>
      <PageHeader
        title={id ? 'Edit job' : 'New job'}
        backTo={id ? { to: `/jobs/${id}`, label: 'Back to job' } : { to: '/jobs', label: 'Jobs' }}
      />
      {id && isLoading ? (
        <Card>
          <CardSkeleton lines={6} />
        </Card>
      ) : id && (isError || !job) ? (
        <Card>
          <QueryError error={error} onRetry={() => refetch()} />
        </Card>
      ) : (
        <JobForm
          job={job}
          presetCustomerId={params.get('customerId') ?? undefined}
          presetEquipmentId={params.get('equipmentId') ?? undefined}
        />
      )}
    </>
  )
}
