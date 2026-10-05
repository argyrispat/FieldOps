import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, ClipboardList, Mail, MapPin, Pencil, Phone, Plus, Trash2, Wrench } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { PageHeader } from '@/components/PageHeader'
import { QueryError } from '@/components/QueryError'
import { PriorityBadge, StatusBadge } from '@/components/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { CardSkeleton } from '@/components/ui/skeleton'
import { useLocations } from '@/features/lookups'
import { api, fetchPaged, getErrorMessage } from '@/lib/api'
import { customerName, formatDate, formatDateTime } from '@/lib/utils'
import type { Customer, Equipment, Job, ServiceLocation } from '@/types'
import { LocationDialog } from './LocationDialog'

export default function CustomerDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [locDialog, setLocDialog] = useState<{ open: boolean; location: ServiceLocation | null }>({ open: false, location: null })
  const [deleteLoc, setDeleteLoc] = useState<ServiceLocation | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const customer = useQuery({
    queryKey: ['customer', id],
    queryFn: async () => (await api.get<Customer>(`/customers/${id}`)).data,
  })
  const locations = useLocations(id)
  const jobs = useQuery({
    queryKey: ['customer-jobs', id],
    queryFn: () => fetchPaged<Job>('/jobs', { page: 1, pageSize: 10, customerId: id, sortBy: 'createdAt', sortDir: 'desc' }),
  })
  const equipment = useQuery({
    queryKey: ['equipment', 'customer', id],
    queryFn: () => fetchPaged<Equipment>('/equipment', { page: 1, pageSize: 50, customerId: id }),
  })

  const removeCustomer = useMutation({
    mutationFn: async () => api.delete(`/customers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] })
      toast.success('Customer deleted')
      navigate('/customers', { replace: true })
    },
    onError: (e) => {
      setConfirmDelete(false)
      toast.error(getErrorMessage(e))
    },
  })

  const removeLocation = useMutation({
    mutationFn: async (loc: ServiceLocation) => api.delete(`/customers/${id}/locations/${loc.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers', id] })
      toast.success('Location removed')
      setDeleteLoc(null)
    },
    onError: (e) => {
      setDeleteLoc(null)
      toast.error(getErrorMessage(e))
    },
  })

  if (customer.isLoading) {
    return (
      <Card>
        <CardSkeleton lines={5} />
      </Card>
    )
  }
  if (customer.isError || !customer.data) {
    return (
      <Card>
        <QueryError error={customer.error} onRetry={() => customer.refetch()} />
      </Card>
    )
  }
  const c = customer.data
  const addressLine = [c.address, c.city, c.postalCode].filter(Boolean).join(', ')

  return (
    <>
      <PageHeader
        backTo={{ to: '/customers', label: 'Customers' }}
        title={customerName(c)}
        description={c.companyName ? `${c.firstName} ${c.lastName}` : undefined}
        actions={
          <>
            <Link to={`/jobs/new?customerId=${c.id}`} className={buttonVariants()}>
              <Plus /> New job
            </Link>
            <Link to={`/customers/${c.id}/edit`} className={buttonVariants({ variant: 'secondary' })}>
              <Pencil /> Edit
            </Link>
            <Button variant="outlineDestructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 /> Delete
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Contact details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {c.companyName && (
                <p className="flex items-center gap-2.5">
                  <Building2 className="size-4 text-muted-foreground" aria-hidden /> {c.companyName}
                </p>
              )}
              <p className="flex items-center gap-2.5">
                <Mail className="size-4 text-muted-foreground" aria-hidden />
                {c.email ? (
                  <a href={`mailto:${c.email}`} className="text-primary hover:underline">
                    {c.email}
                  </a>
                ) : (
                  <span className="text-muted-foreground">No email</span>
                )}
              </p>
              <p className="flex items-center gap-2.5">
                <Phone className="size-4 text-muted-foreground" aria-hidden />
                {c.phone ? (
                  <a href={`tel:${c.phone}`} className="text-primary hover:underline">
                    {c.phone}
                  </a>
                ) : (
                  <span className="text-muted-foreground">No phone</span>
                )}
              </p>
              {addressLine && (
                <p className="flex items-start gap-2.5">
                  <MapPin className="mt-0.5 size-4 text-muted-foreground" aria-hidden /> {addressLine}
                </p>
              )}
              {c.notes && (
                <div className="rounded-md bg-surface-muted px-3 py-2.5">
                  <p className="whitespace-pre-wrap text-muted-foreground">{c.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Service locations</CardTitle>
              <Button size="sm" variant="secondary" onClick={() => setLocDialog({ open: true, location: null })}>
                <Plus /> Add
              </Button>
            </CardHeader>
            <CardContent>
              {locations.isLoading ? (
                <CardSkeleton lines={2} />
              ) : locations.isError ? (
                <QueryError error={locations.error} onRetry={() => locations.refetch()} />
              ) : (locations.data ?? []).length === 0 ? (
                <EmptyState icon={MapPin} title="No locations" description="Add where work gets done — jobs need a location." className="py-6" />
              ) : (
                <ul className="space-y-3">
                  {(locations.data ?? []).map((l) => (
                    <li key={l.id} className="rounded-md border border-border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 text-sm font-medium">
                            {l.name}
                            {l.isPrimary && <Badge tone="teal">Primary</Badge>}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {[l.address, l.city, l.postalCode].filter(Boolean).join(', ')}
                          </p>
                          {l.notes && <p className="mt-1 text-xs text-muted-foreground">{l.notes}</p>}
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button size="icon" variant="ghost" aria-label={`Edit ${l.name}`} onClick={() => setLocDialog({ open: true, location: l })}>
                            <Pencil />
                          </Button>
                          <Button size="icon" variant="ghost" aria-label={`Delete ${l.name}`} onClick={() => setDeleteLoc(l)}>
                            <Trash2 className="text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Recent jobs</CardTitle>
              <Link to={`/jobs?search=${encodeURIComponent(customerName(c))}`} className="text-sm font-medium text-primary hover:underline">
                View in jobs
              </Link>
            </CardHeader>
            <CardContent className="pt-3">
              {jobs.isLoading ? (
                <CardSkeleton lines={3} />
              ) : jobs.isError ? (
                <QueryError error={jobs.error} onRetry={() => jobs.refetch()} />
              ) : (jobs.data?.items ?? []).length === 0 ? (
                <EmptyState
                  icon={ClipboardList}
                  title="No jobs for this customer"
                  className="py-6"
                  action={
                    <Link to={`/jobs/new?customerId=${c.id}`} className={buttonVariants({ size: 'sm' })}>
                      <Plus /> Create job
                    </Link>
                  }
                />
              ) : (
                <ul className="divide-y divide-border">
                  {jobs.data!.items.map((j) => (
                    <li key={j.id}>
                      <Link to={`/jobs/${j.id}`} className="flex items-center justify-between gap-3 py-3 hover:opacity-80">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {j.jobNumber} · {j.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(j.scheduledStart)} · {j.locationName}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <PriorityBadge priority={j.priority} className="hidden sm:inline-flex" />
                          <StatusBadge status={j.status} />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Equipment</CardTitle>
              <Link to={`/equipment?customerId=${c.id}`} className="text-sm font-medium text-primary hover:underline">
                Manage equipment
              </Link>
            </CardHeader>
            <CardContent className="pt-3">
              {equipment.isLoading ? (
                <CardSkeleton lines={2} />
              ) : equipment.isError ? (
                <QueryError error={equipment.error} onRetry={() => equipment.refetch()} />
              ) : (equipment.data?.items ?? []).length === 0 ? (
                <EmptyState icon={Wrench} title="No equipment on file" description="Track assets and maintenance schedules from the Equipment page." className="py-6" />
              ) : (
                <ul className="divide-y divide-border">
                  {equipment.data!.items.map((e) => (
                    <li key={e.id}>
                      <Link to={`/equipment/${e.id}`} className="flex items-center justify-between gap-3 py-3 hover:opacity-80">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{e.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {[e.manufacturer, e.model, e.serialNumber].filter(Boolean).join(' · ') || e.type}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {e.nextMaintenanceDate ? `Service ${formatDate(e.nextMaintenanceDate)}` : 'No schedule'}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <LocationDialog
        customerId={id}
        open={locDialog.open}
        location={locDialog.location}
        onOpenChange={(open) => setLocDialog((s) => ({ ...s, open }))}
      />
      <ConfirmDialog
        open={Boolean(deleteLoc)}
        onOpenChange={(o) => !o && setDeleteLoc(null)}
        title="Delete location?"
        description={`“${deleteLoc?.name}” will be removed. Locations with jobs may not be deletable.`}
        confirmLabel="Delete location"
        destructive
        loading={removeLocation.isPending}
        onConfirm={() => deleteLoc && removeLocation.mutate(deleteLoc)}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete customer?"
        description={`This permanently removes ${customerName(c)} and may affect related locations, equipment and job history.`}
        confirmLabel="Delete customer"
        destructive
        loading={removeCustomer.isPending}
        onConfirm={() => removeCustomer.mutate()}
      />
    </>
  )
}
