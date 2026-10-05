import type { Ref, TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { controlClass } from './input'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  ref?: Ref<HTMLTextAreaElement>
}

export function Textarea({ className, rows = 3, ref, ...props }: TextareaProps) {
  return <textarea ref={ref} rows={rows} className={cn(controlClass, 'min-h-20 py-2', className)} {...props} />
}
