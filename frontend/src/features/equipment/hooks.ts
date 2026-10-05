import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { api, getErrorMessage } from '@/lib/api'
import type { Job, MaintenanceReminderSummary } from '@/types'

export function useReminders() {
  return useQuery({
    queryKey: ['equipment', 'reminders'],
    queryFn: async () => {
      const { data } = await api.get<Partial<MaintenanceReminderSummary>>('/equipment/reminders')
      return {
        overdue: data?.overdue ?? [],
        dueThisWeek: data?.dueThisWeek ?? [],
        dueThisMonth: data?.dueThisMonth ?? [],
      } satisfies MaintenanceReminderSummary
    },
  })
}

export function useCreateMaintenanceJob() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  return useMutation({
    mutationFn: async (equipmentId: string) => (await api.post<Job>(`/equipment/${equipmentId}/maintenance-job`, {})).data,
    onSuccess: (job) => {
      qc.invalidateQueries({ queryKey: ['jobs'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Maintenance job created')
      if (job?.id) navigate(`/jobs/${job.id}`)
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
}
