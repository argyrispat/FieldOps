import { zodResolver } from '@hookform/resolvers/zod'
import { ImagePlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { FormField } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useMaterialOptions } from '@/features/lookups'
import { formatNumber } from '@/lib/utils'
import type { Job } from '@/types'
import { useAddMaterial, useAddNote, useJobAction, useUploadPhoto } from './hooks'

interface BaseProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const optionalMoney = z
  .string()
  .refine((v) => v.trim() === '' || (!Number.isNaN(Number(v)) && Number(v) >= 0), 'Enter a valid amount')

// ---------------------------------------------------------------------------
// Note
// ---------------------------------------------------------------------------

const noteSchema = z.object({ text: z.string().trim().min(1, 'Write a note first').max(2000, 'Keep notes under 2,000 characters') })
type NoteValues = z.infer<typeof noteSchema>

export function AddNoteDialog({ jobId, open, onOpenChange }: BaseProps & { jobId: string }) {
  const add = useAddNote(jobId)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<NoteValues>({ resolver: zodResolver(noteSchema), defaultValues: { text: '' } })

  useEffect(() => {
    if (open) reset({ text: '' })
  }, [open, reset])

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add note"
      description="Visible to everyone working on this job."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            loading={add.isPending}
            onClick={handleSubmit((v) => add.mutate(v.text, { onSuccess: () => onOpenChange(false) }))}
          >
            Save note
          </Button>
        </>
      }
    >
      <FormField label="Note" htmlFor="note-text" error={errors.text?.message}>
        <Textarea id="note-text" rows={5} autoFocus aria-invalid={!!errors.text} {...register('text')} />
      </FormField>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Material
// ---------------------------------------------------------------------------

const materialSchema = z.object({
  materialId: z.string().min(1, 'Choose a material'),
  quantity: z
    .string()
    .min(1, 'Enter a quantity')
    .refine((v) => Number(v) > 0, 'Quantity must be greater than zero'),
})
type MaterialValues = z.infer<typeof materialSchema>

export function AddMaterialDialog({ jobId, open, onOpenChange }: BaseProps & { jobId: string }) {
  const { data: materials = [], isLoading } = useMaterialOptions(open)
  const add = useAddMaterial(jobId)
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<MaterialValues>({ resolver: zodResolver(materialSchema), defaultValues: { materialId: '', quantity: '1' } })

  useEffect(() => {
    if (open) reset({ materialId: '', quantity: '1' })
  }, [open, reset])

  const selected = materials.find((m) => m.id === watch('materialId'))

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Record material used"
      description="Stock levels are reduced automatically."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            loading={add.isPending}
            onClick={handleSubmit((v) =>
              add.mutate({ materialId: v.materialId, quantity: Number(v.quantity) }, { onSuccess: () => onOpenChange(false) }),
            )}
          >
            Add material
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Material" htmlFor="material-id" error={errors.materialId?.message}>
          <Select id="material-id" aria-invalid={!!errors.materialId} disabled={isLoading} {...register('materialId')}>
            <option value="">{isLoading ? 'Loading materials…' : 'Select a material'}</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({formatNumber(m.quantityOnHand)} {m.unit} in stock)
              </option>
            ))}
          </Select>
        </FormField>
        <FormField
          label={`Quantity${selected ? ` (${selected.unit})` : ''}`}
          htmlFor="material-qty"
          error={errors.quantity?.message}
        >
          <Input id="material-qty" type="number" inputMode="decimal" step="any" min="0" aria-invalid={!!errors.quantity} {...register('quantity')} />
        </FormField>
        {selected && selected.isLowStock !== false && selected.quantityOnHand <= selected.minimumQuantity && (
          <p className="notice rounded-md px-3 py-2 text-xs">
            {selected.name} is already at or below its minimum stock level.
          </p>
        )}
      </div>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Photo
// ---------------------------------------------------------------------------

const MAX_PHOTO_BYTES = 5 * 1024 * 1024

