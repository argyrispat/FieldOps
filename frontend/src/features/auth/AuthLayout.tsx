import { CalendarCheck, ClipboardList, Wrench } from 'lucide-react'
import type { ReactNode } from 'react'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { ThemeToggle } from '@/features/theme/ThemeToggle'

export function Logo({ light }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <Wrench className="size-4" aria-hidden />
      </div>
      <span
        className={
          light
            ? 'text-[0.95rem] font-semibold tracking-tight text-white'
            : 'text-[0.95rem] font-semibold tracking-tight text-foreground'
        }
      >
        FieldOps
      </span>
    </div>
  )
}

const POINTS = [
  { icon: CalendarCheck, text: 'Dispatch and schedule technicians with conflict detection' },
  { icon: ClipboardList, text: 'Capture notes, photos and materials right from the job site' },
  { icon: Wrench, text: 'Track equipment and never miss a maintenance window' },
]

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,22rem)_1fr] xl:grid-cols-[minmax(0,26rem)_1fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-sidebar-border bg-[#0f1a24] p-10 text-white lg:flex dark:bg-[#0c1016]">
        <div className="flex items-center justify-between">
          <Logo light />
        </div>
        <div className="relative max-w-sm">
          <h2 className="text-2xl font-semibold leading-snug tracking-tight">
            Run your field service operation from one place.
          </h2>
          <ul className="mt-8 space-y-3.5">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-white/65">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-white/10 text-teal-300">
                  <Icon className="size-3.5" aria-hidden />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <SiteFooter variant="auth" />
      </div>

      <div className="relative flex items-center justify-center bg-background px-5 py-10 sm:px-10">
        <div className="absolute right-4 top-4 sm:right-6 sm:top-5">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-[1.375rem]">{title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-7">{children}</div>
          <div className="mt-10 lg:hidden">
            <SiteFooter />
          </div>
        </div>
      </div>
    </div>
  )
}
