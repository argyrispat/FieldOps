import { Link } from 'react-router-dom'
import { Logo } from '@/features/auth/AuthLayout'

const FOOTER_LINKS = [
  { to: '/privacy', label: 'Privacy Policy' },
  { to: '/cookies', label: 'Cookie Policy' },
  { to: '/terms', label: 'Terms of Service' },
  { to: '/cookie-settings', label: 'Cookie Settings' },
] as const

/** Compact legal footer used on authenticated and public surfaces. */
export function SiteFooter({ variant = 'default' }: { variant?: 'default' | 'auth' | 'legal' }) {
  const year = new Date().getFullYear()
  const muted = variant === 'auth' ? 'text-white/50' : 'text-muted-foreground'
  const linkClass =
    variant === 'auth'
      ? 'text-white/70 hover:text-white underline-offset-2 hover:underline'
      : 'text-muted-foreground hover:text-foreground underline-offset-2 hover:underline'

  return (
    <footer
      className={
        variant === 'auth'
          ? 'relative border-t border-white/10 pt-6'
          : 'mt-10 border-t border-border pt-6 pb-2'
      }
      aria-label="Site"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {variant === 'legal' ? (
            <Logo />
          ) : variant === 'default' ? (
            <p className="text-sm font-semibold tracking-tight">FieldOps</p>
          ) : null}
          <p className={`mt-1 text-xs ${muted}`}>© {year} Demo Project</p>
          <p className={`mt-0.5 text-xs ${muted}`}>Portfolio / demonstration application — not a commercial service.</p>
        </div>
        <nav className="flex flex-wrap gap-x-4 gap-y-2 text-xs" aria-label="Legal">
          {FOOTER_LINKS.map((link) => (
            <Link key={link.to} to={link.to} className={linkClass}>
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  )
}
