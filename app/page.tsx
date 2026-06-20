'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface LineItemSummary {
  id: string
  remarks: string
  treatment: string
  is_carry_forward: boolean
  qbo_account_name: string | null
  net_amount_due: number | null
}

function fmtAmt(n: number | null) {
  if (n === null || n === undefined) return '—'
  const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2 })
  return n < 0 ? `-$${abs}` : `$${abs}`
}

export default function UploadPage() {
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [results, setResults] = useState<{ name: string; id?: string; error?: string; duplicateId?: string }[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [summaries, setSummaries] = useState<Record<string, LineItemSummary[]>>({})
  const [loadingSummary, setLoadingSummary] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  async function toggleSummary(uploadId: string) {
    if (expandedId === uploadId) {
      setExpandedId(null)
      return
    }
    setExpandedId(uploadId)
    if (!summaries[uploadId]) {
      setLoadingSummary(uploadId)
      const res = await fetch(`/api/reports/${uploadId}`)
      const json = await res.json()
      setSummaries((prev) => ({ ...prev, [uploadId]: json.lineItems ?? [] }))
      setLoadingSummary(null)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const dropped = Array.from(e.dataTransfer.files).filter((f) => f.type === 'application/pdf')
    setFiles((prev) => [...prev, ...dropped])
  }

  async function handleUpload() {
    if (!files.length) return
    setUploading(true)
    setResults([])
    const out: typeof results = []
    for (const file of files) {
      const form = new FormData()
      form.append('file', file)
      try {
        const res = await fetch('/api/upload', { method: 'POST', body: form })
        const json = await res.json()
        if (json.uploadId) {
          out.push({ name: file.name, id: json.uploadId })
        } else if (json.duplicateUploadId) {
          out.push({ name: file.name, error: json.error, duplicateId: json.duplicateUploadId })
        } else {
          const msg = [json.error, json.detail].filter(Boolean).join(': ')
          out.push({ name: file.name, error: msg || 'Unknown error' })
        }
      } catch (e) {
        out.push({ name: file.name, error: String(e) })
      }
    }
    setResults(out)
    setUploading(false)
    setFiles([])
  }

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Upload Preauthorized Debit PDF</h1>

      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed border-blue-400 rounded-xl p-10 text-center cursor-pointer hover:bg-blue-50 transition-colors"
        onClick={() => inputRef.current?.click()}
      >
        <p className="text-gray-500 mb-2">Drag &amp; drop PDF files here, or click to browse</p>
        <p className="text-xs text-gray-400">Accepts: R03989 Preauthorized Debit PDFs</p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            const added = Array.from(e.target.files ?? [])
            setFiles((prev) => [...prev, ...added])
            e.target.value = ''
          }}
        />
      </div>

      {files.length > 0 && (
        <ul className="mt-4 space-y-1">
          {files.map((f, i) => (
            <li key={i} className="flex items-center justify-between bg-white border rounded px-3 py-2 text-sm">
              <span>{f.name}</span>
              <button
                onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                className="text-red-400 hover:text-red-600 text-xs ml-2"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={handleUpload}
        disabled={!files.length || uploading}
        className="mt-4 w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {uploading ? 'Uploading & Parsing…' : `Upload ${files.length > 0 ? `${files.length} file${files.length > 1 ? 's' : ''}` : ''}`}
      </button>

      {results.length > 0 && (
        <div className="mt-6 space-y-2">
          {results.map((r, i) => (
            <div
              key={i}
              className={`rounded-lg px-4 py-3 text-sm ${r.error ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-green-50 border border-green-200 text-green-800'}`}
            >
              {r.duplicateId ? (
                <p>
                  <strong>{r.name}</strong>: {r.error}{' '}
                  <button className="underline font-semibold" onClick={() => router.push(`/reports/${r.duplicateId}`)}>
                    View existing report →
                  </button>
                </p>
              ) : r.error ? (
                <p><strong>{r.name}</strong>: {r.error}</p>
              ) : (
                <div>
                  <p className="flex items-center justify-between gap-2">
                    <span>
                      <strong>{r.name}</strong> parsed.{' '}
                      <button
                        className="underline font-semibold"
                        onClick={() => router.push(`/reports/${r.id}`)}
                      >
                        Review →
                      </button>
                    </span>
                    <button
                      onClick={() => toggleSummary(r.id!)}
                      title="Quick summary of transactions and assigned accounts"
                      className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full border border-green-400 text-green-700 hover:bg-green-100 text-xs font-bold leading-none"
                    >
                      {expandedId === r.id ? '−' : '+'}
                    </button>
                  </p>
                  {expandedId === r.id && (
                    <div className="mt-3 bg-white border border-green-200 rounded-lg divide-y divide-gray-100">
                      {loadingSummary === r.id ? (
                        <p className="px-3 py-2 text-xs text-gray-400">Loading…</p>
                      ) : !summaries[r.id!]?.length ? (
                        <p className="px-3 py-2 text-xs text-gray-400">No line items.</p>
                      ) : summaries[r.id!].map((item) => (
                        <div key={item.id} className="px-3 py-2 flex items-center justify-between gap-3 text-xs">
                          <div className="min-w-0">
                            <p className="text-gray-800 truncate">{item.remarks}</p>
                            <p className="text-gray-400">{fmtAmt(item.net_amount_due)}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            {item.is_carry_forward ? (
                              <span className="text-orange-600 font-medium">Carry-Forward</span>
                            ) : item.treatment === 'ignore' ? (
                              <span className="text-gray-400">Ignored</span>
                            ) : item.qbo_account_name ? (
                              <span className="text-green-700 font-medium">{item.qbo_account_name}</span>
                            ) : (
                              <span className="text-red-500 font-medium">Needs account</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
