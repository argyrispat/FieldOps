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
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCustomerOptions, useLocations } from '@/features/lookups'
import { api, getErrorMessage } from '@/lib/api'
import { customerName, emptyToNull, fromDateInput, toDateInput } from '@/lib/utils'
import type { Equipment } from '@/types'

const schema = z.object({
  customerId: z.string().min(1, 'Choose a customer'),
  serviceLocationId: z.string(),
  name: z.string().trim().min(2, 'Name is required').max(150),
  type: z.string().max(100),
  manufacturer: z.string().max(100),
  model: z.string().max(100),
  serialNumber: z.string().max(100),
  installationDate: z.string(),
  warrantyExpiration: z.string(),
  lastMaintenanceDate: z.string(),
  nextMaintenanceDate: z.string(),
  notes: z.string().max(4000),
})
type FormValues = z.infer<typeof schema>

const blank: FormValues = {
  customerId: '',
  serviceLocationId: '',
  name: '',
  type: '',
  manufacturer: '',
  model: '',
  serialNumber: '',
  installationDate: '',
  warrantyExpiration: '',
  lastMaintenanceDate: '',
  nextMaintenanceDate: '',
  notes: '',
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  equipment?: Equipment | null
  defaultCustomerId?: string
  onSaved?: (saved: Equipment) => void
}

export function EquipmentFormDialog({ open, onOpenChange, equipment, defaultCustomerId, onSaved }: Props) {
  const qc = useQueryClient()
  const { data: customers = [] } = useCustomerOptions(open)
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: blank })

  useEffect(() => {
    if (!open) return
    reset(
      equipment
        ? {
            customerId: equipment.customerId,
            serviceLocationId: equipment.serviceLocationId ?? '',
            name: equipment.name,
            type: equipment.type ?? '',
            manufacturer: equipment.manufacturer ?? '',
            model: equipment.model ?? '',
            serialNumber: equipment.serialNumber ?? '',
            installationDate: toDateInput(equipment.installationDate),
            warrantyExpiration: toDateInput(equipment.warrantyExpiration),
            lastMaintenanceDate: toDateInput(equipment.lastMaintenanceDate),
            nextMaintenanceDate: toDateInput(equipment.nextMaintenanceDate),
            notes: equipment.notes ?? '',
          }
        : { ...blank, customerId: defaultCustomerId ?? '' },
    )
  }, [open, equipment, defaultCustomerId, reset])

  const customerId = watch('customerId')
  const { data: locations = [] } = useLocations(open ? customerId : undefined)

  const save = useMutation({
    mutationFn: async (v: FormValues) => {
      const body = {
        customerId: v.customerId,
        serviceLocationId: emptyToNull(v.serviceLocationId),
        name: v.name.trim(),
        type: emptyToNull(v.type),
        manufacturer: emptyToNull(v.manufacturer),
        model: emptyToNull(v.model),
        serialNumber: emptyToNull(v.serialNumber),
        installationDate: fromDateInput(v.installationDate),
        warrantyExpiration: fromDateInput(v.warrantyExpiration),
        lastMaintenanceDate: fromDateInput(v.lastMaintenanceDate),
        nextMaintenanceDate: fromDateInput(v.nextMaintenanceDate),
        notes: emptyToNull(v.notes),
      }
      return equipment
        ? (await api.put<Equipment>(`/equipment/${equipment.id}`, body)).data
        : (await api.post<Equipment>('/equipment', body)).data
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['equipment'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success(equipment ? 'Equipment updated' : 'Equipment added')
      onOpenChange(false)
      onSaved?.(saved)
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={equipment ? 'Edit equipment' : 'Add equipment'}
      className="sm:max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button loading={save.isPending} onClick={handleSubmit((v) => save.mutate(v))}>
            {equipment ? 'Save changes' : 'Add equipment'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Customer" htmlFor="eq-customer" error={errors.customerId?.message} required>
          <Select
            id="eq-customer"
            aria-invalid={!!errors.customerId}
            {...register('customerId', { onChange: () => setValue('serviceLocationId', '') })}
          >
            <option value="">Select a customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {customerName(c)}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Location" htmlFor="eq-location">
          <Select id="eq-location" disabled={!customerId} {...register('serviceLocationId')}>
            <option value="">{customerId ? 'Not specified' : 'Choose a customer first'}</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Name" htmlFor="eq-name" error={errors.name?.message} required className="sm:col-span-2">
          <Input id="eq-name" placeholder="e.g. Rooftop AC unit #2" aria-invalid={!!errors.name} {...register('name')} />
        </FormField>
        <FormField label="Type" htmlFor="eq-type">
          <Input id="eq-type" placeholder="HVAC, Boiler, Generator…" {...register('type')} />
        </FormField>
        <FormField label="Manufacturer" htmlFor="eq-manufacturer">
          <Input id="eq-manufacturer" {...register('manufacturer')} />
        </FormField>
        <FormField label="Model" htmlFor="eq-model">
          <Input id="eq-model" {...register('model')} />
        </FormField>
        <FormField label="Serial number" htmlFor="eq-serial">
          <Input id="eq-serial" {...register('serialNumber')} />
        </FormField>
        <FormField label="Installed" htmlFor="eq-installed">
          <Input id="eq-installed" type="date" {...register('installationDate')} />
        </FormField>
        <FormField label="Warranty expires" htmlFor="eq-warranty">
          <Input id="eq-warranty" type="date" {...register('warrantyExpiration')} />
        </FormField>
        <FormField label="Last maintenance" htmlFor="eq-last">
          <Input id="eq-last" type="date" {...register('lastMaintenanceDate')} />
        </FormField>
        <FormField label="Next maintenance due" htmlFor="eq-next">
          <Input id="eq-next" type="date" {...register('nextMaintenanceDate')} />
        </FormField>
        <FormField label="Notes" htmlFor="eq-notes" className="sm:col-span-2">
          <Textarea id="eq-notes" rows={3} {...register('notes')} />
        </FormField>
      </div>
    </Dialog>
  )
}
