import type { Job, JobStatus } from '@/types'

/** Mirrors the backend's JobStatusTransitions; used only if the API doesn't send allowedTransitions. */
const ALLOWED: Record<JobStatus, JobStatus[]> = {
  New: ['Scheduled', 'InProgress', 'Cancelled'],
  Scheduled: ['InProgress', 'OnHold', 'Cancelled', 'New'],
  InProgress: ['OnHold', 'Completed', 'Cancelled'],
  OnHold: ['Scheduled', 'InProgress', 'Cancelled'],
  Completed: [],
  Cancelled: ['New'],
}

export function allowedTransitions(job: Pick<Job, 'status' | 'allowedTransitions'>): JobStatus[] {
  return job.allowedTransitions ?? ALLOWED[job.status] ?? []
}

export interface JobCapabilities {
  canStart: boolean
  canResume: boolean
  canHold: boolean
  canComplete: boolean
  canCancel: boolean
  canSchedule: boolean
  /** Notes, photos and materials can be added until the job is closed. */
  canRecordWork: boolean
}

export function capabilitiesFor(job: Pick<Job, 'status' | 'allowedTransitions'>): JobCapabilities {
  const next = allowedTransitions(job)
  return {
    canStart: job.status !== 'InProgress' && job.status !== 'OnHold' && next.includes('InProgress'),
    canResume: job.status === 'OnHold' && next.includes('InProgress'),
    canHold: next.includes('OnHold'),
    canComplete: next.includes('Completed'),
    canCancel: next.includes('Cancelled'),
    canSchedule: job.status !== 'Completed' && job.status !== 'Cancelled' && job.status !== 'InProgress',
    canRecordWork: job.status !== 'Completed' && job.status !== 'Cancelled',
  }
}
