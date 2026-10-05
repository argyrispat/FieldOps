import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { AlertTriangle, CalendarClock, CalendarDays, Plus, Wrench } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { Pagination } from '@/components/Pagination'
import { QueryError } from '@/components/QueryError'
import { SearchInput, useDebounced } from '@/components/SearchInput'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton, TableSkeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { fetchPaged } from '@/lib/api'
import { cn, formatDate } from '@/lib/utils'
import type { Equipment, MaintenanceReminder } from '@/types'
import { EquipmentFormDialog } from './EquipmentFormDialog'
import { useCreateMaintenanceJob, useReminders } from './hooks'

type Bucket = 'all' | 'overdue' | 'dueThisWeek' | 'dueThisMonth'

const BUCKETS: {
  key: Exclude<Bucket, 'all'>
  label: string
  icon: typeof AlertTriangle
  tone: string
}[] = [
  { key: 'overdue', label: 'Overdue', icon: AlertTriangle, tone: 'text-destructive' },
  { key: 'dueThisWeek', label: 'Due this week', icon: CalendarClock, tone: 'text-warning' },
  { key: 'dueThisMonth', label: 'Due this month', icon: CalendarDays, tone: 'text-primary' },
]

function ReminderTable({ rows }: { rows: MaintenanceReminder[] }) {
  const create = useCreateMaintenanceJob()
  if (rows.length === 0) {
    return <EmptyState icon={Wrench} title="Nothing here" description="No equipment falls in this maintenance window." />
  }
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Equipment</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Due</TableHead>
          <TableHead className="text-right">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.equipmentId}>
            <TableCell>
              <Link to={`/equipment/${r.equipmentId}`} className="font-medium text-primary hover:underline">
                {r.equipmentName}
              </Link>
              {r.locationName && <p className="text-xs text-muted-foreground">{r.locationName}</p>}
            </TableCell>
            <TableCell>{r.customerName ?? '—'}</TableCell>
            <TableCell className="whitespace-nowrap">
              {formatDate(r.nextMaintenanceDate)}
              {r.daysUntilDue != null && (
                <Badge tone={r.daysUntilDue < 0 ? 'red' : 'amber'} className="ml-2">
                  {r.daysUntilDue < 0 ? `${Math.abs(r.daysUntilDue)}d overdue` : `in ${r.daysUntilDue}d`}
                </Badge>
              )}
            </TableCell>
            <TableCell className="text-right">
              <Button
                size="sm"
                variant="secondary"
                loading={create.isPending && create.variables === r.equipmentId}
                onClick={() => create.mutate(r.equipmentId)}
              >
                Create job
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export default function EquipmentPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const customerId = params.get('customerId') ?? ''
  const [bucket, setBucket] = useState<Bucket>('all')
  const [searchText, setSearchText] = useState('')
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const search = useDebounced(searchText, 350)

  const reminders = useReminders()
  const list = useQuery({
    queryKey: ['equipment', 'list', { page, search, customerId }],
    queryFn: () => fetchPaged<Equipment>('/equipment', { page, pageSize: 20, search, customerId, sortBy: 'name' }),
    placeholderData: keepPreviousData,
  })

  const counts = {
    overdue: reminders.data?.overdue.length ?? 0,
    dueThisWeek: reminders.data?.dueThisWeek.length ?? 0,
    dueThisMonth: reminders.data?.dueThisMonth.length ?? 0,
  }

  return (
    <>
      <PageHeader
        title="Equipment"
        description="Track customer assets and keep maintenance on schedule."
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus /> Add equipment
          </Button>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {BUCKETS.map((b) => (
          <button
            key={b.key}
            type="button"
            onClick={() => setBucket(bucket === b.key ? 'all' : b.key)}
            aria-pressed={bucket === b.key}
            className={cn(
              'flex items-center gap-3 rounded-md border border-border bg-surface px-4 py-3 text-left transition-colors hover:bg-surface-muted/50',
              bucket === b.key && 'border-primary ring-1 ring-primary/30',
            )}
          >
            <b.icon className={cn('size-4 shrink-0', b.tone)} aria-hidden />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{b.label}</p>
              {reminders.isLoading ? (
                <Skeleton className="mt-1 h-6 w-8" />
              ) : (
                <p className="text-xl font-semibold tabular-nums tracking-tight">{counts[b.key]}</p>
              )}
            </div>
          </button>
        ))}
      </div>

      <Card>
        {bucket !== 'all' ? (
          reminders.isLoading ? (
            <TableSkeleton cols={4} rows={4} />
          ) : reminders.isError ? (
            <QueryError error={reminders.error} onRetry={() => reminders.refetch()} />
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold">{BUCKETS.find((b) => b.key === bucket)?.label}</h2>
                <button type="button" onClick={() => setBucket('all')} className="text-sm font-medium text-primary hover:underline">
                  Show all equipment
                </button>
              </div>
              <ReminderTable rows={reminders.data?.[bucket] ?? []} />
            </>
          )
        ) : (
          <>
            <div className="border-b border-border p-4">
              <SearchInput
                value={searchText}
                onChange={(v) => {
                  setSearchText(v)
                  setPage(1)
                }}
                placeholder="Search name, model, serial number…"
                className="max-w-md"
              />
              {customerId && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Filtered to one customer.{' '}
                  <Link to="/equipment" className="font-medium text-primary hover:underline">
                    Clear
                  </Link>
                </p>
              )}
            </div>
            {list.isLoading ? (
              <TableSkeleton cols={5} />
            ) : list.isError ? (
              <QueryError error={list.error} onRetry={() => list.refetch()} />
            ) : !list.data || list.data.items.length === 0 ? (
              <EmptyState
                icon={Wrench}
                title={search ? 'No equipment found' : 'No equipment yet'}
                description={search ? `Nothing matches “${search}”.` : 'Add equipment to track warranties and maintenance.'}
                action={
                  !search && (
                    <Button onClick={() => setFormOpen(true)}>
                      <Plus /> Add equipment
                    </Button>
                  )
                }
              />
            ) : (
              <div className={cn(list.isPlaceholderData && 'opacity-60 transition-opacity')}>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Equipment</TableHead>
                      <TableHead className="hidden md:table-cell">Customer</TableHead>
                      <TableHead className="hidden lg:table-cell">Model / serial</TableHead>
                      <TableHead>Next maintenance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.data.items.map((e) => {
                      const due = e.nextMaintenanceDate ? new Date(e.nextMaintenanceDate) : null
                      const overdue = due ? due < new Date() : false
                      return (
                        <TableRow key={e.id} className="cursor-pointer" onClick={() => navigate(`/equipment/${e.id}`)}>
                          <TableCell>
                            <Link
                              to={`/equipment/${e.id}`}
                              onClick={(ev) => ev.stopPropagation()}
                              className="font-medium text-primary hover:underline"
                            >
                              {e.name}
                            </Link>
                            {e.type && <p className="text-xs text-muted-foreground">{e.type}</p>}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">{e.customerName ?? '—'}</TableCell>
                          <TableCell className="hidden text-muted-foreground lg:table-cell">
                            {[e.model, e.serialNumber].filter(Boolean).join(' · ') || '—'}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {e.nextMaintenanceDate ? (
                              <span className={cn(overdue && 'font-medium text-destructive')}>
                                {formatDate(e.nextMaintenanceDate)}
                                {overdue && <Badge tone="red" className="ml-2">Overdue</Badge>}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Not scheduled</span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
                <Pagination
                  page={list.data.page}
                  pageSize={list.data.pageSize}
                  totalCount={list.data.totalCount}
                  totalPages={list.data.totalPages}
                  onPageChange={setPage}
                />
              </div>
            )}
          </>
        )}
      </Card>

      <EquipmentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        defaultCustomerId={customerId || undefined}
        onSaved={(saved) => saved?.id && navigate(`/equipment/${saved.id}`)}
      />
    </>
  )
}
