import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Mail, Phone, Plus, Users } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { Pagination } from '@/components/Pagination'
import { QueryError } from '@/components/QueryError'
import { SearchInput, useDebounced } from '@/components/SearchInput'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { TableSkeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { fetchPaged } from '@/lib/api'
import { cn, customerName } from '@/lib/utils'
import type { Customer } from '@/types'

export default function CustomersPage() {
  const navigate = useNavigate()
  const [searchText, setSearchText] = useState('')
  const [page, setPage] = useState(1)
  const search = useDebounced(searchText, 350)

  const { data, isLoading, isError, error, refetch, isPlaceholderData } = useQuery({
    queryKey: ['customers', 'list', { page, search }],
    queryFn: () => fetchPaged<Customer>('/customers', { page, pageSize: 20, search, sortBy: 'name', sortDir: 'asc' }),
    placeholderData: keepPreviousData,
  })

  return (
    <>
      <PageHeader
        title="Customers"
        description="Everyone you service, with their locations, equipment and job history."
        actions={
          <Link to="/customers/new" className={buttonVariants()}>
            <Plus /> New customer
          </Link>
        }
      />
      <Card>
        <div className="border-b border-border p-4">
          <SearchInput
            value={searchText}
            onChange={(v) => {
              setSearchText(v)
              setPage(1)
            }}
            placeholder="Search by name, company, email or phone…"
            className="max-w-md"
          />
        </div>
        {isLoading ? (
          <TableSkeleton cols={4} />
        ) : isError ? (
          <QueryError error={error} onRetry={() => refetch()} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon={Users}
            title={search ? 'No customers found' : 'No customers yet'}
            description={search ? `Nothing matches “${search}”.` : 'Add your first customer to start creating jobs.'}
            action={
              !search && (
                <Link to="/customers/new" className={buttonVariants()}>
                  <Plus /> Add customer
                </Link>
              )
            }
          />
        ) : (
          <div className={cn(isPlaceholderData && 'opacity-60 transition-opacity')}>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Customer</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>City</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((c) => (
                    <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/customers/${c.id}`)}>
                      <TableCell>
                        <Link
                          to={`/customers/${c.id}`}
                          className="font-medium text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {customerName(c)}
                        </Link>
                        {c.companyName && (
                          <p className="text-xs text-muted-foreground">
                            {c.firstName} {c.lastName}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <p>{c.email ?? '—'}</p>
                        <p className="text-xs text-muted-foreground">{c.phone}</p>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{c.city ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ul className="divide-y divide-border md:hidden">
              {data.items.map((c) => (
                <li key={c.id}>
                  <Link to={`/customers/${c.id}`} className="block space-y-1 px-4 py-3.5 active:bg-surface-muted">
                    <p className="text-sm font-semibold text-primary">{customerName(c)}</p>
                    {c.email && (
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Mail className="size-3" aria-hidden /> {c.email}
                      </p>
                    )}
                    {c.phone && (
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Phone className="size-3" aria-hidden /> {c.phone}
                      </p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
            <Pagination
              page={data.page}
              pageSize={data.pageSize}
              totalCount={data.totalCount}
              totalPages={data.totalPages}
              onPageChange={setPage}
            />
          </div>
        )}
      </Card>
    </>
  )
}
