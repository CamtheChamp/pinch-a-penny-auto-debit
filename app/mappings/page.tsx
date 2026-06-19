'use client'

import { useEffect, useState } from 'react'

interface Mapping {
  id: string
  match_type: string
  match_field: string
  match_value: string
  qbo_account_name: string | null
  qbo_account_id: string | null
  qbo_class_id: string | null
  default_memo: string | null
  treatment: string
  priority: number
}

const BLANK: Omit<Mapping, 'id'> = {
  match_type: 'contains',
  match_field: 'remarks',
  match_value: '',
  qbo_account_name: '',
  qbo_account_id: '',
  qbo_class_id: '',
  default_memo: '',
  treatment: 'needs_review',
  priority: 0,
}

const TREATMENTS = ['expense', 'credit', 'carry_forward', 'ignore', 'needs_review']
const MATCH_TYPES = ['exact', 'contains', 'regex']
const MATCH_FIELDS = ['remarks', 'doc_type', 'doc_number']

export default function MappingsPage() {
  const [mappings, setMappings] = useState<Mapping[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<Omit<Mapping, 'id'>>(BLANK)
  const [saving, setSaving] = useState(false)

  async function load() {
    const res = await fetch('/api/mappings')
    const data = await res.json()
    setMappings(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function saveNew() {
    if (!draft.match_value.trim()) return
    setSaving(true)
    await fetch('/api/mappings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    })
    setDraft(BLANK)
    setAdding(false)
    await load()
    setSaving(false)
  }

  async function deleteMapping(id: string) {
    if (!confirm('Delete this mapping?')) return
    await fetch(`/api/mappings/${id}`, { method: 'DELETE' })
    await load()
  }

  async function updateField(id: string, field: keyof Mapping, value: string | number) {
    setMappings((prev) => prev.map((m) => m.id === id ? { ...m, [field]: value } : m))
    await fetch(`/api/mappings/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
  }

  if (loading) return <p className="text-gray-500">Loading…</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Accounting Mappings</h1>
          <p className="text-gray-500 text-sm mt-1">Configure how report rows map to QuickBooks accounts.</p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
        >
          + Add Mapping
        </button>
      </div>

      {adding && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
          <h2 className="font-semibold mb-3">New Mapping</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Match Field</label>
              <select value={draft.match_field} onChange={(e) => setDraft((d) => ({ ...d, match_field: e.target.value }))} className="w-full border rounded px-2 py-1">
                {MATCH_FIELDS.map((f) => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Match Type</label>
              <select value={draft.match_type} onChange={(e) => setDraft((d) => ({ ...d, match_type: e.target.value }))} className="w-full border rounded px-2 py-1">
                {MATCH_TYPES.map((f) => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Match Value *</label>
              <input value={draft.match_value} onChange={(e) => setDraft((d) => ({ ...d, match_value: e.target.value }))} className="w-full border rounded px-2 py-1" placeholder="e.g. ADV/FF" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Treatment</label>
              <select value={draft.treatment} onChange={(e) => setDraft((d) => ({ ...d, treatment: e.target.value }))} className="w-full border rounded px-2 py-1">
                {TREATMENTS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">QBO Account Name</label>
              <input value={draft.qbo_account_name ?? ''} onChange={(e) => setDraft((d) => ({ ...d, qbo_account_name: e.target.value }))} className="w-full border rounded px-2 py-1" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">QBO Account ID</label>
              <input value={draft.qbo_account_id ?? ''} onChange={(e) => setDraft((d) => ({ ...d, qbo_account_id: e.target.value }))} className="w-full border rounded px-2 py-1" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Default Memo</label>
              <input value={draft.default_memo ?? ''} onChange={(e) => setDraft((d) => ({ ...d, default_memo: e.target.value }))} className="w-full border rounded px-2 py-1" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Priority</label>
              <input type="number" value={draft.priority} onChange={(e) => setDraft((d) => ({ ...d, priority: parseInt(e.target.value) || 0 }))} className="w-full border rounded px-2 py-1" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={saveNew} disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => { setAdding(false); setDraft(BLANK) }} className="text-gray-600 px-4 py-2 rounded text-sm hover:bg-gray-100">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-2 text-left">Field</th>
              <th className="px-4 py-2 text-left">Type</th>
              <th className="px-4 py-2 text-left">Value</th>
              <th className="px-4 py-2 text-left">Treatment</th>
              <th className="px-4 py-2 text-left">QBO Account</th>
              <th className="px-4 py-2 text-left">Memo</th>
              <th className="px-4 py-2 text-right">Priority</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {mappings.map((m) => (
              <tr key={m.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-mono text-xs">{m.match_field}</td>
                <td className="px-4 py-2 text-xs">{m.match_type}</td>
                <td className="px-4 py-2 font-mono text-xs">{m.match_value}</td>
                <td className="px-4 py-2">
                  <select
                    value={m.treatment}
                    onChange={(e) => updateField(m.id, 'treatment', e.target.value)}
                    className="text-xs border rounded px-2 py-1"
                  >
                    {TREATMENTS.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </td>
                <td className="px-4 py-2">
                  <input
                    defaultValue={m.qbo_account_name ?? ''}
                    onBlur={(e) => updateField(m.id, 'qbo_account_name', e.target.value)}
                    className="text-xs border rounded px-2 py-1 w-36"
                    placeholder="Account name"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    defaultValue={m.default_memo ?? ''}
                    onBlur={(e) => updateField(m.id, 'default_memo', e.target.value)}
                    className="text-xs border rounded px-2 py-1 w-36"
                    placeholder="Memo"
                  />
                </td>
                <td className="px-4 py-2 text-right text-xs">{m.priority}</td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => deleteMapping(m.id)} className="text-red-400 hover:text-red-600 text-xs">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!mappings.length && (
          <p className="px-6 py-8 text-center text-gray-400 text-sm">No mappings yet.</p>
        )}
      </div>

      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-sm text-amber-800">
        <strong>Mapping priority:</strong> Higher number = evaluated first. When a row matches multiple rules, the highest-priority rule wins.
        <br />
        <strong>Carry-forward rows (RU / unapplied D.D.):</strong> These are mapped automatically but may need special accounting treatment. Confirm with bookkeeper before posting.
      </div>
    </div>
  )
}
