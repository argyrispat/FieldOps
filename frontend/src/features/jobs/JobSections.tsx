import { Boxes, Camera, MessageSquarePlus, NotebookPen, Plus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatBytes, formatCurrency, formatDateTime, formatNumber, timeAgo } from '@/lib/utils'
import type { Job } from '@/types'
import { AddMaterialDialog, AddNoteDialog, UploadPhotoDialog } from './dialogs'
import { PhotoImage } from './PhotoImage'

interface SectionProps {
  job: Job
  canEdit: boolean
}

export function NotesSection({ job, canEdit }: SectionProps) {
  const [open, setOpen] = useState(false)
  const notes = [...(job.notes ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Notes</CardTitle>
        {canEdit && (
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
            <Plus /> Add note
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {notes.length === 0 ? (
          <EmptyState
            icon={NotebookPen}
            title="No notes yet"
            description="Record findings, customer requests or hand-off details."
            className="py-6"
            action={
              canEdit && (
                <Button size="sm" onClick={() => setOpen(true)}>
                  <MessageSquarePlus /> Add the first note
                </Button>
              )
            }
          />
        ) : (
          <ul className="space-y-4">
            {notes.map((n) => (
              <li key={n.id} className="rounded-md bg-surface-muted/70 px-4 py-3">
                <p className="whitespace-pre-wrap text-sm">{n.text}</p>
                <p className="mt-2 text-xs text-muted-foreground" title={formatDateTime(n.createdAt)}>
                  {n.authorName ?? 'Team member'} · {timeAgo(n.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <AddNoteDialog jobId={job.id} open={open} onOpenChange={setOpen} />
    </Card>
  )
}

export function MaterialsSection({ job, canEdit }: SectionProps) {
  const [open, setOpen] = useState(false)
  const items = job.materials ?? []
  const total = items.reduce((sum, m) => sum + m.quantity * m.unitCost, 0)
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Materials used</CardTitle>
        {canEdit && (
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
            <Plus /> Add material
          </Button>
        )}
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {items.length === 0 ? (
          <EmptyState icon={Boxes} title="No materials recorded" description="Parts and consumables used on this job appear here." className="py-6" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Material</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit cost</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.materialName}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(m.quantity)} {m.unit}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(m.unitCost)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatCurrency(m.quantity * m.unitCost)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-surface-muted/60 hover:bg-surface-muted/60">
                <TableCell colSpan={3} className="text-right text-sm font-medium">
                  Materials total
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(total)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </CardContent>
      <AddMaterialDialog jobId={job.id} open={open} onOpenChange={setOpen} />
    </Card>
  )
}

export function PhotosSection({ job, canEdit }: SectionProps) {
  const [open, setOpen] = useState(false)
  const [viewing, setViewing] = useState<string | null>(null)
  const photos = job.photos ?? []
  const current = photos.find((p) => p.id === viewing)
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Photos</CardTitle>
        {canEdit && (
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
            <Camera /> Add photo
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {photos.length === 0 ? (
          <EmptyState icon={Camera} title="No photos yet" description="Before/after shots and site conditions help with reporting." className="py-6" />
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setViewing(p.id)}
                  className="group block w-full overflow-hidden rounded-md border border-border text-left"
                >
                  <div className="aspect-square overflow-hidden bg-surface-muted">
                    <PhotoImage photo={p} className="transition-transform group-hover:scale-105" />
                  </div>
                  {(p.caption || p.uploadedByName) && (
                    <p className="truncate px-2 py-1.5 text-xs text-muted-foreground">{p.caption || p.uploadedByName}</p>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <UploadPhotoDialog jobId={job.id} open={open} onOpenChange={setOpen} />
      <Dialog
        open={Boolean(current)}
        onOpenChange={(o) => !o && setViewing(null)}
        title={current?.caption || current?.fileName || 'Photo'}
        description={current ? `${formatDateTime(current.createdAt)} ${formatBytes(current.sizeBytes) && `· ${formatBytes(current.sizeBytes)}`}` : undefined}
        className="sm:max-w-3xl"
      >
        {current && (
          <div className="flex max-h-[70dvh] justify-center overflow-hidden rounded-md bg-surface-muted">
            <PhotoImage photo={current} className="size-auto max-h-[70dvh] max-w-full object-contain" />
          </div>
        )}
      </Dialog>
    </Card>
  )
}
