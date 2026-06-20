'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import AccountPicker, { type QboAccount } from '@/app/components/AccountPicker'

interface Header {
  report_number: string
  run_date: string
  run_time: string
  customer_name: string
  page_number: number | null
}

interface LineItem {
  id: string
  sort_order: number
  remarks: string
  doc_type: string
  doc_number: string
  payment_term: string
  invoice_date: string | null
  due_date: string | null
  discount_due_date: string | null
  open_amount: number | null
  discount_available: number | null
  net_amount_due: number | null
  row_category: string
  is_carry_forward: boolean
  warnings: string[]
  treatment: string
  qbo_account_id: string | null
  qbo_account_name: string | null
  qbo_memo: string | null
}

interface CustomerTotal {
  open_amount: number | null
  discount_available: number | null
  net_amount_due: number | null
  open_amount_match: boolean | null
  discount_match: boolean | null
  net_amount_match: boolean | null
  open_amount_diff: number | null
  discount_diff: number | null
  net_amount_diff: number | null
}

interface Upload {
  id: string
  file_name: string
  uploaded_at: string
  status: string
  parse_errors: string[]
}

interface LinkedReport {
  id: string
  file_name: string
  run_date: string
  report_number?: string | null
}

interface ReportData {
  upload: Upload
  header: Header | null
  lineItems: LineItem[]
  customerTotal: CustomerTotal | null
  prerequisiteDate: string | null
  prerequisiteMet: boolean
  prerequisiteReport: LinkedReport | null
  prerequisiteChain: LinkedReport[]
  unresolvedPrerequisiteDate: string | null
  prerequisiteCycleDetected: boolean
  appliedToReport: LinkedReport | null   // set if this is a negative PDF absorbed into another JE
}

const TREATMENT_LABELS: Record<string, string> = {
  include: 'Include',
  carry_forward: 'Carry-Forward',
  ignore: 'Ignore',
}

const CATEGORY_COLORS: Record<string, string> = {
  sales_order: 'bg-blue-50 text-blue-700',
  rebate_credit: 'bg-green-50 text-green-700',
  carry_forward: 'bg-orange-50 text-orange-700',
  adv_ff_fee: 'bg-purple-50 text-purple-700',
  sales_return: 'bg-yellow-50 text-yellow-700',
  needs_review: 'bg-red-50 text-red-700',
}

function fmt(n: number | null): string {
  if (n === null) return '—'
  const s = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2 })
  return n < 0 ? `-$${s}` : `$${s}`
}

