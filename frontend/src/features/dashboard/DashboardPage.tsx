import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  Boxes,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  HardHat,
  Plus,
  Users,
  Wrench,
} from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { PageHeader } from '@/components/PageHeader'
import { QueryError } from '@/components/QueryError'
import { PriorityBadge, STATUS_COLOR, StatusBadge, statusLabel } from '@/components/StatusBadge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/AuthContext'
import { useTheme } from '@/features/theme/ThemeProvider'
import { api } from '@/lib/api'
import { cn, formatDate, formatDateTime } from '@/lib/utils'
import type { DashboardStats } from '@/types'

function StatLink({
  label,
  value,
  to,
  emphasize,
}: {
  label: string
  value: number
  to: string
  emphasize?: 'danger' | 'warning'
}) {
  return (
    <Link
      to={to}
      className={cn(
        'flex min-w-0 flex-col gap-1 border-r border-border px-4 py-3 last:border-r-0 sm:px-5',
        'hover:bg-surface-muted/60 transition-colors',
      )}
    >
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span
        className={cn(
          'text-2xl font-semibold tabular-nums tracking-tight',
          emphasize === 'danger' && value > 0 && 'text-destructive',
          emphasize === 'warning' && value > 0 && 'text-warning',
        )}
      >
        {value}
      </span>
    </Link>
  )
}

