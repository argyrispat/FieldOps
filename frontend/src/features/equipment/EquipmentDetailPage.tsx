import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ClipboardList, Pencil, Plus, Trash2, Wrench } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { PageHeader } from '@/components/PageHeader'
import { QueryError } from '@/components/QueryError'
import { StatusBadge } from '@/components/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { CardSkeleton } from '@/components/ui/skeleton'
import { api, fetchPaged, getErrorMessage } from '@/lib/api'
import { formatDate, formatDateTime, toDate } from '@/lib/utils'
import type { Equipment, Job } from '@/types'
import { EquipmentFormDialog } from './EquipmentFormDialog'
import { useCreateMaintenanceJob } from './hooks'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{children || <span className="text-muted-foreground">—</span>}</dd>
    </div>
  )
}

export default function EquipmentDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const createJob = useCreateMaintenanceJob()

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['equipment', id],
    queryFn: async () => (await api.get<Equipment>(`/equipment/${id}`)).data,
  })
  const jobs = useQuery({
    queryKey: ['jobs', 'equipment', id],
    queryFn: () => fetchPaged<Job>('/jobs', { page: 1, pageSize: 10, equipmentId: id, sortBy: 'createdAt', sortDir: 'desc' }),
  })

  const remove = useMutation({
    mutationFn: async () => api.delete(`/equipment/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['equipment'] })
      toast.success('Equipment deleted')
      navigate('/equipment', { replace: true })
    },
    onError: (e) => {
      setConfirmDelete(false)
      toast.error(getErrorMessage(e))
    },
  })

  if (isLoading) {
    return (
      <Card>
        <CardSkeleton lines={6} />
      </Card>
    )
  }
  if (isError || !data) {
    return (
      <Card>
        <QueryError error={error} onRetry={() => refetch()} />
      </Card>
    )
  }

  const e = data
  const next = toDate(e.nextMaintenanceDate)
  const overdue = next ? next < new Date() : false
  const warranty = toDate(e.warrantyExpiration)
  const underWarranty = warranty ? warranty >= new Date() : false

  return (
    <>
      <PageHeader
        backTo={{ to: '/equipment', label: 'Equipment' }}
        title={e.name}
        description={[e.type, e.manufacturer, e.model].filter(Boolean).join(' · ') || undefined}
        actions={
          <>
            <Button onClick={() => createJob.mutate(e.id)} loading={createJob.isPending}>
              <Wrench /> Create maintenance job
            </Button>
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              <Pencil /> Edit
            </Button>
            <Button variant="outlineDestructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 /> Delete
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-4">
              <Field label="Customer">
                <Link to={`/customers/${e.customerId}`} className="font-medium text-primary hover:underline">
                  {e.customerName}
                </Link>
              </Field>
              <Field label="Location">{e.locationName}</Field>
              <Field label="Serial number">{e.serialNumber}</Field>
              <Field label="Installed">{e.installationDate ? formatDate(e.installationDate) : null}</Field>
              <Field label="Warranty">
                {warranty ? (
                  <span className="flex items-center gap-2">
                    {formatDate(warranty)}
                    <Badge tone={underWarranty ? 'green' : 'gray'}>{underWarranty ? 'Active' : 'Expired'}</Badge>
                  </span>
                ) : null}
              </Field>
            </dl>
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Maintenance</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2">
                <Field label="Last maintenance">{e.lastMaintenanceDate ? formatDate(e.lastMaintenanceDate) : null}</Field>
                <Field label="Next due">
                  {next ? (
                    <span className="flex items-center gap-2">
                      {formatDate(next)}
                      {overdue && <Badge tone="red">Overdue</Badge>}
                    </span>
                  ) : null}
                </Field>
              </dl>
              {e.notes && <p className="mt-4 whitespace-pre-wrap rounded-md bg-surface-muted px-3 py-2.5 text-sm text-muted-foreground">{e.notes}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Service history</CardTitle>
              <Link to={`/jobs/new?customerId=${e.customerId}&equipmentId=${e.id}`} className={buttonVariants({ size: 'sm', variant: 'secondary' })}>
                <Plus /> New job
              </Link>
            </CardHeader>
            <CardContent className="pt-3">
              {jobs.isLoading ? (
                <CardSkeleton lines={3} />
              ) : jobs.isError ? (
                <QueryError error={jobs.error} onRetry={() => jobs.refetch()} />
              ) : (jobs.data?.items ?? []).length === 0 ? (
                <EmptyState icon={ClipboardList} title="No jobs recorded" description="Jobs linked to this equipment will be listed here." className="py-6" />
              ) : (
                <ul className="divide-y divide-border">
                  {jobs.data!.items.map((j) => (
                    <li key={j.id}>
                      <Link to={`/jobs/${j.id}`} className="flex items-center justify-between gap-3 py-3 hover:opacity-80">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {j.jobNumber} · {j.title}
                          </p>
                          <p className="text-xs text-muted-foreground">{formatDateTime(j.scheduledStart ?? j.actualEnd)}</p>
                        </div>
                        <StatusBadge status={j.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <EquipmentFormDialog open={editOpen} onOpenChange={setEditOpen} equipment={e} />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete equipment?"
        description={`“${e.name}” and its maintenance history will be removed.`}
        confirmLabel="Delete equipment"
        destructive
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </>
  )
}