function JePreviewTable({ preview, fmt }: { preview: Record<string, unknown>; fmt: (n: number | null) => string }) {
  const lines = preview.Line as Array<Record<string, unknown>>
  const s = preview._summary as Record<string, unknown> | undefined

  const totals = lines.reduce<{ debits: number; credits: number }>((acc, line) => {
    const detail = line.JournalEntryLineDetail as Record<string, unknown>
    const amount = line.Amount as number
    if ((detail?.PostingType as string) === 'Debit') acc.debits += amount
    else acc.credits += amount
    return acc
  }, { debits: 0, credits: 0 })

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-gray-50 px-4 py-3 border-b flex items-center justify-between text-sm">
        <div>
          <span className="font-semibold">Journal Entry</span>
          {!!preview.DocNumber && <span className="ml-2 text-gray-500 font-mono text-xs">{String(preview.DocNumber)}</span>}
        </div>
        <div className="text-gray-500 text-xs">
          Date: {String(preview.TxnDate ?? '')}
          {!!s?.includesPrerequisiteReport && (
            <span className="ml-3 text-blue-600">
              Includes {((s.prerequisiteReports as unknown[]) ?? []).length || 1} prior report(s)
            </span>
          )}
        </div>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b text-xs text-gray-500 uppercase">
          <tr>
            <th className="px-4 py-2 text-left w-8">#</th>
            <th className="px-4 py-2 text-left">Account</th>
            <th className="px-4 py-2 text-right">Debits</th>
            <th className="px-4 py-2 text-right">Credits</th>
            <th className="px-4 py-2 text-left">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {lines.map((line) => {
            const detail = line.JournalEntryLineDetail as Record<string, unknown>
            const meta = line._meta as Record<string, unknown> | undefined
            const postingType = detail?.PostingType as string
            const amount = line.Amount as number
            const accountRef = detail?.AccountRef as { name: string } | null
            const isBalancing = !!meta?.isBalancingLine
            const isPrereq = meta?.sourceReport === 'prerequisite'
            const missingAcct = !!meta?.needsQboAccount
            return (
              <tr key={String(line.Id)} className={isBalancing ? 'bg-blue-50' : isPrereq ? 'bg-purple-50' : ''}>
                <td className="px-4 py-2 text-xs text-gray-400">{String(line.Id)}</td>
                <td className="px-4 py-2">
                  {missingAcct
                    ? <span className="text-xs text-red-500 italic">{isBalancing ? 'Bank / AP account needed' : 'No account assigned'}</span>
                    : <span className="text-xs font-medium">{accountRef?.name ?? '—'}</span>
                  }
                  {isPrereq && (
                    <span className="ml-1 text-xs text-purple-500">
                      (prior report{meta?.sourceRunDate ? ` ${String(meta.sourceRunDate)}` : ''})
                    </span>
                  )}
                  {isBalancing && <span className="ml-1 text-xs text-blue-500">(balancing)</span>}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-xs">{postingType === 'Debit' ? fmt(amount) : ''}</td>
                <td className="px-4 py-2 text-right tabular-nums text-xs">{postingType === 'Credit' ? fmt(amount) : ''}</td>
                <td className="px-4 py-2 text-xs text-gray-600">{String(line.Description ?? '')}</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot className="border-t-2 border-gray-300 bg-gray-50 font-semibold text-sm">
          <tr>
            <td className="px-4 py-2" colSpan={2}>Total</td>
            <td className="px-4 py-2 text-right tabular-nums">{fmt(totals.debits)}</td>
            <td className="px-4 py-2 text-right tabular-nums">{fmt(totals.credits)}</td>
            <td className="px-4 py-2">
              {Math.abs(totals.debits - totals.credits) < 0.01
                ? <span className="text-green-600 text-xs font-medium">✓ Balanced</span>
                : <span className="text-red-600 text-xs">⚠ Out of balance by {fmt(Math.abs(totals.debits - totals.credits))}</span>
              }
            </td>
          </tr>
        </tfoot>
      </table>
      {!!preview.PrivateNote && (
        <div className="px-4 py-2 border-t text-xs text-gray-400">{String(preview.PrivateNote)}</div>
      )}
    </div>
  )
}

export default function ReportDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [pushing, setPushing] = useState(false)
  const [pushResult, setPushResult] = useState<{ ok: boolean; message: string; txnId?: string; intuitTid?: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [edits, setEdits] = useState<Record<string, Partial<LineItem>>>({})
  const [showRaw, setShowRaw] = useState(false)
  const [accounts, setAccounts] = useState<QboAccount[]>([])

  useEffect(() => {
    fetch(`/api/reports/${id}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
    fetch('/api/qbo/accounts')
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setAccounts(d) })
  }, [id])

  async function saveEdits() {
    if (!Object.keys(edits).length) return
    setSaving(true)
    const updates = Object.entries(edits).map(([itemId, fields]) => ({ id: itemId, ...fields }))
    await fetch(`/api/reports/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lineItemUpdates: updates }),
    })
    setEdits({})
    const fresh = await fetch(`/api/reports/${id}`).then((r) => r.json())
    setData(fresh)
    setSaving(false)
  }

  async function loadPreview() {
    setPreviewLoading(true)
    setPreviewError(null)
    setPreview(null)
    setPushResult(null)
    const res = await fetch(`/api/qbo/preview/${id}`)
    const json = await res.json()
    if (!res.ok) {
      setPreviewError(json.error ?? 'Preview failed')
    } else {
      setPreview(json)
    }
    setPreviewLoading(false)
  }

  async function pushToQbo() {
    const isProd = (preview?._environment as string | undefined) === 'production'
    const confirmMsg = isProd
      ? 'Push this Journal Entry to your live QuickBooks company? This will create a real transaction.'
      : 'Push this Journal Entry to QuickBooks sandbox? This will create a transaction in your sandbox company.'
    if (!confirm(confirmMsg)) return
    setPushing(true)
    setPushResult(null)
    const res = await fetch(`/api/qbo/push/${id}`, { method: 'POST' })
    const json = await res.json()
    if (res.ok) {
      const envLabel = json.environment === 'production' ? 'QuickBooks' : 'QuickBooks sandbox'
      setPushResult({ ok: true, message: `Journal Entry created in ${envLabel}.`, txnId: json.qboTransactionId, intuitTid: json.intuitTid })
      const fresh = await fetch(`/api/reports/${id}`).then((r) => r.json())
      setData(fresh)
    } else {
      setPushResult({ ok: false, message: json.error ?? 'Push failed' })
    }
    setPushing(false)
  }

  function editItem(itemId: string, field: keyof LineItem, value: string) {
    setEdits((prev) => ({ ...prev, [itemId]: { ...prev[itemId], [field]: value } }))
  }

  function editAccount(itemId: string, account: { id: string; name: string } | null) {
    setEdits((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        qbo_account_id: account?.id ?? null,
        qbo_account_name: account?.name ?? null,
      } as Partial<LineItem>,
    }))
  }

  if (loading) return <p className="text-gray-500">Loading…</p>
  if (!data) return <p className="text-red-600">Report not found.</p>

  const {
    upload, header, lineItems, customerTotal,
    prerequisiteDate, prerequisiteMet, prerequisiteReport, prerequisiteChain,
    unresolvedPrerequisiteDate, prerequisiteCycleDetected,
    appliedToReport,
  } = data

  const netAmountDue = customerTotal?.net_amount_due ?? null
  const isNegativeReport = netAmountDue !== null && netAmountDue < 0

  const validationOk =
    customerTotal?.open_amount_match &&
    customerTotal?.discount_match &&
    customerTotal?.net_amount_match

  const hasUnmapped = lineItems.some((i) => i.treatment !== 'ignore' && !i.is_carry_forward && !i.qbo_account_id)

  // Positive PDFs can generate a JE; negative PDFs cannot (their lines go into the positive PDF's JE)
  const hasBankCharge = !isNegativeReport
  const canPreviewJE = hasBankCharge && validationOk && prerequisiteMet && !hasUnmapped

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border rounded-xl px-6 py-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">{upload.file_name}</h1>
            {header && (
              <p className="text-gray-500 text-sm mt-1">
                Report {header.report_number} · Run {header.run_date} {header.run_time} · {header.customer_name}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
              hasBankCharge ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {hasBankCharge ? 'Bank Charge' : 'Credit / No Charge'}
            </span>
            <span className={`text-xs px-2 py-1 rounded-full ${upload.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
              {upload.status}
            </span>
          </div>
        </div>

        {/* Totals summary */}
        {customerTotal && (
          <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
            {[
              { label: 'Open Amount', value: customerTotal.open_amount, ok: customerTotal.open_amount_match },
              { label: 'Discount Available', value: customerTotal.discount_available, ok: customerTotal.discount_match },
              { label: 'Net Amount Due', value: customerTotal.net_amount_due, ok: customerTotal.net_amount_match },
            ].map(({ label, value, ok }) => (
              <div key={label} className="bg-gray-50 rounded-lg px-4 py-3">
                <p className="text-gray-500 text-xs mb-1">{label}</p>
                <p className={`font-semibold text-lg ${(value ?? 0) < 0 ? 'text-green-700' : ''}`}>{fmt(value)}</p>
                {ok === false && <p className="text-red-500 text-xs mt-1">Validation mismatch</p>}
              </div>
            ))}
          </div>
        )}

        {/* Validation banner */}
        {customerTotal && (
          <div className={`mt-4 rounded-lg px-4 py-3 text-sm ${validationOk ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {validationOk
              ? '✓ Totals validated — line item sums match customer total.'
              : '✗ Total validation FAILED — do not post to QuickBooks until resolved.'}
          </div>
        )}

        {/* Bank charge / applied-to banners */}
        {isNegativeReport && appliedToReport && (
          <div className="mt-4 rounded-lg px-4 py-3 text-sm bg-blue-50 border border-blue-200 text-blue-800">
            <p>
              This report has no bank charge. Its lines are included in the Journal Entry for{' '}
              <a href={`/reports/${appliedToReport.id}`} className="underline font-semibold">
                {appliedToReport.file_name}
              </a>{' '}
              (run {appliedToReport.run_date}).
            </p>
          </div>
        )}
        {isNegativeReport && !appliedToReport && (
          <div className="mt-4 rounded-lg px-4 py-3 text-sm bg-gray-50 border border-gray-200 text-gray-600">
            This report&apos;s credits have not yet been applied to a bank charge report.
            Upload the next report to link them.
          </div>
        )}
        {hasBankCharge && prerequisiteReport && (
          <div className="mt-4 rounded-lg px-4 py-3 text-sm bg-blue-50 border border-blue-200 text-blue-800">
            {prerequisiteChain.length > 1 ? (
              <>
                <p className="font-semibold">Journal Entry includes {prerequisiteChain.length} prior reports in the carry-forward chain.</p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                  {prerequisiteChain.map((report) => (
                    <a key={report.id} href={`/reports/${report.id}`} className="underline">
                      {report.file_name} (run {report.run_date})
                    </a>
                  ))}
                </div>
              </>
            ) : (
              <p>
                ✓ Journal Entry includes lines from prerequisite report{' '}
                <a href={`/reports/${prerequisiteReport.id}`} className="underline font-semibold">
                  {prerequisiteReport.file_name}
                </a>{' '}
                (run {prerequisiteReport.run_date}).
              </p>
            )}
          </div>
        )}

        {/* Prerequisite upload required banner */}
        {prerequisiteDate && !prerequisiteMet && (
          <div className="mt-4 rounded-lg px-4 py-3 text-sm bg-red-50 border border-red-300 text-red-800">
            <p className="font-semibold">⚠ Prerequisite report required before this can be posted</p>
            <p className="mt-1">
              This carry-forward chain is missing the report from{' '}
              <strong>{unresolvedPrerequisiteDate ?? prerequisiteDate}</strong>. Upload that PDF first so the carry-forward balance is accounted for.
            </p>
            <a href="/" className="mt-2 inline-block underline font-semibold">Upload the {unresolvedPrerequisiteDate ?? prerequisiteDate} report →</a>
          </div>
        )}
        {prerequisiteCycleDetected && (
          <div className="mt-4 rounded-lg px-4 py-3 text-sm bg-red-50 border border-red-300 text-red-800">
            A circular prerequisite link was detected. The report chain must be corrected before this can be posted.
          </div>
        )}

        {/* Parse errors */}
        {upload.parse_errors?.length > 0 && (
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-sm text-yellow-800">
            <p className="font-semibold mb-1">Parse warnings ({upload.parse_errors.length})</p>
            <ul className="list-disc list-inside space-y-0.5">
              {upload.parse_errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        )}
      </div>

      {/* Line items table */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">Line Items ({lineItems.length})</h2>
          {Object.keys(edits).length > 0 && (
            <button
              onClick={saveEdits}
              disabled={saving}
              className="bg-blue-600 text-white text-sm px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Edits'}
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-2 text-left">Remarks</th>
                <th className="px-4 py-2 text-left">Type</th>
                <th className="px-4 py-2 text-left">Doc #</th>
                <th className="px-4 py-2 text-right">Open Amt</th>
                <th className="px-4 py-2 text-right">Discount</th>
                <th className="px-4 py-2 text-right">Net Due</th>
                <th className="px-4 py-2 text-left">Category</th>
                <th className="px-4 py-2 text-left">Treatment</th>
                <th className="px-4 py-2 text-left">QBO Account</th>
                <th className="px-4 py-2 text-left">Memo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lineItems.map((item) => {
                const itemEdit = edits[item.id] ?? {}
                const treatment = (itemEdit.treatment ?? item.treatment) as string
                const missingAccount = treatment !== 'ignore' && !item.is_carry_forward && !(itemEdit.qbo_account_id !== undefined ? itemEdit.qbo_account_id : item.qbo_account_id)
                const isEdited = !!edits[item.id]
                return (
                  <tr key={item.id} className={`${missingAccount ? 'bg-red-50' : ''} ${item.is_carry_forward ? 'bg-orange-50' : ''} ${isEdited ? 'ring-1 ring-blue-300' : ''}`}>
                    <td className="px-4 py-2 max-w-xs">
                      <div>{item.remarks}</div>
                      {item.is_carry_forward && (
                        <div className="text-orange-600 text-xs font-medium">carry-forward → included in positive PDF&apos;s JE</div>
                      )}
                      {item.warnings?.map((w, i) => <div key={i} className="text-orange-600 text-xs">{w}</div>)}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{item.doc_type}</td>
                    <td className="px-4 py-2 font-mono text-xs">{item.doc_number}</td>
                    <td className={`px-4 py-2 text-right tabular-nums ${(item.open_amount ?? 0) < 0 ? 'text-green-700' : ''}`}>{fmt(item.open_amount)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmt(item.discount_available)}</td>
                    <td className={`px-4 py-2 text-right tabular-nums font-semibold ${(item.net_amount_due ?? 0) < 0 ? 'text-green-700' : ''}`}>{fmt(item.net_amount_due)}</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${CATEGORY_COLORS[item.row_category] ?? ''}`}>
                        {item.row_category.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {item.is_carry_forward
                        ? <span className="text-xs text-orange-600 font-medium">Carry-Forward</span>
                        : (
                          <select
                            value={treatment}
                            onChange={(e) => editItem(item.id, 'treatment', e.target.value)}
                            className="text-xs border border-gray-200 rounded px-2 py-1"
                          >
                            {Object.entries(TREATMENT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                        )}
                    </td>
                    <td className="px-4 py-2">
                      {item.is_carry_forward
                        ? <span className="text-xs text-gray-400">—</span>
                        : (
                          <AccountPicker
                            accounts={accounts}
                            value={{
                              id: (itemEdit.qbo_account_id !== undefined ? itemEdit.qbo_account_id : item.qbo_account_id) ?? null,
                              name: (itemEdit.qbo_account_name !== undefined ? itemEdit.qbo_account_name : item.qbo_account_name) ?? null,
                            }}
                            onChange={(acct) => editAccount(item.id, acct)}
                          />
                        )}
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        placeholder="Memo…"
                        defaultValue={item.qbo_memo ?? ''}
                        onBlur={(e) => editItem(item.id, 'qbo_memo', e.target.value)}
                        className="text-xs border border-gray-200 rounded px-2 py-1 w-32"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Missing account warning */}
      {hasUnmapped && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-sm text-red-700">
          <strong>Missing QBO accounts.</strong> Rows highlighted in red need a QBO account before the Journal Entry can be generated.
          Assign accounts above or <a href="/mappings" className="underline">add mapping rules →</a>
        </div>
      )}

      {/* QBO Journal Entry section */}
      <div className="bg-white border rounded-xl px-6 py-5">
        <h2 className="font-semibold mb-1">QuickBooks Online — Journal Entry</h2>

        {isNegativeReport ? (
          <div className="text-sm text-gray-500 bg-gray-50 rounded-lg px-4 py-3">
            This report has no bank charge and does not generate its own Journal Entry.
            {appliedToReport ? (
              <> Its lines are included in the JE for{' '}
                <a href={`/reports/${appliedToReport.id}`} className="underline font-semibold text-blue-600">
                  {appliedToReport.file_name}
                </a>.
              </>
            ) : (
              ' Upload the next report to see where these lines will appear.'
            )}
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-4">
              One Journal Entry per bank charge. Positive lines debit the assigned account;
              negative lines credit it.{prerequisiteReport && ` Lines from ${prerequisiteChain.length || 1} prior report(s) are included automatically.`}
              {' '}A balancing Credit to your bank/AP account equals the net amount debited.
            </p>
            {!canPreviewJE && (
              <ul className="text-sm text-red-600 mb-3 list-disc list-inside space-y-0.5">
                {!validationOk && <li>Fix total validation errors</li>}
                {!prerequisiteMet && <li>Upload the prerequisite report from {unresolvedPrerequisiteDate ?? prerequisiteDate} first</li>}
                {hasUnmapped && <li>Assign a QBO account to all included rows</li>}
              </ul>
            )}
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={loadPreview}
                disabled={previewLoading || !canPreviewJE}
                className="bg-gray-700 text-white text-sm px-4 py-2 rounded hover:bg-gray-800 disabled:opacity-50"
              >
                {previewLoading ? 'Loading…' : 'Preview Journal Entry'}
              </button>
              {preview && (
                <button
                  onClick={pushToQbo}
                  disabled={pushing || upload.status === 'pushed'}
                  className="bg-green-600 text-white text-sm px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
                >
                  {pushing
                    ? 'Pushing…'
                    : upload.status === 'pushed'
                      ? 'Already Pushed'
                      : preview._environment === 'production' ? 'Push to QuickBooks' : 'Push to QBO Sandbox'}
                </button>
              )}
            </div>

            {previewError && (
              <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {previewError}
              </div>
            )}

            {pushResult && (
              <div className={`mt-3 rounded-lg px-4 py-3 text-sm ${pushResult.ok ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                <p className="font-semibold">{pushResult.ok ? '✓' : '✗'} {pushResult.message}</p>
                {pushResult.txnId && <p className="mt-1 text-xs">QBO Transaction ID: <span className="font-mono">{pushResult.txnId}</span></p>}
                {pushResult.intuitTid && <p className="text-xs">Intuit TID: <span className="font-mono">{pushResult.intuitTid}</span></p>}
              </div>
            )}

            {preview && (
              <div className="mt-4">
                <div className={`rounded-lg px-4 py-2 text-xs mb-3 border ${
                  preview._environment === 'production'
                    ? 'bg-red-50 border-red-200 text-red-800'
                    : 'bg-yellow-50 border-yellow-200 text-yellow-800'
                }`}>
                  {preview._environment === 'production'
                    ? '⚠ Connected to live QuickBooks — preview only, not yet posted. Pushing will create a real transaction.'
                    : 'Sandbox preview only — not posted to QuickBooks.'}
                </div>
                {/* Warnings */}
                {(preview._warnings as string[])?.length > 0 && (
                  <div className="mb-3 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 text-xs text-yellow-800">
                    {(preview._warnings as string[]).map((w, i) => <p key={i}>⚠ {w}</p>)}
                  </div>
                )}
                {/* QBO-style Journal Entry table */}
                <JePreviewTable preview={preview} fmt={fmt} />
              </div>
            )}
          </>
        )}
      </div>

      {/* Raw text toggle */}
      <div>
        <button onClick={() => setShowRaw(!showRaw)} className="text-sm text-gray-500 underline">
          {showRaw ? 'Hide' : 'Show'} raw extracted text
        </button>
        {showRaw && (
          <pre className="mt-2 bg-gray-100 text-xs rounded-lg p-4 overflow-x-auto max-h-64">
            (Raw text stored in database — query pdf_uploads.raw_text for upload ID {upload.id})
          </pre>
        )}
      </div>
    </div>
  )
}
