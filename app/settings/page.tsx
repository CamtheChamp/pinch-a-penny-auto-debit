export default function SettingsPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">QuickBooks Online Settings</h1>
      <p className="text-gray-500 mb-8 text-sm">Connect to your QBO sandbox company to preview and test transaction posting.</p>

      <div className="space-y-6">
        <div className="bg-white border rounded-xl px-6 py-5">
          <h2 className="font-semibold mb-1">Connection Status</h2>
          <p className="text-sm text-gray-500 mb-4">No connection configured.</p>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-sm text-yellow-800">
            QBO OAuth 2.0 integration is stubbed. To complete setup:
            <ol className="list-decimal list-inside mt-2 space-y-1">
              <li>Create an app at <strong>developer.intuit.com</strong></li>
              <li>Set <code>QBO_CLIENT_ID</code>, <code>QBO_CLIENT_SECRET</code>, <code>QBO_REDIRECT_URI</code> in your environment</li>
              <li>Implement OAuth callback at <code>/api/qbo/callback</code></li>
              <li>Start with <strong>Sandbox</strong> environment only</li>
            </ol>
          </div>
        </div>

        <div className="bg-white border rounded-xl px-6 py-5">
          <h2 className="font-semibold mb-3">Environment</h2>
          <div className="flex gap-3">
            <button className="border-2 border-blue-500 bg-blue-50 text-blue-700 px-4 py-2 rounded-lg text-sm font-semibold">
              Sandbox (active)
            </button>
            <button disabled className="border border-gray-200 text-gray-400 px-4 py-2 rounded-lg text-sm cursor-not-allowed">
              Production (disabled)
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">Production posting is disabled until transaction type is confirmed with your bookkeeper.</p>
        </div>

        <div className="bg-white border rounded-xl px-6 py-5">
          <h2 className="font-semibold mb-3">Transaction Type</h2>
          <p className="text-sm text-gray-600 mb-3">
            The QBO transaction type for these debit reports has <strong>not yet been confirmed</strong>.
            Confirm with your bookkeeper which of the following applies:
          </p>
          <ul className="space-y-2 text-sm">
            {['Journal Entry', 'Expense / Purchase', 'Check', 'Match existing bank-feed transaction only'].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <input type="radio" disabled name="txtype" className="accent-blue-600" />
                <span className="text-gray-700">{t}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-400 mt-3">Locked until bookkeeper confirms. Update and re-enable production posting in code once decided.</p>
        </div>

        <div className="bg-white border rounded-xl px-6 py-5">
          <h2 className="font-semibold mb-1">TODO — Production Checklist</h2>
          <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside mt-2">
            <li>Confirm transaction type with bookkeeper</li>
            <li>Implement QBO OAuth 2.0 callback + token refresh</li>
            <li>Implement <code>POST /api/qbo/push/[id]</code> with sandbox guard</li>
            <li>Add <em>Push to QBO Sandbox</em> button on report review page</li>
            <li>Enable production flag only after end-to-end sandbox test</li>
            <li>Set up token storage encryption in <code>qbo_connections</code> table</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
