import type { InputHTMLAttributes, Ref } from 'react'
import { cn } from '@/lib/utils'

export const controlClass =
  'flex w-full rounded-md border border-input bg-surface px-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70 aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/20'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  ref?: Ref<HTMLInputElement>
}

export function Input({ className, type = 'text', ref, ...props }: InputProps) {
  return <input ref={ref} type={type} className={cn(controlClass, 'h-9', className)} {...props} />
}
