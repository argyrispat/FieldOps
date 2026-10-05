import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  acknowledgeNecessaryOnly,
  loadCookiePreferences,
  type CookiePreferences,
} from './cookiePreferences'

/**
 * Lightweight consent banner.
 * FieldOps does not use analytics or advertising cookies — only necessary browser storage for auth.
 */
export function CookieConsentBanner() {
  const navigate = useNavigate()
  const [prefs, setPrefs] = useState<CookiePreferences | null>(null)

  useEffect(() => {
    setPrefs(loadCookiePreferences())
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<CookiePreferences>).detail
      if (detail) setPrefs(detail)
      else setPrefs(loadCookiePreferences())
    }
    window.addEventListener('fieldops:cookie-preferences', onChange)
    return () => window.removeEventListener('fieldops:cookie-preferences', onChange)
  }, [])

  if (!prefs || prefs.acknowledged) return null

  return (
    <div role="dialog" aria-label="Cookie notice" className="fixed inset-x-0 bottom-0 z-50 p-4 safe-bottom sm:p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 rounded-md border border-border bg-surface p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-5">
        <div className="min-w-0 flex-1 space-y-1.5 text-sm">
          <p className="font-semibold text-foreground">Cookies &amp; local storage</p>
          <p className="text-muted-foreground">
            We use necessary browser storage (JWT access and refresh tokens in localStorage) to provide authentication
            and core application functionality. We do not use analytics or advertising cookies.
          </p>
          <p className="text-xs text-muted-foreground">
            See the{' '}
            <Link to="/cookies" className="font-medium text-primary underline-offset-2 hover:underline">
              Cookie Policy
            </Link>{' '}
            for details.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <Button variant="secondary" size="sm" onClick={() => navigate('/cookie-settings')}>
            Cookie Settings
          </Button>
          <Button size="sm" onClick={() => setPrefs(acknowledgeNecessaryOnly())}>
            OK
          </Button>
        </div>
      </div>
    </div>
  )
}
