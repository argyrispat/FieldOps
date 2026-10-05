import { zodResolver } from '@hookform/resolvers/zod'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Boxes, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { FormField } from '@/components/FormField'
import { PageHeader } from '@/components/PageHeader'
import { Pagination } from '@/components/Pagination'
import { QueryError } from '@/components/QueryError'
import { SearchInput, useDebounced } from '@/components/SearchInput'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { TableSkeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { api, fetchPaged, getErrorMessage } from '@/lib/api'
import { cn, emptyToNull, formatCurrency, formatNumber } from '@/lib/utils'
import type { Material } from '@/types'

const num = (label: string) =>
  z
    .string()
    .min(1, `${label} is required`)
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, `${label} must be zero or more`)

const schema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(150),
  sku: z.string().max(60),
  description: z.string().max(1000),
  unit: z.string().trim().min(1, 'Unit is required').max(20),
  quantityOnHand: num('Quantity'),
  minimumQuantity: num('Minimum'),
  unitCost: num('Unit cost'),
})
type FormValues = z.infer<typeof schema>

const isLow = (m: Material) => m.isLowStock ?? m.quantityOnHand <= m.minimumQuantity

function MaterialDialog({
  open,
  onOpenChange,
  material,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  material: Material | null
}) {
  const qc = useQueryClient()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', sku: '', description: '', unit: 'ea', quantityOnHand: '0', minimumQuantity: '0', unitCost: '0' },
  })

  useEffect(() => {
    if (!open) return
    reset({
      name: material?.name ?? '',
      sku: material?.sku ?? '',
      description: material?.description ?? '',
      unit: material?.unit ?? 'ea',
      quantityOnHand: String(material?.quantityOnHand ?? 0),
      minimumQuantity: String(material?.minimumQuantity ?? 0),
      unitCost: String(material?.unitCost ?? 0),
    })
  }, [open, material, reset])

  const save = useMutation({
    mutationFn: async (v: FormValues) => {
      const body = {
        name: v.name.trim(),
        sku: emptyToNull(v.sku),
        description: emptyToNull(v.description),
        unit: v.unit.trim(),
        quantityOnHand: Number(v.quantityOnHand),
        minimumQuantity: Number(v.minimumQuantity),
        unitCost: Number(v.unitCost),
      }
      return material
        ? (await api.put<Material>(`/materials/${material.id}`, body)).data
        : (await api.post<Material>('/materials', body)).data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['materials'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success(material ? 'Material updated' : 'Material added')
      onOpenChange(false)
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={material ? 'Edit material' : 'Add material'}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button loading={save.isPending} onClick={handleSubmit((v) => save.mutate(v))}>
            {material ? 'Save changes' : 'Add material'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Name" htmlFor="m-name" error={errors.name?.message} required className="sm:col-span-2">
          <Input id="m-name" aria-invalid={!!errors.name} {...register('name')} />
        </FormField>
        <FormField label="SKU" htmlFor="m-sku">
          <Input id="m-sku" {...register('sku')} />
        </FormField>
        <FormField label="Unit" htmlFor="m-unit" error={errors.unit?.message} required hint="e.g. ea, m, kg, L">
          <Input id="m-unit" aria-invalid={!!errors.unit} {...register('unit')} />
        </FormField>
        <FormField label="Quantity on hand" htmlFor="m-qty" error={errors.quantityOnHand?.message} required>
          <Input id="m-qty" type="number" inputMode="decimal" step="any" min="0" aria-invalid={!!errors.quantityOnHand} {...register('quantityOnHand')} />
        </FormField>
        <FormField label="Minimum (low-stock alert)" htmlFor="m-min" error={errors.minimumQuantity?.message} required>
          <Input id="m-min" type="number" inputMode="decimal" step="any" min="0" aria-invalid={!!errors.minimumQuantity} {...register('minimumQuantity')} />
        </FormField>
        <FormField label="Unit cost" htmlFor="m-cost" error={errors.unitCost?.message} required className="sm:col-span-2">
          <Input id="m-cost" type="number" inputMode="decimal" step="0.01" min="0" aria-invalid={!!errors.unitCost} {...register('unitCost')} />
        </FormField>
        <FormField label="Description" htmlFor="m-desc" className="sm:col-span-2">
          <Textarea id="m-desc" rows={2} {...register('description')} />
        </FormField>
      </div>
    </Dialog>
  )
}

export default function InventoryPage() {
  const qc = useQueryClient()
  const [searchText, setSearchText] = useState('')
  const [lowOnly, setLowOnly] = useState(false)
  const [page, setPage] = useState(1)
  const search = useDebounced(searchText, 350)
  const [dialog, setDialog] = useState<{ open: boolean; material: Material | null }>({ open: false, material: null })
  const [toDelete, setToDelete] = useState<Material | null>(null)

  const { data, isLoading, isError, error, refetch, isPlaceholderData } = useQuery({
    queryKey: ['materials', 'list', { page, search, lowOnly }],
    queryFn: () =>
      fetchPaged<Material>('/materials', { page, pageSize: 20, search, sortBy: 'name', sortDir: 'asc', lowStock: lowOnly ? 'true' : '' }),
    placeholderData: keepPreviousData,
  })

  const remove = useMutation({
    mutationFn: async (m: Material) => api.delete(`/materials/${m.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['materials'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Material deleted')
      setToDelete(null)
    },
    onError: (e) => {
      setToDelete(null)
      toast.error(getErrorMessage(e))
    },
  })

  const items = (data?.items ?? []).filter((m) => !lowOnly || isLow(m))
  const lowCount = (data?.items ?? []).filter(isLow).length

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Materials and parts, with low-stock alerts."
        actions={
          <Button onClick={() => setDialog({ open: true, material: null })}>
            <Plus /> Add material
          </Button>
        }
      />
      <Card>
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
          <SearchInput
            value={searchText}
            onChange={(v) => {
              setSearchText(v)
              setPage(1)
            }}
            placeholder="Search by name or SKU…"
            className="flex-1 sm:max-w-md"
          />
          <button
            type="button"
            aria-pressed={lowOnly}
            onClick={() => {
              setLowOnly((v) => !v)
              setPage(1)
            }}
            className={cn(
              'inline-flex h-9 items-center gap-2 rounded-md border px-3.5 text-sm font-medium',
              lowOnly ? 'border-notice-border bg-notice-bg text-notice-fg' : 'border-border bg-surface hover:bg-surface-muted',
            )}
          >
            <AlertTriangle className="size-4" aria-hidden />
            Low stock only
            {!lowOnly && lowCount > 0 && <Badge tone="amber">{lowCount}</Badge>}
          </button>
        </div>

        {isLoading ? (
          <TableSkeleton cols={5} />
        ) : isError ? (
          <QueryError error={error} onRetry={() => refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title={search || lowOnly ? 'No materials found' : 'No materials yet'}
            description={
              lowOnly ? 'Nothing is running low — nice.' : search ? `Nothing matches “${search}”.` : 'Add parts and consumables to track stock and usage on jobs.'
            }
            action={
              !search &&
              !lowOnly && (
                <Button onClick={() => setDialog({ open: true, material: null })}>
                  <Plus /> Add material
                </Button>
              )
            }
          />
        ) : (
          <div className={cn(isPlaceholderData && 'opacity-60 transition-opacity')}>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Material</TableHead>
                  <TableHead className="hidden sm:table-cell">SKU</TableHead>
                  <TableHead className="text-right">In stock</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Minimum</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Unit cost</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <p className="font-medium">{m.name}</p>
                      {m.description && <p className="max-w-72 truncate text-xs text-muted-foreground">{m.description}</p>}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">{m.sku ?? '—'}</TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex items-center justify-end gap-2">
                        {isLow(m) && <Badge tone="amber">Low stock</Badge>}
                        <span className={cn('tabular-nums', isLow(m) && 'font-semibold text-warning')}>
                          {formatNumber(m.quantityOnHand)} {m.unit}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums text-muted-foreground md:table-cell">
                      {formatNumber(m.minimumQuantity)}
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums md:table-cell">{formatCurrency(m.unitCost)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" aria-label={`Edit ${m.name}`} onClick={() => setDialog({ open: true, material: m })}>
                          <Pencil />
                        </Button>
                        <Button size="icon" variant="ghost" aria-label={`Delete ${m.name}`} onClick={() => setToDelete(m)}>
                          <Trash2 className="text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {data && (
              <Pagination
                page={data.page}
                pageSize={data.pageSize}
                totalCount={data.totalCount}
                totalPages={data.totalPages}
                onPageChange={setPage}
              />
            )}
          </div>
        )}
      </Card>

      <MaterialDialog open={dialog.open} material={dialog.material} onOpenChange={(open) => setDialog((s) => ({ ...s, open }))} />
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete material?"
        description={`“${toDelete?.name}” will be removed from inventory. Materials already used on jobs may not be deletable.`}
        confirmLabel="Delete material"
        destructive
        loading={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete)}
      />
    </>
  )
}
