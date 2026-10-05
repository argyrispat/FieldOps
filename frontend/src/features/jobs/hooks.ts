import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, getErrorMessage } from '@/lib/api'
import type { Job, JobMaterial, JobNote, JobPhoto, ScheduleConflict, ScheduleResult } from '@/types'
import { formatDateTime } from '@/lib/utils'

export const jobKey = (id?: string) => ['job', id] as const

export function useJob(id?: string) {
  return useQuery({
    queryKey: jobKey(id),
    queryFn: async () => (await api.get<Job>(`/jobs/${id}`)).data,
    enabled: Boolean(id),
  })
}

/** Invalidate everything that can display job data. */
export function useInvalidateJobs() {
  const qc = useQueryClient()
  return (id?: string) => {
    if (id) qc.invalidateQueries({ queryKey: jobKey(id) })
    qc.invalidateQueries({ queryKey: ['jobs'] })
    qc.invalidateQueries({ queryKey: ['schedule'] })
    qc.invalidateQueries({ queryKey: ['my-jobs'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
    qc.invalidateQueries({ queryKey: ['customer-jobs'] })
  }
}

type Action = 'start' | 'hold' | 'cancel' | 'complete'

export interface CompletePayload {
  workPerformed: string
  laborCost?: number | null
  materialsCost?: number | null
}

export function useJobAction(jobId: string) {
  const invalidate = useInvalidateJobs()
  return useMutation({
    mutationFn: async ({ action, body }: { action: Action; body?: Record<string, unknown> | CompletePayload }) =>
      (await api.post<Job>(`/jobs/${jobId}/${action}`, body ?? {})).data,
    onSuccess: (_d, { action }) => {
      invalidate(jobId)
      const msg: Record<Action, string> = {
        start: 'Job started',
        hold: 'Job put on hold',
        cancel: 'Job cancelled',
        complete: 'Job completed',
      }
      toast.success(msg[action])
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
}

export function useAddNote(jobId: string) {
  const invalidate = useInvalidateJobs()
  return useMutation({
    mutationFn: async (text: string) => (await api.post<JobNote>(`/jobs/${jobId}/notes`, { text })).data,
    onSuccess: () => {
      invalidate(jobId)
      toast.success('Note added')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
}

export function useAddMaterial(jobId: string) {
  const invalidate = useInvalidateJobs()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { materialId: string; quantity: number }) =>
      (await api.post<JobMaterial>(`/jobs/${jobId}/materials`, body)).data,
    onSuccess: () => {
      invalidate(jobId)
      qc.invalidateQueries({ queryKey: ['materials'] })
      toast.success('Material recorded')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
}

export function useUploadPhoto(jobId: string) {
  const invalidate = useInvalidateJobs()
  return useMutation({
    mutationFn: async ({ file, caption }: { file: File; caption?: string }) => {
      const form = new FormData()
      form.append('file', file)
      if (caption) form.append('caption', caption)
      return (await api.post<JobPhoto>(`/jobs/${jobId}/photos`, form)).data
    },
    onSuccess: () => {
      invalidate(jobId)
      toast.success('Photo uploaded')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
}

export interface SchedulePayload {
  technicianId: string | null
  scheduledStart: string
  scheduledEnd: string
}

/** Extract human-readable conflict descriptions from a schedule response or 409 body. */
export function describeConflicts(src: {
  warnings?: string[]
  conflicts?: ScheduleConflict[]
  message?: string
}): string[] {
  const out: string[] = [...(src.warnings ?? [])]
  for (const c of src.conflicts ?? []) {
    if (c.message) out.push(c.message)
    else {
      const label = [c.jobNumber, c.title].filter(Boolean).join(' · ') || 'Another job'
      out.push(`${label} (${formatDateTime(c.scheduledStart)} – ${formatDateTime(c.scheduledEnd)})`)
    }
  }
  return out
}

export function useScheduleJob() {
  const invalidate = useInvalidateJobs()
  return useMutation({
    mutationFn: async ({ jobId, ...body }: SchedulePayload & { jobId: string }) => {
      const { data } = await api.post<Job & ScheduleResult>(`/jobs/${jobId}/schedule`, body)
      return { jobId, warnings: describeConflicts(data ?? {}), hasConflict: Boolean(data?.hasConflict) }
    },
    onSuccess: ({ jobId }) => invalidate(jobId),
  })
}
