import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { FormField } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getErrorMessage } from '@/lib/api'
import { AuthLayout } from './AuthLayout'
import { useAuth } from './AuthContext'

const schema = z
  .object({
    companyName: z.string().trim().min(2, 'Company name is required'),
    firstName: z.string().trim().min(1, 'First name is required'),
    lastName: z.string().trim().min(1, 'Last name is required'),
    email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
    password: z
      .string()
      .min(8, 'Use at least 8 characters')
      .regex(/[A-Za-z]/, 'Include at least one letter')
      .regex(/\d/, 'Include at least one number'),
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })
type FormValues = z.infer<typeof schema>

export default function RegisterPage() {
  const { register: registerAccount } = useAuth()
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { companyName: '', firstName: '', lastName: '', email: '', password: '', confirmPassword: '' },
  })

  const onSubmit = async ({ confirmPassword: _confirm, ...values }: FormValues) => {
    setFormError(null)
    try {
      await registerAccount(values)
      toast.success('Your workspace is ready')
      navigate('/', { replace: true })
    } catch (e) {
      setFormError(getErrorMessage(e, 'We could not create your account.'))
    }
  }

  return (
    <AuthLayout title="Create your workspace" subtitle="Set up your company and owner account in under a minute.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {formError && (
          <div role="alert" className="notice-danger rounded-md px-3 py-2.5 text-sm">
            {formError}
          </div>
        )}
        <FormField label="Company name" htmlFor="companyName" error={errors.companyName?.message} required>
          <Input id="companyName" autoComplete="organization" aria-invalid={!!errors.companyName} {...register('companyName')} />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="First name" htmlFor="firstName" error={errors.firstName?.message} required>
            <Input id="firstName" autoComplete="given-name" aria-invalid={!!errors.firstName} {...register('firstName')} />
          </FormField>
          <FormField label="Last name" htmlFor="lastName" error={errors.lastName?.message} required>
            <Input id="lastName" autoComplete="family-name" aria-invalid={!!errors.lastName} {...register('lastName')} />
          </FormField>
        </div>
        <FormField label="Work email" htmlFor="email" error={errors.email?.message} required>
          <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register('email')} />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Password" htmlFor="password" error={errors.password?.message} required>
            <Input id="password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register('password')} />
          </FormField>
          <FormField label="Confirm password" htmlFor="confirmPassword" error={errors.confirmPassword?.message} required>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.confirmPassword}
              {...register('confirmPassword')}
            />
          </FormField>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