function Section({
  title,
  action,
  children,
  className,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-border pb-3">
        <CardTitle>{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  )
}

function ChartWrap({ children }: { children: ReactNode }) {
  return <div className="h-52 pt-3">{children}</div>
}

function NoChartData({ text }: { text: string }) {
  return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{text}</div>
}

function useChartColors() {
  const { theme } = useTheme()
  return useMemo(() => {
    if (typeof window === 'undefined') {
      return { grid: '#e1e4ea', tick: '#5c6573', cursor: '#eef0f3', line: '#0f766e', bar: '#14b8a6' }
    }
    const s = getComputedStyle(document.documentElement)
    return {
      grid: s.getPropertyValue('--chart-grid').trim() || (theme === 'dark' ? '#2e343e' : '#e1e4ea'),
      tick: s.getPropertyValue('--chart-tick').trim() || (theme === 'dark' ? '#9aa3b0' : '#5c6573'),
      cursor: s.getPropertyValue('--chart-cursor').trim() || (theme === 'dark' ? '#242930' : '#eef0f3'),
      line: s.getPropertyValue('--chart-line').trim() || (theme === 'dark' ? '#2dd4bf' : '#0f766e'),
      bar: s.getPropertyValue('--chart-bar').trim() || '#14b8a6',
    }
  }, [theme])
}

export default function DashboardPage() {
  const { user } = useAuth()
  const chart = useChartColors()
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => (await api.get<DashboardStats>('/dashboard')).data,
    refetchInterval: 60_000,
  })

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const header = (
    <PageHeader
      title={`${greeting}, ${user?.firstName ?? ''}`.trim()}
      description="Today’s field operations at a glance."
      actions={
        <>
          <Link to="/calendar" className={buttonVariants({ variant: 'secondary' })}>
            <CalendarClock /> Calendar
          </Link>
          <Link to="/jobs/new" className={buttonVariants()}>
            <Plus /> New job
          </Link>
        </>
      }
    />
  )

  if (isLoading) {
    return (
      <>
        {header}
        <Skeleton className="h-20 w-full" />
        <div className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </>
    )
  }

  if (isError || !data) {
    return (
      <>
        {header}
        <Card>
          <QueryError error={error} onRetry={() => refetch()} />
        </Card>
      </>
    )
  }

  const statusData = (data.jobsByStatus ?? []).map((s) => ({
    ...s,
    name: statusLabel(s.status),
  }))
  const hasStatusData = statusData.some((s) => s.count > 0)
  const timeData = (data.jobsOverTime ?? []).map((p) => ({ ...p, label: formatDate(p.date, 'MMM d') }))
  const workload = (data.technicianWorkload ?? []).map((t) => ({ name: t.technicianName, jobs: t.jobCount }))
  const upcoming = data.upcomingJobs ?? []

  const secondary = [
    { label: 'Customers', value: data.totalCustomers, to: '/customers', icon: Users },
    { label: 'Technicians', value: data.activeTechnicians, to: '/calendar', icon: HardHat },
    {
      label: 'Maintenance due',
      value: data.overdueMaintenance,
      to: '/equipment',
      icon: Wrench,
      alert: data.overdueMaintenance > 0,
    },
    {
      label: 'Low stock',
      value: data.lowStockMaterials,
      to: '/inventory',
      icon: Boxes,
      alert: data.lowStockMaterials > 0,
    },
  ]

  return (
    <>
      {header}

      {/* Primary KPIs — one compact strip, not eight colorful cards */}
      <Card className="overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-4">
          <StatLink label="Open jobs" value={data.openJobs} to="/jobs" />
          <StatLink label="Scheduled today" value={data.jobsToday} to="/calendar" />
          <StatLink label="Completed this month" value={data.completedThisMonth} to="/jobs?status=Completed" />
          <StatLink label="Overdue" value={data.overdueJobs} to="/jobs" emphasize="danger" />
        </div>
      </Card>

      {/* Secondary metrics — quiet row */}
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 px-1 text-sm text-muted-foreground">
        {secondary.map((item) => (
          <Link
            key={item.label}
            to={item.to}
            className={cn(
              'inline-flex items-center gap-1.5 hover:text-foreground',
              item.alert && 'text-warning',
            )}
          >
            <item.icon className="size-3.5 shrink-0" aria-hidden />
            <span>
              {item.label}
              <span className="ml-1 font-medium text-foreground tabular-nums">{item.value}</span>
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <Section
          title="Upcoming jobs"
          action={
            <Link to="/jobs" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          }
        >
          {upcoming.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="Nothing scheduled"
              description="Schedule a job from the calendar to see it here."
              className="py-8"
            />
          ) : (
            <ul className="divide-y divide-border">
              {upcoming.slice(0, 6).map((j) => (
                <li key={j.id}>
                  <Link
                    to={`/jobs/${j.id}`}
                    className="flex items-center justify-between gap-3 py-2.5 hover:bg-surface-muted/40 -mx-1 px-1 rounded-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        <span className="text-muted-foreground">{j.jobNumber}</span>
                        <span className="mx-1.5 text-border">·</span>
                        {j.title}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatDateTime(j.scheduledStart)}
                        {j.customerName ? ` · ${j.customerName}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <PriorityBadge priority={j.priority} className="hidden sm:inline-flex" />
                      <StatusBadge status={j.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Jobs by status">
          <ChartWrap>
            {hasStatusData ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="count"
                    nameKey="name"
                    innerRadius={48}
                    outerRadius={74}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {statusData.map((s) => (
                      <Cell key={s.status} fill={STATUS_COLOR[s.status]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <NoChartData text="No jobs yet." />
            )}
          </ChartWrap>
          {hasStatusData && (
            <ul className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-border pt-3">
              {statusData
                .filter((s) => s.count > 0)
                .map((s) => (
                  <li key={s.status} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: STATUS_COLOR[s.status] }}
                      aria-hidden
                    />
                    <span className="truncate">{s.name}</span>
                    <span className="ml-auto tabular-nums font-medium text-foreground">{s.count}</span>
                  </li>
                ))}
            </ul>
          )}
        </Section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Section title="Jobs created">
          <ChartWrap>
            {timeData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeData} margin={{ left: -20, right: 4, top: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: chart.tick }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: chart.tick }} tickLine={false} axisLine={false} width={28} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    name="Jobs"
                    stroke={chart.line}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <NoChartData text="No activity for this period." />
            )}
          </ChartWrap>
        </Section>

        <Section title="Technician workload">
          <ChartWrap>
            {workload.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workload} margin={{ left: -20, right: 4, top: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: chart.tick }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: chart.tick }} tickLine={false} axisLine={false} width={28} />
                  <Tooltip
                    cursor={{ fill: chart.cursor }}
                    contentStyle={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="jobs" name="Open jobs" fill={chart.bar} radius={[3, 3, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <NoChartData text="No assigned jobs yet." />
            )}
          </ChartWrap>
        </Section>
      </div>

      {/* Attention items when relevant */}
      {(data.overdueJobs > 0 || data.overdueMaintenance > 0 || data.lowStockMaterials > 0) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {data.overdueJobs > 0 && (
            <Link
              to="/jobs"
              className="inline-flex items-center gap-1.5 rounded-md border border-danger-border bg-danger-bg px-3 py-1.5 text-xs font-medium text-danger-fg"
            >
              <AlertTriangle className="size-3.5" aria-hidden />
              {data.overdueJobs} overdue job{data.overdueJobs === 1 ? '' : 's'}
            </Link>
          )}
          {data.overdueMaintenance > 0 && (
            <Link
              to="/equipment"
              className="inline-flex items-center gap-1.5 rounded-md border border-notice-border bg-notice-bg px-3 py-1.5 text-xs font-medium text-notice-fg"
            >
              <Wrench className="size-3.5" aria-hidden />
              {data.overdueMaintenance} overdue maintenance
            </Link>
          )}
          {data.lowStockMaterials > 0 && (
            <Link
              to="/inventory"
              className="inline-flex items-center gap-1.5 rounded-md border border-notice-border bg-notice-bg px-3 py-1.5 text-xs font-medium text-notice-fg"
            >
              <Boxes className="size-3.5" aria-hidden />
              {data.lowStockMaterials} low-stock material{data.lowStockMaterials === 1 ? '' : 's'}
            </Link>
          )}
          {data.completedThisMonth > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="size-3.5 text-success" aria-hidden />
              {data.completedThisMonth} completed this month
            </span>
          )}
          {data.openJobs === 0 && (
            <span className="inline-flex items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground">
              <ClipboardList className="size-3.5" aria-hidden />
              No open jobs
            </span>
          )}
        </div>
      )}
    </>
  )
}
