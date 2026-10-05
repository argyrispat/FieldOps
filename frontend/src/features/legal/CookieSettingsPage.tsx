import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DemoNotice, useDocumentTitle } from './LegalLayout'
import {
  acknowledgeNecessaryOnly,
  loadCookiePreferences,
  saveCookiePreferences,
  type CookiePreferences,
} from './cookiePreferences'

function CategoryRow({
  name,
  description,
  status,
  control,
}: {
  name: string
  description: string
  status: string
  control?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <p className="font-medium text-foreground">{name}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="text-sm font-medium text-foreground">{status}</span>
        {control}
      </div>
    </div>
  )
}

export default function CookieSettingsPage() {
  useDocumentTitle('Cookie Settings')
  const [prefs, setPrefs] = useState<CookiePreferences>(() => loadCookiePreferences())

  useEffect(() => {
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<CookiePreferences>).detail
      if (detail) setPrefs(detail)
    }
    window.addEventListener('fieldops:cookie-preferences', onChange)
    return () => window.removeEventListener('fieldops:cookie-preferences', onChange)
  }, [])

  const save = () => {
    const next = saveCookiePreferences({ acknowledged: true, analytics: false, marketing: false })
    setPrefs(next)
    toast.success('Preferences saved')
  }

  return (
    <article className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Cookie Preferences</h1>
        <p className="text-sm text-muted-foreground">
          Review which categories are active. Optional analytics and marketing are not implemented in this demo, so
          those toggles stay disabled.
        </p>
        <DemoNotice />
      </header>

      <div className="rounded-md border border-border bg-surface px-4 sm:px-5">
        <CategoryRow
          name="Necessary"
          description="JWT tokens and related local storage required for sign-in and core application functionality. Always active."
          status="Always active"
        />
        <CategoryRow
          name="Analytics"
          description="Not currently used. No analytics cookies or third-party analytics scripts are loaded."
          status="Disabled"
          control={
            <input
              type="checkbox"
              className="size-4 rounded border-input"
              checked={false}
              disabled
              aria-label="Analytics cookies (not available)"
            />
          }
        />
        <CategoryRow
          name="Marketing"
          description="Not currently used. No advertising or marketing cookies are loaded."
          status="Disabled"
          control={
            <input
              type="checkbox"
              className="size-4 rounded border-input"
              checked={false}
              disabled
              aria-label="Marketing cookies (not available)"
            />
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save}>Save Preferences</Button>
        {!prefs.acknowledged && (
          <Button
            variant="secondary"
            onClick={() => {
              setPrefs(acknowledgeNecessaryOnly())
              toast.success('Necessary storage acknowledged')
            }}
          >
            Accept necessary only
          </Button>
        )}
        <Link to="/cookies" className="text-sm font-medium text-primary underline-offset-2 hover:underline">
          Read Cookie Policy
        </Link>
      </div>

      {prefs.updatedAt && (
        <p className="text-xs text-muted-foreground">
          Last saved: {new Date(prefs.updatedAt).toLocaleString()}
          {prefs.acknowledged ? ' · Notice acknowledged' : ''}
        </p>
      )}
    </article>
  )
}
