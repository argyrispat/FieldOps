/**
 * Types mirroring the FieldOps API DTOs (camelCase JSON).
 * Enums are serialised as strings; the API client normalises numeric enum values too.
 */

export type Role = 'Owner' | 'Dispatcher' | 'Technician'

export const JOB_STATUSES = [
  'New',
  'Scheduled',
  'InProgress',
  'OnHold',
  'Completed',
  'Cancelled',
] as const
export type JobStatus = (typeof JOB_STATUSES)[number]

export const JOB_PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'] as const
export type JobPriority = (typeof JOB_PRIORITIES)[number]

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  fullName?: string
  isActive?: boolean
  roles: Role[]
  companyId?: string
  companyName?: string
  technicianId?: string | null
  createdAt?: string
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  expiresAt: string
  user: User
}

export interface ServiceLocation {
  id: string
  customerId: string
  name: string
  address: string
  city?: string | null
  postalCode?: string | null
  notes?: string | null
  isPrimary: boolean
}

export interface Customer {
  id: string
  firstName: string
  lastName: string
  companyName?: string | null
  displayName?: string
  email?: string | null
  phone?: string | null
  address?: string | null
  city?: string | null
  postalCode?: string | null
  notes?: string | null
  locations?: ServiceLocation[]
  serviceLocations?: ServiceLocation[]
  jobCount?: number
  createdAt?: string
}

export interface Technician {
  id: string
  userId: string
  firstName: string
  lastName: string
  fullName?: string
  email?: string | null
  phone?: string | null
  specialty?: string | null
  isActive: boolean
  notes?: string | null
}

export interface JobNote {
  id: string
  jobId: string
  authorId?: string
  authorName?: string
  text: string
  createdAt: string
}

export interface JobPhoto {
  id: string
  jobId: string
  fileName: string
  contentType?: string
  sizeBytes?: number
  caption?: string | null
  /** Relative (to API base URL) or absolute URL to the image content. */
  url?: string
  uploadedByName?: string
  createdAt: string
}

export interface JobMaterial {
  id: string
  jobId: string
  materialId: string
  materialName: string
  unit?: string
  quantity: number
  unitCost: number
  recordedByName?: string
  createdAt?: string
}

export interface Job {
  id: string
  jobNumber: string
  title: string
  description?: string | null
  status: JobStatus
  priority: JobPriority
  customerId: string
  customerName?: string
  serviceLocationId: string
  locationName?: string
  locationAddress?: string
  technicianId?: string | null
  technicianName?: string | null
  equipmentId?: string | null
  equipmentName?: string | null
  scheduledStart?: string | null
  scheduledEnd?: string | null
  estimatedDurationMinutes?: number | null
  actualStart?: string | null
  actualEnd?: string | null
  workPerformed?: string | null
  laborCost?: number | null
  materialsCost?: number | null
  internalNotes?: string | null
  /** Statuses the job can legally move to from its current status. */
  allowedTransitions?: JobStatus[]
  /** True when the schedule endpoint flags an overlap for the assigned technician. */
  hasConflict?: boolean
  notes?: JobNote[]
  photos?: JobPhoto[]
  materials?: JobMaterial[]
  createdAt?: string
  updatedAt?: string
}

export interface Material {
  id: string
  name: string
  sku?: string | null
  description?: string | null
  quantityOnHand: number
  minimumQuantity: number
  unit: string
  unitCost: number
  isLowStock?: boolean
}

export interface Equipment {
  id: string
  customerId: string
  customerName?: string
  serviceLocationId?: string | null
  locationName?: string | null
  name: string
  type?: string | null
  manufacturer?: string | null
  model?: string | null
  serialNumber?: string | null
  installationDate?: string | null
  warrantyExpiration?: string | null
  lastMaintenanceDate?: string | null
  nextMaintenanceDate?: string | null
  notes?: string | null
}

export interface MaintenanceReminder {
  equipmentId: string
  equipmentName: string
  customerId?: string
  customerName?: string
  locationName?: string | null
  nextMaintenanceDate: string
  daysUntilDue?: number
}

export interface MaintenanceReminderSummary {
  overdue: MaintenanceReminder[]
  dueThisWeek: MaintenanceReminder[]
  dueThisMonth: MaintenanceReminder[]
}

export interface StatusCount {
  status: JobStatus
  count: number
}

export interface DatePoint {
  date: string
  count: number
}

export interface TechnicianWorkload {
  technicianId: string
  technicianName: string
  jobCount: number
}

export interface DashboardStats {
  totalJobs: number
  openJobs: number
  jobsToday: number
  completedThisMonth: number
  overdueJobs: number
  totalCustomers: number
  activeTechnicians: number
  lowStockMaterials: number
  overdueMaintenance: number
  jobsByStatus: StatusCount[]
  jobsOverTime: DatePoint[]
  technicianWorkload: TechnicianWorkload[]
  upcomingJobs?: Job[]
}

export interface PagedResult<T> {
  items: T[]
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
}

export interface PagedQuery {
  page?: number
  pageSize?: number
  search?: string
  status?: string
  sortBy?: string
  sortDir?: 'asc' | 'desc'
}

export interface Company {
  id?: string
  name: string
  email?: string | null
  phone?: string | null
  address?: string | null
  city?: string | null
  postalCode?: string | null
  website?: string | null
  allowSchedulingConflicts: boolean
}

export interface SearchResults {
  customers?: Customer[]
  jobs?: Job[]
  equipment?: Equipment[]
}

export interface ScheduleConflict {
  jobId?: string
  jobNumber?: string
  title?: string
  scheduledStart?: string
  scheduledEnd?: string
  message?: string
}

/** Response of POST /jobs/{id}/schedule — either a Job or a wrapper including warnings. */
export interface ScheduleResult {
  job?: Job
  warnings?: string[]
  conflicts?: ScheduleConflict[]
}

export interface ApiErrorBody {
  message?: string
  title?: string
  detail?: string
  errors?: Record<string, string[]> | string[]
  conflicts?: ScheduleConflict[]
}
