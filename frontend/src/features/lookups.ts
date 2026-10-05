import { useQuery } from '@tanstack/react-query'
import { fetchList, fetchPaged } from '@/lib/api'
import type { Customer, Equipment, Material, ServiceLocation, Technician } from '@/types'

/** Active technicians for dropdowns / filters. */
export function useTechnicians(enabled = true) {
  return useQuery({
    queryKey: ['technicians', 'lookup'],
    queryFn: () => fetchPaged<Technician>('/technicians', { page: 1, pageSize: 100 }).then((r) => r.items),
    enabled,
    staleTime: 60_000,
  })
}

export function useCustomerOptions(enabled = true) {
  return useQuery({
    queryKey: ['customers', 'lookup'],
    queryFn: () => fetchPaged<Customer>('/customers', { page: 1, pageSize: 100, sortBy: 'name' }).then((r) => r.items),
    enabled,
    staleTime: 60_000,
  })
}

export function useLocations(customerId?: string) {
  return useQuery({
    queryKey: ['customers', customerId, 'locations'],
    queryFn: () => fetchList<ServiceLocation>(`/customers/${customerId}/locations`),
    enabled: Boolean(customerId),
  })
}

export function useMaterialOptions(enabled = true) {
  return useQuery({
    queryKey: ['materials', 'lookup'],
    queryFn: () => fetchPaged<Material>('/materials', { page: 1, pageSize: 100, sortBy: 'name' }).then((r) => r.items),
    enabled,
    staleTime: 30_000,
  })
}

export function useEquipmentOptions(customerId?: string) {
  return useQuery({
    queryKey: ['equipment', 'lookup', customerId],
    queryFn: () => fetchPaged<Equipment>('/equipment', { page: 1, pageSize: 100, customerId }).then((r) => r.items),
    enabled: Boolean(customerId),
  })
}
