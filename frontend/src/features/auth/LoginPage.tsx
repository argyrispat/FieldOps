import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { FormField } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getErrorMessage } from '@/lib/api'
import { AuthLayout } from './AuthLayout'
import { homePathFor, useAuth } from './AuthContext'

const DEMO_EMAIL = 'admin@acme.example'
const DEMO_PASSWORD = 'Demo123!'

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})
type FormValues = z.infer<typeof schema>

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [formError, setFormError] = useState<string | null>(null)
  const from = (location.state as { from?: string } | null)?.from

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } })

  const onSubmit = async (values: FormValues) => {
    setFormError(null)
    try {
      const user = await login(values.email, values.password)
      toast.success(`Welcome back, ${user.firstName}`)
      const home = homePathFor(user)
      navigate(from && from !== '/login' && home === '/' ? from : home, { replace: true })
    } catch (e) {
      setFormError(getErrorMessage(e, 'Invalid email or password.'))
    }
  }

  const fillDemo = () => {
    setValue('email', DEMO_EMAIL, { shouldValidate: true })
    setValue('password', DEMO_PASSWORD, { shouldValidate: true })
  }

  return (
    <AuthLayout title="Sign in" subtitle="Welcome back. Enter your credentials to access your workspace.">
      <div className="notice-info mb-5 rounded-md px-3 py-2.5 text-sm">
        <p className="font-medium">Demo account</p>
        <dl className="mt-1.5 space-y-0.5 text-[0.8125rem]">
          <div className="flex flex-wrap gap-x-2">
            <dt className="opacity-80">Email</dt>
            <dd>
              <code className="font-mono">{DEMO_EMAIL}</code>
            </dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="opacity-80">Password</dt>
            <dd>
              <code className="font-mono">{DEMO_PASSWORD}</code>
            </dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={fillDemo}
          className="mt-2 text-[0.8125rem] font-medium underline-offset-2 hover:underline"
        >
          Fill demo credentials
        </button>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        {formError && (
          <div role="alert" className="notice-danger rounded-md px-3 py-2.5 text-sm">
            {formError}
          </div>
        )}
        <FormField label="Email" htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            aria-invalid={!!errors.email}
            {...register('email')}
          />
        </FormField>
        <FormField label="Password" htmlFor="password" error={errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            {...register('password')}
          />
        </FormField>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Sign in
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to FieldOps?{' '}
        <Link to="/register" className="font-medium text-primary hover:underline">
          Create a company account
        </Link>
      </p>
    </AuthLayout>
  )
}
