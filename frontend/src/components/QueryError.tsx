import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getErrorMessage } from '@/lib/api'

export function QueryError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center" role="alert">
      <div className="flex size-10 items-center justify-center rounded-md bg-danger-bg text-destructive">
        <AlertCircle className="size-5" aria-hidden />
      </div>
      <div>
        <h3 className="text-sm font-semibold">Couldn’t load this data</h3>
        <p className="mt-1 text-sm text-muted-foreground">{getErrorMessage(error)}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}
