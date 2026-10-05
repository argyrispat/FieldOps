import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { FormField } from '@/components/FormField'
import { PageHeader } from '@/components/PageHeader'
import { QueryError } from '@/components/QueryError'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { CardSkeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { api, getErrorMessage } from '@/lib/api'
import { emptyToNull } from '@/lib/utils'
import type { Customer } from '@/types'

const schema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  lastName: z.string().trim().min(1, 'Last name is required').max(100),
  companyName: z.string().max(150),
  email: z
    .string()
    .refine((v) => v.trim() === '' || z.string().email().safeParse(v.trim()).success, 'Enter a valid email address'),
  phone: z.string().max(40),
  address: z.string().max(200),
  city: z.string().max(100),
  postalCode: z.string().max(20),
  notes: z.string().max(4000),
})
type FormValues = z.infer<typeof schema>

function CustomerForm({ customer }: { customer?: Customer }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: customer?.firstName ?? '',
      lastName: customer?.lastName ?? '',
      companyName: customer?.companyName ?? '',
      email: customer?.email ?? '',
      phone: customer?.phone ?? '',
      address: customer?.address ?? '',
      city: customer?.city ?? '',
      postalCode: customer?.postalCode ?? '',
      notes: customer?.notes ?? '',
    },
  })

  const save = useMutation({
    mutationFn: async (v: FormValues) => {
      const body = {
        firstName: v.firstName.trim(),
        lastName: v.lastName.trim(),
        companyName: emptyToNull(v.companyName),
        email: emptyToNull(v.email),
        phone: emptyToNull(v.phone),
        address: emptyToNull(v.address),
        city: emptyToNull(v.city),
        postalCode: emptyToNull(v.postalCode),
        notes: emptyToNull(v.notes),
      }
      return customer
        ? (await api.put<Customer>(`/customers/${customer.id}`, body)).data
        : (await api.post<Customer>('/customers', body)).data
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['customers'] })
      qc.invalidateQueries({ queryKey: ['customer'] })
      toast.success(customer ? 'Customer updated' : 'Customer created')
      navigate(saved?.id ? `/customers/${saved.id}` : (customer ? `/customers/${customer.id}` : '/customers'))
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Contact</CardTitle>
          <CardDescription>Who we’re servicing and how to reach them.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField label="First name" htmlFor="firstName" error={errors.firstName?.message} required>
            <Input id="firstName" autoComplete="off" aria-invalid={!!errors.firstName} {...register('firstName')} />
          </FormField>
          <FormField label="Last name" htmlFor="lastName" error={errors.lastName?.message} required>
            <Input id="lastName" autoComplete="off" aria-invalid={!!errors.lastName} {...register('lastName')} />
          </FormField>
          <FormField label="Company" htmlFor="companyName" hint="Shown as the customer name when set." className="md:col-span-2">
            <Input id="companyName" {...register('companyName')} />
          </FormField>
          <FormField label="Email" htmlFor="email" error={errors.email?.message}>
            <Input id="email" type="email" aria-invalid={!!errors.email} {...register('email')} />
          </FormField>
          <FormField label="Phone" htmlFor="phone" error={errors.phone?.message}>
            <Input id="phone" type="tel" {...register('phone')} />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Billing address</CardTitle>
          <CardDescription>Service locations are managed on the customer page after saving.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField label="Address" htmlFor="address" className="md:col-span-2">
            <Input id="address" autoComplete="off" {...register('address')} />
          </FormField>
          <FormField label="City" htmlFor="city">
            <Input id="city" {...register('city')} />
          </FormField>
          <FormField label="Postal code" htmlFor="postalCode">
            <Input id="postalCode" {...register('postalCode')} />
          </FormField>
          <FormField label="Notes" htmlFor="notes" className="md:col-span-2">
            <Textarea id="notes" rows={3} {...register('notes')} />
          </FormField>
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link to={customer ? `/customers/${customer.id}` : '/customers'} className={buttonVariants({ variant: 'secondary' })}>
          Cancel
        </Link>
        <Button type="submit" loading={save.isPending}>
          {customer ? 'Save changes' : 'Create customer'}
        </Button>
      </div>
    </form>
  )
}

export default function CustomerFormPage() {
  const { id } = useParams()
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['customer', id],
    queryFn: async () => (await api.get<Customer>(`/customers/${id}`)).data,
    enabled: Boolean(id),
  })

  return (
    <>
      <PageHeader
        title={id ? 'Edit customer' : 'New customer'}
        backTo={id ? { to: `/customers/${id}`, label: 'Back to customer' } : { to: '/customers', label: 'Customers' }}
      />
      {id && isLoading ? (
        <Card>
          <CardSkeleton lines={6} />
        </Card>
      ) : id && (isError || !data) ? (
        <Card>
          <QueryError error={error} onRetry={() => refetch()} />
        </Card>
      ) : (
        <CustomerForm customer={data} />
      )}
    </>
  )
}
