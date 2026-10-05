import { useQuery } from '@tanstack/react-query'
import { ImageOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { downloadBlob } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { JobPhoto } from '@/types'

/** Photos are fetched through the authenticated API client, then displayed from an object URL. */
export function usePhotoUrl(photo: JobPhoto) {
  const path = photo.url ?? `/jobs/${photo.jobId}/photos/${photo.id}`
  const { data: blob, isLoading, isError } = useQuery({
    queryKey: ['photo', photo.id],
    queryFn: () => downloadBlob(path),
    staleTime: Infinity,
    gcTime: 10 * 60_000,
  })
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!blob) return setUrl(null)
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return { url, isLoading, isError }
}

export function PhotoImage({ photo, className }: { photo: JobPhoto; className?: string }) {
  const { url, isLoading, isError } = usePhotoUrl(photo)
  if (isLoading) return <Skeleton className={cn('size-full', className)} />
  if (isError || !url) {
    return (
      <div className={cn('flex size-full items-center justify-center bg-surface-muted text-muted-foreground', className)}>
        <ImageOff className="size-6" aria-label="Photo unavailable" />
      </div>
    )
  }
  return <img src={url} alt={photo.caption || photo.fileName} className={cn('size-full object-cover', className)} />
}
