import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { FormField } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { api, getErrorMessage } from '@/lib/api'
import { emptyToNull } from '@/lib/utils'
import type { ServiceLocation } from '@/types'

const schema = z.object({
  name: z.string().trim().min(1, 'Give the location a name').max(100),
  address: z.string().trim().min(3, 'Address is required').max(200),
  city: z.string().max(100),
  postalCode: z.string().max(20),
  notes: z.string().max(2000),
  isPrimary: z.boolean(),
})
type FormValues = z.infer<typeof schema>

interface LocationDialogProps {
  customerId: string
  location?: ServiceLocation | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LocationDialog({ customerId, location, open, onOpenChange }: LocationDialogProps) {
  const qc = useQueryClient()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', address: '', city: '', postalCode: '', notes: '', isPrimary: false },
  })

  useEffect(() => {
    if (open)
      reset({
        name: location?.name ?? '',
        address: location?.address ?? '',
        city: location?.city ?? '',
        postalCode: location?.postalCode ?? '',
        notes: location?.notes ?? '',
        isPrimary: location?.isPrimary ?? false,
      })
  }, [open, location, reset])

  const save = useMutation({
    mutationFn: async (v: FormValues) => {
      const body = {
        name: v.name.trim(),
        address: v.address.trim(),
        city: emptyToNull(v.city),
        postalCode: emptyToNull(v.postalCode),
        notes: emptyToNull(v.notes),
        isPrimary: v.isPrimary,
      }
      return location
        ? (await api.put(`/customers/${customerId}/locations/${location.id}`, body)).data
        : (await api.post(`/customers/${customerId}/locations`, body)).data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers', customerId] })
      qc.invalidateQueries({ queryKey: ['customer', customerId] })
      toast.success(location ? 'Location updated' : 'Location added')
      onOpenChange(false)
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={location ? 'Edit service location' : 'Add service location'}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button loading={save.isPending} onClick={handleSubmit((v) => save.mutate(v))}>
            {location ? 'Save changes' : 'Add location'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Location name" htmlFor="loc-name" error={errors.name?.message} required>
          <Input id="loc-name" placeholder="e.g. Main office, Warehouse" aria-invalid={!!errors.name} {...register('name')} />
        </FormField>
        <FormField label="Address" htmlFor="loc-address" error={errors.address?.message} required>
          <Input id="loc-address" aria-invalid={!!errors.address} {...register('address')} />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="City" htmlFor="loc-city">
            <Input id="loc-city" {...register('city')} />
          </FormField>
          <FormField label="Postal code" htmlFor="loc-postal">
            <Input id="loc-postal" {...register('postalCode')} />
          </FormField>
        </div>
        <FormField label="Access notes" htmlFor="loc-notes" hint="Gate codes, parking, contact on site…">
          <Textarea id="loc-notes" rows={3} {...register('notes')} />
        </FormField>
        <label className="flex items-center gap-2.5 text-sm">
          <input type="checkbox" className="size-4 rounded border-input accent-[var(--primary)]" {...register('isPrimary')} />
          Primary location
        </label>
      </div>
    </Dialog>
  )
}
