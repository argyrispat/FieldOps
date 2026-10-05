import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, ClipboardList, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { Pagination } from '@/components/Pagination'
import { QueryError } from '@/components/QueryError'
import { SearchInput, useDebounced } from '@/components/SearchInput'
import { PriorityBadge, StatusBadge, statusLabel } from '@/components/StatusBadge'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Select } from '@/components/ui/select'
import { TableSkeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useTechnicians } from '@/features/lookups'
import { fetchPaged } from '@/lib/api'
import { cn, formatDateTime, fullName } from '@/lib/utils'
import { JOB_PRIORITIES, JOB_STATUSES, type Job } from '@/types'

const PAGE_SIZE = 20

const COLUMNS: { key: string; label: string; sortable?: boolean }[] = [
  { key: 'jobNumber', label: 'Job', sortable: true },
  { key: 'customer', label: 'Customer' },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'priority', label: 'Priority', sortable: true },
  { key: 'technician', label: 'Technician' },
  { key: 'scheduledStart', label: 'Scheduled', sortable: true },
]

export default function JobsPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? ''
  const priority = params.get('priority') ?? ''
  const technicianId = params.get('technicianId') ?? ''
  const sortBy = params.get('sortBy') ?? 'createdAt'
  const sortDir = (params.get('sortDir') as 'asc' | 'desc' | null) ?? 'desc'
  const page = Number(params.get('page') ?? '1') || 1

  const [searchText, setSearchText] = useState(params.get('search') ?? '')
  const search = useDebounced(searchText, 350)
  const { data: technicians = [] } = useTechnicians()

  const update = (patch: Record<string, string | null>, resetPage = true) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [k, v] of Object.entries(patch)) {
          if (v) next.set(k, v)
          else next.delete(k)
        }
        if (resetPage) next.delete('page')
        return next
      },
      { replace: true },
    )
  }

  // Sync the debounced search term into the URL.
  useEffect(() => {
    if ((params.get('search') ?? '') !== search) update({ search: search || null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const { data, isLoading, isError, error, refetch, isPlaceholderData } = useQuery({
    queryKey: ['jobs', 'list', { page, search, status, priority, technicianId, sortBy, sortDir }],
    queryFn: () =>
      fetchPaged<Job>('/jobs', { page, pageSize: PAGE_SIZE, search, status, priority, technicianId, sortBy, sortDir }),
    placeholderData: keepPreviousData,
  })

  const toggleSort = (key: string) => {
    if (sortBy === key) update({ sortDir: sortDir === 'asc' ? 'desc' : 'asc' }, false)
    else update({ sortBy: key, sortDir: 'asc' }, false)
  }

  const hasFilters = Boolean(search || status || priority || technicianId)

  return (
    <>
      <PageHeader
        title="Jobs"
        description="Create, assign and track every work order."
        actions={
          <Link to="/jobs/new" className={buttonVariants()}>
            <Plus /> New job
          </Link>
        }
      />

      <Card>
        <div className="grid gap-3 border-b border-border p-4 md:grid-cols-2 xl:grid-cols-[1.5fr_1fr_1fr_1fr_auto]">
          <SearchInput value={searchText} onChange={setSearchText} placeholder="Search jobs, customers, job numbers…" />
          <Select value={status} onChange={(e) => update({ status: e.target.value || null })} aria-label="Filter by status">
            <option value="">All statuses</option>
            {JOB_STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </Select>
          <Select value={priority} onChange={(e) => update({ priority: e.target.value || null })} aria-label="Filter by priority">
            <option value="">All priorities</option>
            {JOB_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
          <Select
            value={technicianId}
            onChange={(e) => update({ technicianId: e.target.value || null })}
            aria-label="Filter by technician"
          >
            <option value="">All technicians</option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                {fullName(t)}
              </option>
            ))}
          </Select>
          {hasFilters && (
            <button
              type="button"
              className="text-sm font-medium text-primary hover:underline"
              onClick={() => {
                setSearchText('')
                setParams({}, { replace: true })
              }}
            >
              Clear filters
            </button>
          )}
        </div>

        {isLoading ? (
          <TableSkeleton cols={6} />
        ) : isError ? (
          <QueryError error={error} onRetry={() => refetch()} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={hasFilters ? 'No jobs match your filters' : 'No jobs yet'}
            description={
              hasFilters ? 'Try adjusting or clearing the filters.' : 'Create your first job to start scheduling work.'
            }
            action={
              !hasFilters && (
                <Link to="/jobs/new" className={buttonVariants()}>
                  <Plus /> Create job
                </Link>
              )
            }
          />
        ) : (
          <div className={cn(isPlaceholderData && 'opacity-60 transition-opacity')}>
            {/* Desktop table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    {COLUMNS.map((c) => (
                      <TableHead key={c.key}>
                        {c.sortable ? (
                          <button
                            type="button"
                            onClick={() => toggleSort(c.key)}
                            className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-foreground"
                          >
                            {c.label}
                            {sortBy === c.key &&
                              (sortDir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                          </button>
                        ) : (
                          c.label
                        )}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((j) => (
                    <TableRow
                      key={j.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/jobs/${j.id}`)}
                    >
                      <TableCell>
                        <Link
                          to={`/jobs/${j.id}`}
                          className="font-medium text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {j.jobNumber}
                        </Link>
                        <p className="max-w-64 truncate text-muted-foreground">{j.title}</p>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{j.customerName ?? '—'}</p>
                        <p className="max-w-56 truncate text-xs text-muted-foreground">{j.locationName ?? j.locationAddress}</p>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={j.status} />
                      </TableCell>
                      <TableCell>
                        <PriorityBadge priority={j.priority} />
                      </TableCell>
                      <TableCell>{j.technicianName ?? <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDateTime(j.scheduledStart)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <ul className="divide-y divide-border md:hidden">
              {data.items.map((j) => (
                <li key={j.id}>
                  <Link to={`/jobs/${j.id}`} className="block space-y-2 px-4 py-3.5 active:bg-surface-muted">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-primary">{j.jobNumber}</p>
                        <p className="truncate text-sm">{j.title}</p>
                      </div>
                      <StatusBadge status={j.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {j.customerName} · {j.technicianName ?? 'Unassigned'}
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <PriorityBadge priority={j.priority} />
                      <span>{formatDateTime(j.scheduledStart)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>

            <Pagination
              page={data.page}
              pageSize={data.pageSize}
              totalCount={data.totalCount}
              totalPages={data.totalPages}
              onPageChange={(p) => update({ page: String(p) }, false)}
            />
          </div>
        )}
      </Card>
    </>
  )
}
