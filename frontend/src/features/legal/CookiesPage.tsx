import { Link } from 'react-router-dom'
import { DemoNotice, LegalMeta, LegalSection, Placeholder, useDocumentTitle } from './LegalLayout'

export default function CookiesPage() {
  useDocumentTitle('Cookie Policy')

  return (
    <article className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Cookie Policy</h1>
        <LegalMeta updated="October 2026" />
        <DemoNotice />
      </header>

      <LegalSection title="1. Overview">
        <p>
          This page explains how FieldOps uses cookies and similar technologies. It reflects what the Application
          actually implements today — not a generic template that invents tracking tools.
        </p>
      </LegalSection>

      <LegalSection title="2. What we use today">
        <h3 className="font-semibold text-foreground">HTTP cookies</h3>
        <p>
          The Application <strong>does not set authentication cookies, session cookies, analytics cookies, or
          advertising cookies</strong> in the browser. Sign-in uses JWT access and refresh tokens stored in{' '}
          <code className="rounded bg-surface-muted px-1">localStorage</code>, sent as{' '}
          <code className="rounded bg-surface-muted px-1">Authorization: Bearer</code> headers to the API.
        </p>

        <h3 className="pt-2 font-semibold text-foreground">Necessary local storage</h3>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <code className="rounded bg-surface-muted px-1">fieldops_access_token</code> — short-lived JWT for API
            calls
          </li>
          <li>
            <code className="rounded bg-surface-muted px-1">fieldops_refresh_token</code> — refresh credential (also
            hashed server-side)
          </li>
          <li>
            <code className="rounded bg-surface-muted px-1">fieldops_user</code> — cached profile for UI (name, role,
            company)
          </li>
          <li>
            <code className="rounded bg-surface-muted px-1">fieldops_cookie_consent</code> — records that you
            acknowledged this notice / preference page
          </li>
        </ul>
        <p>These items are required for authentication and core functionality of the single-page application.</p>
      </LegalSection>

      <LegalSection title="3. Cookie categories">
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Category</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border">
                <td className="px-3 py-3 align-top">
                  <p className="font-medium text-foreground">Necessary</p>
                  <p className="mt-1 text-muted-foreground">
                    Authentication tokens and related local storage required to sign in and use the Application.
                  </p>
                </td>
                <td className="px-3 py-3 align-top font-medium text-foreground">Always active</td>
              </tr>
              <tr className="border-t border-border">
                <td className="px-3 py-3 align-top">
                  <p className="font-medium text-foreground">Analytics cookies</p>
                  <p className="mt-1 text-muted-foreground">No analytics platform is integrated.</p>
                </td>
                <td className="px-3 py-3 align-top font-medium text-foreground">Not currently used</td>
              </tr>
              <tr className="border-t border-border">
                <td className="px-3 py-3 align-top">
                  <p className="font-medium text-foreground">Advertising / marketing cookies</p>
                  <p className="mt-1 text-muted-foreground">No advertising or marketing tags are integrated.</p>
                </td>
                <td className="px-3 py-3 align-top font-medium text-foreground">Not currently used</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Manage preferences on the{' '}
          <Link to="/cookie-settings" className="font-medium text-primary underline-offset-2 hover:underline">
            Cookie Settings
          </Link>{' '}
          page. Optional categories remain disabled until a real implementation is added.
        </p>
      </LegalSection>

      <LegalSection title="4. Third parties">
        <p>
          This demo does not load third-party analytics, advertising, or social widgets that would set their own
          cookies.
        </p>
      </LegalSection>

      <LegalSection title="5. How long data is kept">
        <p>
          Tokens remain in localStorage until you sign out, clear site data, or they expire and fail to refresh.
          Consent acknowledgment remains until you clear localStorage or change preferences.
        </p>
      </LegalSection>

      <LegalSection title="6. Contact">
        <p>
          Questions about this demonstration policy: <Placeholder>[Contact Email]</Placeholder> (
          <Placeholder>[Company Name]</Placeholder>, <Placeholder>[Company Address]</Placeholder>).
        </p>
      </LegalSection>
    </article>
  )
}