export function UploadPhotoDialog({ jobId, open, onOpenChange }: BaseProps & { jobId: string }) {
  const upload = useUploadPhoto(jobId)
  const [file, setFile] = useState<File | null>(null)
  const [caption, setCaption] = useState('')
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setFile(null)
      setCaption('')
    }
  }, [open])

  useEffect(() => {
    if (!file) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const onPick = (f: File | null) => {
    if (!f) return setFile(null)
    if (!f.type.startsWith('image/')) return void toast.error('Please choose an image file.')
    if (f.size > MAX_PHOTO_BYTES) return void toast.error('Photos must be 5 MB or smaller.')
    setFile(f)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Upload photo"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!file}
            loading={upload.isPending}
            onClick={() => file && upload.mutate({ file, caption: caption.trim() || undefined }, { onSuccess: () => onOpenChange(false) })}
          >
            Upload
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <label
          htmlFor="photo-file"
          className="flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-input bg-surface-muted/40 p-4 text-center hover:border-primary/50"
        >
          {preview ? (
            <img src={preview} alt="Selected upload preview" className="max-h-56 rounded-md object-contain" />
          ) : (
            <>
              <ImagePlus className="size-8 text-muted-foreground" aria-hidden />
              <span className="text-sm font-medium">Tap to take or choose a photo</span>
              <span className="text-xs text-muted-foreground">JPG, PNG or WebP · up to 5 MB</span>
            </>
          )}
          <input
            id="photo-file"
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => onPick(e.target.files?.[0] ?? null)}
          />
        </label>
        <FormField label="Caption (optional)" htmlFor="photo-caption">
          <Input id="photo-caption" value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={200} />
        </FormField>
      </div>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Complete
// ---------------------------------------------------------------------------

const completeSchema = z.object({
  workPerformed: z.string().trim().min(3, 'Describe the work performed'),
  laborCost: optionalMoney,
  materialsCost: optionalMoney,
})
type CompleteValues = z.infer<typeof completeSchema>

export function CompleteJobDialog({ job, open, onOpenChange, showCosts = true }: BaseProps & { job: Job; showCosts?: boolean }) {
  const action = useJobAction(job.id)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CompleteValues>({
    resolver: zodResolver(completeSchema),
    defaultValues: { workPerformed: '', laborCost: '', materialsCost: '' },
  })

  useEffect(() => {
    if (open)
      reset({
        workPerformed: job.workPerformed ?? '',
        laborCost: job.laborCost != null ? String(job.laborCost) : '',
        materialsCost: '',
      })
  }, [open, job.workPerformed, job.laborCost, reset])

  const submit = handleSubmit((v) =>
    action.mutate(
      {
        action: 'complete',
        body: {
          workPerformed: v.workPerformed.trim(),
          laborCost: v.laborCost.trim() ? Number(v.laborCost) : null,
          materialsCost: v.materialsCost.trim() ? Number(v.materialsCost) : null,
        },
      },
      { onSuccess: () => onOpenChange(false) },
    ),
  )

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Complete ${job.jobNumber}`}
      description="Summarise what was done. This closes the job."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button loading={action.isPending} onClick={submit}>
            Mark as completed
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Work performed" htmlFor="work-performed" error={errors.workPerformed?.message} required>
          <Textarea id="work-performed" rows={5} aria-invalid={!!errors.workPerformed} {...register('workPerformed')} />
        </FormField>
        {showCosts && (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Labor cost" htmlFor="labor-cost" error={errors.laborCost?.message}>
              <Input id="labor-cost" type="number" inputMode="decimal" step="0.01" min="0" {...register('laborCost')} />
            </FormField>
            <FormField label="Extra materials cost" htmlFor="materials-cost" error={errors.materialsCost?.message} hint="Leave blank to use recorded materials">
              <Input id="materials-cost" type="number" inputMode="decimal" step="0.01" min="0" {...register('materialsCost')} />
            </FormField>
          </div>
        )}
      </div>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Hold / cancel (reason)
// ---------------------------------------------------------------------------

const reasonSchema = z.object({ reason: z.string().trim().min(3, 'Please provide a short reason') })
type ReasonValues = z.infer<typeof reasonSchema>

export function ReasonDialog({
  jobId,
  kind,
  open,
  onOpenChange,
}: BaseProps & { jobId: string; kind: 'hold' | 'cancel' }) {
  const action = useJobAction(jobId)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ReasonValues>({ resolver: zodResolver(reasonSchema), defaultValues: { reason: '' } })

  useEffect(() => {
    if (open) reset({ reason: '' })
  }, [open, reset])

  const isHold = kind === 'hold'
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isHold ? 'Put job on hold' : 'Cancel job'}
      description={isHold ? 'Tell the team why work is paused.' : 'Cancelled jobs can no longer be worked on.'}
      className="sm:max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Back
          </Button>
          <Button
            variant={isHold ? 'primary' : 'destructive'}
            loading={action.isPending}
            onClick={handleSubmit((v) =>
              action.mutate({ action: kind, body: { reason: v.reason.trim() } }, { onSuccess: () => onOpenChange(false) }),
            )}
          >
            {isHold ? 'Put on hold' : 'Cancel job'}
          </Button>
        </>
      }
    >
      <FormField label="Reason" htmlFor="job-reason" error={errors.reason?.message} required>
        <Textarea id="job-reason" rows={3} autoFocus aria-invalid={!!errors.reason} {...register('reason')} />
      </FormField>
    </Dialog>
  )
}
