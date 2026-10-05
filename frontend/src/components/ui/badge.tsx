import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export const badgeVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded border px-1.5 py-0.5 text-[11px] font-medium leading-none',
  {
    variants: {
      tone: {
        gray: 'border-[color:var(--badge-gray-border)] bg-[color:var(--badge-gray-bg)] text-[color:var(--badge-gray-fg)]',
        blue: 'border-[color:var(--badge-blue-border)] bg-[color:var(--badge-blue-bg)] text-[color:var(--badge-blue-fg)]',
        teal: 'border-[color:var(--badge-teal-border)] bg-[color:var(--badge-teal-bg)] text-[color:var(--badge-teal-fg)]',
        amber: 'border-[color:var(--badge-amber-border)] bg-[color:var(--badge-amber-bg)] text-[color:var(--badge-amber-fg)]',
        green: 'border-[color:var(--badge-green-border)] bg-[color:var(--badge-green-bg)] text-[color:var(--badge-green-fg)]',
        red: 'border-[color:var(--badge-red-border)] bg-[color:var(--badge-red-bg)] text-[color:var(--badge-red-fg)]',
        orange: 'border-[color:var(--badge-orange-border)] bg-[color:var(--badge-orange-bg)] text-[color:var(--badge-orange-fg)]',
        outline: 'border-border bg-transparent text-foreground',
      },
    },
    defaultVariants: { tone: 'gray' },
  },
)

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}
