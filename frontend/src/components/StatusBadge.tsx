import { AlertTriangle, ArrowDown, ArrowUp, ChevronsUp, Minus } from 'lucide-react'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import type { JobPriority, JobStatus } from '@/types'

const STATUS_TONE: Record<JobStatus, NonNullable<BadgeProps['tone']>> = {
  New: 'gray',
  Scheduled: 'blue',
  InProgress: 'teal',
  OnHold: 'amber',
  Completed: 'green',
  Cancelled: 'red',
}

const STATUS_LABEL: Record<JobStatus, string> = {
  New: 'New',
  Scheduled: 'Scheduled',
  InProgress: 'In progress',
  OnHold: 'On hold',
  Completed: 'Completed',
  Cancelled: 'Cancelled',
}

const PRIORITY_TONE: Record<JobPriority, NonNullable<BadgeProps['tone']>> = {
  Low: 'gray',
  Normal: 'blue',
  High: 'orange',
  Urgent: 'red',
}

export const statusLabel = (s: JobStatus) => STATUS_LABEL[s] ?? s

export const STATUS_COLOR: Record<JobStatus, string> = {
  New: '#94a3b8',
  Scheduled: '#3b82f6',
  InProgress: '#0d9488',
  OnHold: '#f59e0b',
  Completed: '#22c55e',
  Cancelled: '#ef4444',
}

export function StatusBadge({ status, className }: { status: JobStatus; className?: string }) {
  return (
    <Badge tone={STATUS_TONE[status] ?? 'gray'} className={className}>
      {STATUS_LABEL[status] ?? status}
    </Badge>
  )
}

export function PriorityBadge({ priority, className }: { priority: JobPriority; className?: string }) {
  const Icon =
    priority === 'Urgent' ? AlertTriangle : priority === 'High' ? ChevronsUp : priority === 'Low' ? ArrowDown : priority === 'Normal' ? Minus : ArrowUp
  return (
    <Badge tone={PRIORITY_TONE[priority] ?? 'gray'} className={className}>
      <Icon className="size-3" aria-hidden />
      {priority}
    </Badge>
  )
}
