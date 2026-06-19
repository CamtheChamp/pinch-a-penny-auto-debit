'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import AccountPicker, { type QboAccount } from '@/app/components/AccountPicker'

interface QboStatus {
  connected: boolean
  realmId?: string
  expiresAt?: string
  environment?: string
}

function SettingsInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<QboStatus | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const [accounts, setAccounts] = useState<QboAccount[]>([])
  const [bankAccount, setBankAccount] = useState<{ id: string | null; name: string | null }>({ id: null, name: null })
  const [savingBank, setSavingBank] = useState(false)

  const flash = searchParams.get('qbo')
  const reason = searchParams.get('reason')

  useEffect(() => {
    fetch('/api/qbo/status').then((r) => r.json()).then(setStatus)
    fetch('/api/settings').then((r) => r.json()).then((s) => {
      const ba = s.bank_account as { id: string; name: string } | undefined
      if (ba) setBankAccount({ id: ba.id, name: ba.name })
    })
    fetch('/api/qbo/accounts').then((r) => r.ok ? r.json() : []).then((a) => {
      if (Array.isArray(a)) setAccounts(a)
    })
  }, [flash])

  async function saveBankAccount(acct: { id: string; name: string } | null) {
    setSavingBank(true)
    setBankAccount(acct ?? { id: null, name: null })
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bank_account: acct }),
    })
    setSavingBank(false)
  }

  async function handleDisconnect() {
    if (!confirm('Disconnect QuickBooks? You will need to reconnect before pushing journal entries.')) return
    setDisconnecting(true)
    await fetch('/api/qbo/disconnect', { method: 'POST' })
    router.replace('/settings')
    setDisconnecting(false)
    setStatus({ connected: false })
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">QBO Settings</h1>

      {flash === 'connected' && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-3 text-sm">
          QuickBooks connected successfully.
        </div>
      )}
      {flash === 'error' && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          Connection failed{reason ? `: ${reason}` : ''}. Try again.
        </div>
      )}

      <div className="bg-white border rounded-xl p-6 space-y-4">
        <h2 className="font-semibold text-lg">QuickBooks Online</h2>

        {status === null ? (
          <p className="text-sm text-gray-400">Checking connection…</p>
        ) : status.connected ? (
          <>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" />
              <span className="text-sm font-medium text-green-700">Connected</span>
              {status.environment && (
                <span className="text-xs bg-gray-100 text-gray-500 rounded px-2 py-0.5 font-mono">
                  {status.environment}
                </span>
              )}
            </div>
            {status.realmId && (
              <p className="text-xs text-gray-500">Realm ID: {status.realmId}</p>
            )}
            {status.expiresAt && (
              <p className="text-xs text-gray-500">
                Token expires: {new Date(status.expiresAt).toLocaleString()}
              </p>
            )}
            <div className="flex gap-3 pt-2">
              <a
                href="/api/qbo/connect"
                className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Reconnect
              </a>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="text-sm border border-red-300 text-red-600 px-4 py-2 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                Disconnect
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-300" />
              <span className="text-sm text-gray-500">Not connected</span>
            </div>
            <a
              href="/api/qbo/connect"
              className="inline-block mt-2 text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Connect to QuickBooks
            </a>
          </>
        )}
      </div>

      <div className="bg-white border rounded-xl p-6 space-y-3">
        <h2 className="font-semibold text-lg">Bank / AP Account</h2>
        <p className="text-sm text-gray-500">
          The balancing line in every Journal Entry credits (or debits) this account for the net bank charge amount.
        </p>
        <div className="flex items-center gap-3">
          <AccountPicker
            value={bankAccount}
            accounts={accounts}
            onChange={saveBankAccount}
            placeholder={accounts.length ? 'Select bank or AP account…' : 'Connect QBO first'}
          />
          {savingBank && <span className="text-xs text-gray-400">Saving…</span>}
          {!savingBank && bankAccount.id && <span className="text-xs text-green-600">✓ Saved</span>}
        </div>
      </div>

      <div className="bg-white border rounded-xl p-6 space-y-2">
        <h2 className="font-semibold text-lg">Environment</h2>
        <p className="text-sm text-gray-500">
          Currently targeting <span className="font-mono font-medium">sandbox</span>.
          Production posting is disabled until sandbox testing is complete.
        </p>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsInner />
    </Suspense>
  )
}
