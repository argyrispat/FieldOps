import { useEffect, useState, type ReactNode } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { Logo } from '@/features/auth/AuthLayout'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { buttonVariants } from '@/components/ui/button'
import { ThemeToggle } from '@/features/theme/ThemeToggle'
import { cn } from '@/lib/utils'

/** Shared chrome for public legal / policy pages. */
export function LegalLayout({ children }: { children?: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background" data-theme-surface>
      <header className="border-b border-border bg-surface" data-theme-surface>
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" aria-label="FieldOps home">
            <Logo />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle size="sm" />
            <Link to="/login" className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}>
              Sign in
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        {children ?? <Outlet />}
        <SiteFooter variant="legal" />
      </main>
    </div>
  )
}

export function DemoNotice() {
  return (
    <aside className="notice rounded-md px-4 py-3 text-sm">
      <p className="font-medium">Portfolio / demo project</p>
      <p className="mt-1 opacity-90">
        This application is a portfolio/demo project and is not currently offered as a commercial service. The text on
        this page is a demonstration template and has not been reviewed by a lawyer.
      </p>
    </aside>
  )
}

export function Placeholder({ children }: { children: ReactNode }) {
  return <span className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">{children}</span>
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-foreground/90">{children}</div>
    </section>
  )
}

export function useDocumentTitle(title: string) {
  useEffect(() => {
    const previous = document.title
    document.title = `${title} - FieldOps`
    return () => {
      document.title = previous
    }
  }, [title])
}

/** Small helper so legal pages share last-updated wording without inventing a company. */
export function LegalMeta({ updated }: { updated: string }) {
  const [year] = useState(() => new Date().getFullYear())
  return (
    <p className="text-xs text-muted-foreground">
      Last updated: {updated} · © {year} Demo Project · Placeholders:{' '}
      <Placeholder>[Company Name]</Placeholder>, <Placeholder>[Company Address]</Placeholder>,{' '}
      <Placeholder>[Contact Email]</Placeholder>
    </p>
  )
}
