export default function EulaPage() {
  return (
    <div className="max-w-2xl mx-auto prose">
      <h1 className="text-2xl font-bold mb-4">End-User License Agreement</h1>
      <p className="text-sm text-gray-500 mb-6">Last updated: June 28, 2026</p>

      <p>
        This application ("PennyWise Ledger," "we," "us," or "our") is a private, invite-only
        tool for processing preauthorized debit PDF reports and preparing QuickBooks Online
        journal entries. Each authorized account operates independently: your uploads,
        accounting rules, settings, and QuickBooks connection are visible only to you and
        are not shared with any other account.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">1. License</h2>
      <p>
        Access is limited to accounts explicitly authorized by the operator and is granted
        via Google sign-in. No license is granted to any third party, and accounts may not
        be shared or transferred without the operator's consent.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">2. QuickBooks Integration</h2>
      <p>
        Each account connects its own QuickBooks Online company directly, via Intuit's OAuth
        flow, solely to prepare and submit that account's journal entries. We do not access
        or have visibility into another account's QuickBooks connection or data.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">3. Disclaimer</h2>
      <p>
        This tool is provided as-is for accounting workflow automation. Each account holder
        is responsible for reviewing all proposed journal entries before submitting them to
        QuickBooks.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">4. Contact</h2>
      <p>
        For questions about this application, contact{' '}
        <a href="mailto:pcameronwhite@gmail.com" className="text-blue-600 underline">
          pcameronwhite@gmail.com
        </a>
        .
      </p>
    </div>
  )
}
