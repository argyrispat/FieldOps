import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Plus, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { FormField } from '@/components/FormField'
import { PageHeader } from '@/components/PageHeader'
import { QueryError } from '@/components/QueryError'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { CardSkeleton, TableSkeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/features/auth/AuthContext'
import { api, fetchList, getErrorMessage } from '@/lib/api'
import { cn, emptyToNull, formatDate, fullName } from '@/lib/utils'
import type { Company, Role, User } from '@/types'

// ---------------------------------------------------------------------------
// Company
// ---------------------------------------------------------------------------

const companySchema = z.object({
  name: z.string().trim().min(2, 'Company name is required').max(150),
  email: z
    .string()
    .refine((v) => v.trim() === '' || z.string().email().safeParse(v.trim()).success, 'Enter a valid email address'),
  phone: z.string().max(40),
  website: z.string().max(200),
  address: z.string().max(200),
  city: z.string().max(100),
  postalCode: z.string().max(20),
  allowSchedulingConflicts: z.boolean(),
})
type CompanyValues = z.infer<typeof companySchema>

function CompanySettings() {
  const qc = useQueryClient()
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['company'],
    queryFn: async () => (await api.get<Company>('/company')).data,
  })
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<CompanyValues>({
    resolver: zodResolver(companySchema),
    defaultValues: { name: '', email: '', phone: '', website: '', address: '', city: '', postalCode: '', allowSchedulingConflicts: true },
  })

  useEffect(() => {
    if (data)
      reset({
        name: data.name ?? '',
        email: data.email ?? '',
        phone: data.phone ?? '',
        website: data.website ?? '',
        address: data.address ?? '',
        city: data.city ?? '',
        postalCode: data.postalCode ?? '',
        allowSchedulingConflicts: data.allowSchedulingConflicts ?? true,
      })
  }, [data, reset])

  const save = useMutation({
    mutationFn: async (v: CompanyValues) =>
      (
        await api.put<Company>('/company', {
          name: v.name.trim(),
          email: emptyToNull(v.email),
          phone: emptyToNull(v.phone),
          website: emptyToNull(v.website),
          address: emptyToNull(v.address),
          city: emptyToNull(v.city),
          postalCode: emptyToNull(v.postalCode),
          allowSchedulingConflicts: v.allowSchedulingConflicts,
        })
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company'] })
      toast.success('Company settings saved')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  if (isLoading) {
    return (
      <Card>
        <CardSkeleton lines={6} />
      </Card>
    )
  }
  if (isError) {
    return (
      <Card>
        <QueryError error={error} onRetry={() => refetch()} />
      </Card>
    )
  }

  return (
    <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Company profile</CardTitle>
          <CardDescription>Shown on reports and customer-facing documents.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField label="Company name" htmlFor="c-name" error={errors.name?.message} required className="md:col-span-2">
            <Input id="c-name" aria-invalid={!!errors.name} {...register('name')} />
          </FormField>
          <FormField label="Email" htmlFor="c-email" error={errors.email?.message}>
            <Input id="c-email" type="email" aria-invalid={!!errors.email} {...register('email')} />
          </FormField>
          <FormField label="Phone" htmlFor="c-phone">
            <Input id="c-phone" type="tel" {...register('phone')} />
          </FormField>
          <FormField label="Website" htmlFor="c-website" className="md:col-span-2">
            <Input id="c-website" placeholder="https://" {...register('website')} />
          </FormField>
          <FormField label="Address" htmlFor="c-address" className="md:col-span-2">
            <Input id="c-address" {...register('address')} />
          </FormField>
          <FormField label="City" htmlFor="c-city">
            <Input id="c-city" {...register('city')} />
          </FormField>
          <FormField label="Postal code" htmlFor="c-postal">
            <Input id="c-postal" {...register('postalCode')} />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scheduling</CardTitle>
          <CardDescription>Control how double-bookings are handled.</CardDescription>
        </CardHeader>
        <CardContent>
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" className="mt-0.5 size-4 rounded border-input accent-[var(--primary)]" {...register('allowSchedulingConflicts')} />
            <span>
              <span className="block text-sm font-medium">Allow overlapping appointments</span>
              <span className="block text-sm text-muted-foreground">
                When enabled, dispatchers can book a technician into overlapping slots and will see a warning. When disabled, conflicting bookings are
                rejected.
              </span>
            </span>
          </label>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" loading={save.isPending} disabled={!isDirty}>
          Save changes
        </Button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Team
// ---------------------------------------------------------------------------

const ROLES: Role[] = ['Owner', 'Dispatcher', 'Technician']

const userSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'Use at least 8 characters')
    .regex(/[A-Za-z]/, 'Include at least one letter')
    .regex(/\d/, 'Include at least one number'),
  role: z.enum(['Owner', 'Dispatcher', 'Technician']),
  specialty: z.string().max(100),
})
type UserValues = z.infer<typeof userSchema>

function CreateUserDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const qc = useQueryClient()
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<UserValues>({
    resolver: zodResolver(userSchema),
    defaultValues: { firstName: '', lastName: '', email: '', password: '', role: 'Technician', specialty: '' },
  })

  useEffect(() => {
    if (open) reset()
  }, [open, reset])

  const role = watch('role')

  const create = useMutation({
    mutationFn: async (v: UserValues) =>
      (
        await api.post<User>('/users', {
          firstName: v.firstName.trim(),
          lastName: v.lastName.trim(),
          email: v.email.trim(),
          password: v.password,
          role: v.role,
          roles: [v.role],
          specialty: v.role === 'Technician' ? emptyToNull(v.specialty) : null,
        })
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      qc.invalidateQueries({ queryKey: ['technicians'] })
      toast.success('Team member added')
      onOpenChange(false)
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add team member"
      description="They can sign in right away with the credentials you set."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button loading={create.isPending} onClick={handleSubmit((v) => create.mutate(v))}>
            Add member
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="First name" htmlFor="u-first" error={errors.firstName?.message} required>
          <Input id="u-first" aria-invalid={!!errors.firstName} {...register('firstName')} />
        </FormField>
        <FormField label="Last name" htmlFor="u-last" error={errors.lastName?.message} required>
          <Input id="u-last" aria-invalid={!!errors.lastName} {...register('lastName')} />
        </FormField>
        <FormField label="Email" htmlFor="u-email" error={errors.email?.message} required className="sm:col-span-2">
          <Input id="u-email" type="email" autoComplete="off" aria-invalid={!!errors.email} {...register('email')} />
        </FormField>
        <FormField label="Temporary password" htmlFor="u-password" error={errors.password?.message} required className="sm:col-span-2">
          <Input id="u-password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register('password')} />
        </FormField>
        <FormField label="Role" htmlFor="u-role" error={errors.role?.message} required>
          <Select id="u-role" {...register('role')}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </FormField>
        {role === 'Technician' && (
          <FormField label="Specialty" htmlFor="u-specialty">
            <Input id="u-specialty" placeholder="e.g. HVAC, Electrical" {...register('specialty')} />
          </FormField>
        )}
      </div>
    </Dialog>
  )
}

const ROLE_TONE: Record<Role, 'teal' | 'blue' | 'gray'> = { Owner: 'teal', Dispatcher: 'blue', Technician: 'gray' }

function TeamSettings() {
  const { user: me } = useAuth()
  const [open, setOpen] = useState(false)
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['users'],
    queryFn: () => fetchList<User>('/users'),
  })

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Team members</CardTitle>
          <CardDescription>Owners, dispatchers and technicians in your workspace.</CardDescription>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus /> Add member
        </Button>
      </CardHeader>
      <CardContent className="px-0 pb-0 pt-4">
        {isLoading ? (
          <TableSkeleton cols={4} rows={4} />
        ) : isError ? (
          <QueryError error={error} onRetry={() => refetch()} />
        ) : !data || data.length === 0 ? (
          <EmptyState icon={Users} title="No team members" description="Add technicians and dispatchers to start assigning work." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="hidden md:table-cell">Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((u) => {
                const roles = u.roles ?? []
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <p className="font-medium">
                        {fullName(u)}
                        {u.id === me?.id && <span className="ml-2 text-xs font-normal text-muted-foreground">(you)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground sm:hidden">{u.email}</p>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">{u.email}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {roles.map((r) => (
                          <Badge key={r} tone={ROLE_TONE[r] ?? 'gray'}>
                            {r}
                          </Badge>
                        ))}
                        {u.isActive === false && <Badge tone="red">Inactive</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">{formatDate(u.createdAt)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <CreateUserDialog open={open} onOpenChange={setOpen} />
    </Card>
  )
}

// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const [tab, setTab] = useState<'company' | 'team'>('company')
  return (
    <>
      <PageHeader title="Settings" description="Manage your company profile and team." />
      <div className="mb-5 inline-flex rounded-md border border-border bg-surface p-0.5" role="tablist">
        {(
          [
            ['company', 'Company', Building2],
            ['team', 'Team', Users],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              'inline-flex items-center gap-2 rounded-md px-5 py-2 text-sm font-medium',
              tab === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>
      {tab === 'company' ? <CompanySettings /> : <TeamSettings />}
    </>
  )
}
