export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto prose">
      <h1 className="text-2xl font-bold mb-4">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-6">Last updated: June 19, 2026</p>

      <p>
        This Privacy Policy describes how Pinch A Penny Pool Patio &amp; Spa Store #144
        ("we," "us," or "our") handles information in connection with the PennyWise Ledger
        application.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">1. Information We Process</h2>
      <p>
        This application processes PDF reports containing customer account numbers, invoice
        dates, and payment amounts that are already part of our business records. No
        personally identifiable information beyond what appears in those reports is collected.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">2. QuickBooks Data</h2>
      <p>
        We access QuickBooks Online solely to create journal entries on behalf of our
        business. We do not store QuickBooks credentials; OAuth tokens are managed
        securely and used only for authorized accounting operations.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">3. Data Storage</h2>
      <p>
        Uploaded PDF text and parsed data are stored in a private Supabase (PostgreSQL)
        database accessible only to authorized personnel. Data is not shared with or
        sold to any third party.
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
