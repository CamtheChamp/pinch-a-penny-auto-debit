'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DeleteReportButton({
  uploadId,
  fileName,
  onDeleted,
  className,
}: {
  uploadId: string
  fileName: string
  onDeleted?: () => void
  className?: string
}) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function deleteReport(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`Delete ${fileName}? This permanently removes the report, its line items, and any QuickBooks push history. This cannot be undone.`)) return
    setDeleting(true)
    const res = await fetch(`/api/reports/${uploadId}`, { method: 'DELETE' })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      alert(json.error ?? 'Delete failed')
      setDeleting(false)
      return
    }
    if (onDeleted) {
      onDeleted()
    } else {
      router.push('/reports')
      router.refresh()
    }
  }

  return (
    <button
      onClick={deleteReport}
      disabled={deleting}
      className={className ?? 'text-red-500 hover:text-red-700 text-xs disabled:opacity-50'}
    >
      {deleting ? 'Deleting…' : 'Delete'}
    </button>
  )
}
