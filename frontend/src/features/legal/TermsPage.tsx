import { DemoNotice, LegalMeta, LegalSection, Placeholder, useDocumentTitle } from './LegalLayout'

export default function TermsPage() {
  useDocumentTitle('Terms of Service')

  return (
    <article className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Terms of Service</h1>
        <LegalMeta updated="October 2026" />
        <DemoNotice />
      </header>

      <LegalSection title="1. Nature of the Application">
        <p>
          FieldOps is a portfolio / demonstration Field Service Management application. It is provided to showcase
          product and engineering work. It is <strong>not</strong> currently offered as a commercial SaaS product and
          must not be relied on for production business operations or real personal data processing.
        </p>
      </LegalSection>

      <LegalSection title="2. Acceptance">
        <p>
          By accessing or using a running instance of this demo, you acknowledge that these terms are a reasonable
          demonstration template only and are not a legally reviewed contract between you and{' '}
          <Placeholder>[Company Name]</Placeholder>.
        </p>
      </LegalSection>

      <LegalSection title="3. Accounts and demo data">
        <ul className="list-disc space-y-1 pl-5">
          <li>You are responsible for credentials you create on instances you control.</li>
          <li>
            Development seed data (for example Acme Services and demo@acme.example style accounts) is fictional and
            intended for exploration.
          </li>
          <li>Do not upload or enter real customer personal data into a public or shared demo environment.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Acceptable use">
        <p>When using this software you agree not to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Attempt to access another tenant’s data</li>
          <li>Probe, overload, or abuse authentication endpoints beyond normal testing</li>
          <li>Use the Application to store unlawful content</li>
          <li>Present this demo as a commercially supported product without appropriate legal and security review</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Intellectual property">
        <p>
          Unless otherwise noted in the repository licence (MIT), the FieldOps source code is available under the terms
          stated in the project README. Product name and branding in this demo are for portfolio presentation.
        </p>
      </LegalSection>

      <LegalSection title="6. Disclaimer of warranties">
        <p>
          THE APPLICATION IS PROVIDED “AS IS” AND “AS AVAILABLE”, WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR
          IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. This is a demo:
          availability, backups, and support are not guaranteed.
        </p>
      </LegalSection>

      <LegalSection title="7. Limitation of liability">
        <p>
          To the fullest extent permitted by applicable law, the authors and any placeholder organisation (
          <Placeholder>[Company Name]</Placeholder>) shall not be liable for any indirect, incidental, special,
          consequential, or exemplary damages arising from use of this demonstration software.
        </p>
      </LegalSection>

      <LegalSection title="8. Privacy">
        <p>
          Processing of personal data (if any) in an instance you run is described in the Privacy Policy. Prefer
          fictional data only.
        </p>
      </LegalSection>

      <LegalSection title="9. Changes">
        <p>
          These demonstration terms may be updated as the portfolio project evolves. The “Last updated” date will
          change when material edits are made.
        </p>
      </LegalSection>

      <LegalSection title="10. Contact">
        <p>
          <Placeholder>[Company Name]</Placeholder>
          <br />
          <Placeholder>[Company Address]</Placeholder>
          <br />
          <Placeholder>[Contact Email]</Placeholder>
        </p>
      </LegalSection>
    </article>
  )
}
