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
        if (data.upload.status === 'pushed') {
          setAlreadyPushed(true)
          setReady(false)
          return
        }
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
    if (!confirm('Push this Journal Entry to QuickBooks? This will create a real transaction.')) return
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

  if (ready === null || alreadyPushed || !ready) return null

  return (
    <div className="mt-3 pt-3 border-t flex flex-col items-end gap-1">
      <button
        onClick={push}
        disabled={pushing}
        className="bg-green-600 text-white text-xs px-3 py-1 rounded-full hover:bg-green-700 disabled:opacity-50 whitespace-nowrap"
      >
        {pushing ? 'Pushing…' : 'Push to QuickBooks'}
      </button>
      {error && <span className="text-red-600 text-xs max-w-48 text-right">{error}</span>}
    </div>
  )
}
