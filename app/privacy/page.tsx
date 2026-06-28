export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto prose">
      <h1 className="text-2xl font-bold mb-4">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-6">Last updated: June 28, 2026</p>

      <p>
        This Privacy Policy describes how PennyWise Ledger ("we," "us," or "our") handles
        information for each account using the application. PennyWise Ledger is multi-tenant:
        every account's data is isolated and accessible only to that account, enforced both
        in application code and via database-level row security.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">1. Information We Process</h2>
      <p>
        We process your Google account email (for sign-in and access authorization) and the
        PDF reports you upload, which contain customer account numbers, invoice dates, and
        payment amounts already part of your business records. No personally identifiable
        information beyond what appears in those reports or your Google profile is collected.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">2. QuickBooks Data</h2>
      <p>
        Each account connects its own QuickBooks Online company via Intuit's OAuth flow,
        solely to create that account's journal entries. OAuth tokens are stored securely,
        scoped to the connecting account, and used only for that account's authorized
        accounting operations — never accessible to any other account.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">3. Data Storage &amp; Isolation</h2>
      <p>
        Uploaded PDF text and parsed data are stored in a private Supabase (PostgreSQL)
        database. Each account's data is isolated by row-level security policies tied to
        your authenticated identity — no account can read or modify another account's data.
        Data is not shared with or sold to any third party.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">4. No Third-Party Sharing</h2>
      <p>
        We do not sell, rent, or share any data processed by this application with
        third parties for marketing or any other purpose.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">5. Contact</h2>
      <p>
        For questions about this privacy policy, contact{' '}
        <a href="mailto:pcameronwhite@gmail.com" className="text-blue-600 underline">
          pcameronwhite@gmail.com
        </a>
        .
      </p>
    </div>
  )
}
