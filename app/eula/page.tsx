export default function EulaPage() {
  return (
    <div className="max-w-2xl mx-auto prose">
      <h1 className="text-2xl font-bold mb-4">End-User License Agreement</h1>
      <p className="text-sm text-gray-500 mb-6">Last updated: June 19, 2026</p>

      <p>
        This application ("Pinch A Penny Auto Debit Parser") is an internal business tool
        operated exclusively by Pinch A Penny Pool Patio &amp; Spa Store #144 ("we," "us," or "our")
        for the purpose of processing preauthorized debit PDF reports and preparing QuickBooks
        Online journal entries.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">1. License</h2>
      <p>
        This software is for internal use only. Access is restricted to authorized personnel
        of Store #144. No license is granted to any third party.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">2. QuickBooks Integration</h2>
      <p>
        This application connects to QuickBooks Online solely to prepare and submit journal
        entries on behalf of the business. No financial data is sold, shared, or disclosed
        to third parties.
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">3. Disclaimer</h2>
      <p>
        This tool is provided as-is for internal accounting workflow automation. The operator
        is responsible for reviewing all proposed journal entries before submission.
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
