import { DemoNotice, LegalMeta, LegalSection, Placeholder, useDocumentTitle } from './LegalLayout'

export default function PrivacyPage() {
  useDocumentTitle('Privacy Policy')

  return (
    <article className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Privacy Policy</h1>
        <LegalMeta updated="October 2026" />
        <DemoNotice />
      </header>

      <LegalSection title="1. Who we are">
        <p>
          FieldOps is a field service management demonstration application (the “Application”). For a commercial
          deployment, the data controller would be identified as:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Organisation: <Placeholder>[Company Name]</Placeholder>
          </li>
          <li>
            Address: <Placeholder>[Company Address]</Placeholder>
          </li>
          <li>
            Contact: <Placeholder>[Contact Email]</Placeholder>
          </li>
        </ul>
        <p>
          This portfolio build is not operated as a commercial service and should not be used to process real customer
          personal data.
        </p>
      </LegalSection>

      <LegalSection title="2. What information is collected">
        <p>The Application processes only the data needed to demonstrate multi-tenant field service workflows.</p>

        <h3 className="pt-1 font-semibold text-foreground">Account information</h3>
        <ul className="list-disc space-y-1 pl-5">
          <li>Name (first and last)</li>
          <li>Email address</li>
          <li>Password (stored only as a one-way hash via ASP.NET Core Identity — never in plaintext)</li>
          <li>Optional phone number</li>
          <li>User role (Owner, Dispatcher, or Technician)</li>
          <li>Company association</li>
          <li>Account active flag and authentication security metadata (e.g. failed login lockout)</li>
        </ul>

        <h3 className="pt-1 font-semibold text-foreground">Company profile</h3>
        <ul className="list-disc space-y-1 pl-5">
          <li>Company name, email, phone, address, city, postal code, website</li>
          <li>Scheduling preference (whether overlapping appointments are allowed)</li>
        </ul>

        <h3 className="pt-1 font-semibold text-foreground">Application data</h3>
        <ul className="list-disc space-y-1 pl-5">
          <li>Customers (name, optional company name, email, phone, address, notes)</li>
          <li>Service locations (address details and notes)</li>
          <li>Jobs and appointments (titles, descriptions, schedule, status, costs, work performed)</li>
          <li>Technicians (specialty and notes, linked to a user account)</li>
          <li>Equipment (name, serial number, maintenance dates, notes)</li>
          <li>Materials / inventory records</li>
          <li>Job notes and uploaded job photos (images and optional captions)</li>
          <li>Refresh tokens (stored as hashes) used to renew signed-in sessions</li>
        </ul>

        <p>
          The Application does <strong>not</strong> intentionally collect government IDs, dates of birth, gender,
          precise GPS tracking, health data, or other special-category personal data.
        </p>
      </LegalSection>

      <LegalSection title="3. Why information is collected">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Authentication and security</strong> — verifying accounts, issuing JWTs, rotating refresh tokens,
            and enforcing lockout after failed logins
          </li>
          <li>
            <strong>Providing application functionality</strong> — managing customers, jobs, scheduling, inventory,
            equipment, notes, photos, and PDF service reports
          </li>
          <li>
            <strong>Authorisation and multi-tenancy</strong> — ensuring each company only sees its own data and that
            roles limit what users can do
          </li>
          <li>
            <strong>Demonstration</strong> — seeding fictional demo data so recruiters and reviewers can explore the
            product
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. How information is stored">
        <p>
          Application data is stored in a PostgreSQL database. Uploaded job photos are stored on the configured file
          storage path (local disk in the default demo). Passwords are hashed by ASP.NET Core Identity. Refresh tokens
          are hashed before persistence. Access tokens are short-lived JWTs signed with a server-side secret.
        </p>
        <p>
          On the browser, access and refresh tokens are kept in <code className="rounded bg-surface-muted px-1">localStorage</code>{' '}
          so the single-page app can call the API. See the Cookie Policy for how this relates to cookies and consent.
        </p>
      </LegalSection>

      <LegalSection title="5. Who can access the data">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Within a company (tenant)</strong> — Owners and Dispatchers can manage company operational data.
            Technicians can view and update jobs assigned to them (and related materials needed for those jobs).
          </li>
          <li>
            <strong>Across companies</strong> — tenant isolation is enforced server-side using the company identifier
            from the authenticated JWT and EF Core query filters. Changing an ID in a request must not expose another
            company’s records.
          </li>
          <li>
            <strong>Operators of this demo</strong> — whoever runs the local/Docker environment has access to that
            environment’s database and uploads. Do not load real personal data into a demo instance.
          </li>
        </ul>
        <p>There is no advertising, analytics, or third-party marketing network integrated into this demo.</p>
      </LegalSection>

      <LegalSection title="6. Data retention">
        <p>
          In this portfolio demo, data is retained for as long as the database and upload volume exist for that
          environment. Deleting a company account or wiping the database removes the associated records for that
          instance.
        </p>
        <p>
          A commercial deployment would define retention periods for accounts, jobs, photos, and logs, and document
          them here. Placeholder contact for retention requests:{' '}
          <Placeholder>[Contact Email]</Placeholder>.
        </p>
      </LegalSection>

      <LegalSection title="7. Security">
        <ul className="list-disc space-y-1 pl-5">
          <li>Passwords hashed with ASP.NET Core Identity (PBKDF2)</li>
          <li>JWT bearer authentication with issuer/audience validation</li>
          <li>Refresh token rotation with reuse detection</li>
          <li>Role-based authorisation policies on the API</li>
          <li>Server-side multi-tenant isolation</li>
          <li>Rate limiting on authentication endpoints</li>
          <li>Security response headers (see README)</li>
          <li>User-facing errors avoid leaking stack traces, connection strings, or tokens</li>
        </ul>
        <p>
          No system is perfectly secure. This demo is intended to illustrate fundamentals, not to certify production
          compliance.
        </p>
      </LegalSection>

      <LegalSection title="8. Your rights">
        <p>
          Under GDPR and similar laws, individuals may have rights of access, rectification, erasure, restriction,
          portability, and objection. Because this is a demo, there is no formal DSAR workflow. If you run a private
          instance with your own test data, you control that database directly.
        </p>
        <p>
          For a commercial product, rights requests would be handled by <Placeholder>[Company Name]</Placeholder> at{' '}
          <Placeholder>[Contact Email]</Placeholder>.
        </p>
      </LegalSection>

      <LegalSection title="9. International transfers">
        <p>
          The default Docker/local setup stores data on the machine where you run the stack. A commercial deployment
          would disclose hosting regions and transfer safeguards here.
        </p>
      </LegalSection>

      <LegalSection title="10. Children’s data">
        <p>The Application is aimed at business users and is not intended for children.</p>
      </LegalSection>

      <LegalSection title="11. Changes to this policy">
        <p>
          This demonstration policy may change as the portfolio project evolves. The “Last updated” date above will be
          revised when material changes are made. A commercial service would notify users of material changes through
          appropriate channels.
        </p>
      </LegalSection>

      <LegalSection title="12. Contact">
        <p>
          Demo / placeholder contact: <Placeholder>[Contact Email]</Placeholder>
          <br />
          Organisation: <Placeholder>[Company Name]</Placeholder>
          <br />
          Address: <Placeholder>[Company Address]</Placeholder>
        </p>
      </LegalSection>
    </article>
  )
}
