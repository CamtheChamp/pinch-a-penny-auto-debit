'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

export default function UploadPage() {
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [results, setResults] = useState<{ name: string; id?: string; error?: string }[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

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
        } else {
          out.push({ name: file.name, error: json.error ?? 'Unknown error' })
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
              {r.error ? (
                <p><strong>{r.name}</strong>: {r.error}</p>
              ) : (
                <p>
                  <strong>{r.name}</strong> parsed.{' '}
                  <button
                    className="underline font-semibold"
                    onClick={() => router.push(`/reports/${r.id}`)}
                  >
                    Review →
                  </button>
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
