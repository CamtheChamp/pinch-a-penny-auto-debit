'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface LineItem {
  treatment: string
  is_carry_forward: boolean
  qbo_account_id: string | null
}

interface CustomerTotal {
  open_amount_match: boolean | null
  discount_match: boolean | null
  net_amount_match: boolean | null
  net_amount_due: number | null
}

interface ReportData {
  upload: { status: string }
  lineItems: LineItem[]
  customerTotal: CustomerTotal | null
  prerequisiteDate: string | null
  prerequisiteMet: boolean
  prerequisiteCycleDetected: boolean
}

export default function PushToQboButton({ uploadId }: { uploadId: string }) {
  const router = useRouter()
  const [ready, setReady] = useState<boolean | null>(null)
  const [alreadyPushed, setAlreadyPushed] = useState(false)
  const [pushing, setPushing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/reports/${uploadId}`)
      .then((r) => r.json())
      .then((data: ReportData) => {
        if (cancelled) return
        setAlreadyPushed(data.upload.status === 'pushed')
        const netAmountDue = data.customerTotal?.net_amount_due ?? null
        const hasBankCharge = netAmountDue !== null && netAmountDue >= 0
        const validationOk = !!(
          data.customerTotal?.open_amount_match &&
          data.customerTotal?.discount_match &&
          data.customerTotal?.net_amount_match
        )
        const hasUnmapped = data.lineItems.some(
          (i) => i.treatment !== 'ignore' && !i.is_carry_forward && !i.qbo_account_id
        )
        setReady(hasBankCharge && validationOk && data.prerequisiteMet && !data.prerequisiteCycleDetected && !hasUnmapped)
      })
      .catch(() => setReady(false))
    return () => { cancelled = true }
  }, [uploadId])

  async function push(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const confirmMsg = alreadyPushed
      ? 'Update the existing Journal Entry in QuickBooks with these changes? This edits the transaction already posted there.'
      : 'Push this Journal Entry to QuickBooks? This will create a real transaction.'
    if (!confirm(confirmMsg)) return
    setPushing(true)
    setError(null)
    const previewRes = await fetch(`/api/qbo/preview/${uploadId}`)
    if (!previewRes.ok) {
      const json = await previewRes.json().catch(() => ({}))
      setError(json.error ?? 'Preview failed')
      setPushing(false)
      return
    }
    const pushRes = await fetch(`/api/qbo/push/${uploadId}`, { method: 'POST' })
    const json = await pushRes.json()
    if (!pushRes.ok) {
      setError(json.error ?? 'Push failed')
      setPushing(false)
      return
    }
    setPushing(false)
    router.refresh()
  }

  if (ready === null || !ready) {
    return alreadyPushed
      ? <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full">Pushed</span>
      : null
  }

  return (
    <div className="mt-3 pt-3 border-t flex flex-col items-end gap-1">
      <button
        onClick={push}
        disabled={pushing}
        className={`text-white text-xs px-3 py-1 rounded-full disabled:opacity-50 whitespace-nowrap ${
          alreadyPushed ? 'bg-purple-600 hover:bg-purple-700' : 'bg-green-600 hover:bg-green-700'
        }`}
      >
        {pushing
          ? (alreadyPushed ? 'Updating…' : 'Pushing…')
          : (alreadyPushed ? 'Re-push to QuickBooks' : 'Push to QuickBooks')}
      </button>
      {error && <span className="text-red-600 text-xs max-w-48 text-right">{error}</span>}
    </div>
  )
}
