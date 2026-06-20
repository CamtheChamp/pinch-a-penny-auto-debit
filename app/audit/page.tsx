import Link from 'next/link'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface Log {
  id: string
  upload_id: string | null
  event_type: string
  payload: Record<string, unknown> | null
  created_at: string
}

const EVENT_BADGE: Record<string, string> = {
  upload: 'bg-blue-100 text-blue-700',
  manual_edit: 'bg-gray-100 text-gray-600',
  qbo_push_success: 'bg-green-100 text-green-700',
  qbo_push_error: 'bg-red-100 text-red-700',
}

const EVENT_TYPES = ['upload', 'manual_edit', 'qbo_push_success', 'qbo_push_error']

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>
}) {
  const { event } = await searchParams

  let query = db
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (event) {
    query = query.eq('event_type', event)
  }

  const { data: logs, error } = await query as { data: Log[] | null; error: unknown }

  if (error) {
    return <p className="text-red-600">Failed to load audit log. Check Supabase config.</p>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <div className="flex gap-2 text-sm">
          <Link
            href="/audit"
            className={`px-3 py-1 rounded-full border ${!event ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
          >
            All
          </Link>
          {EVENT_TYPES.map((t) => (
            <Link
              key={t}
              href={`/audit?event=${t}`}
              className={`px-3 py-1 rounded-full border font-mono text-xs ${event === t ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
            >
              {t}
            </Link>
          ))}
        </div>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-2 text-left">Time</th>
              <th className="px-4 py-2 text-left">Event</th>
              <th className="px-4 py-2 text-left">Upload</th>
              <th className="px-4 py-2 text-left">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs?.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50 align-top">
                <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">
                  {new Date(log.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-2">
                  <span className={`font-mono text-xs px-2 py-0.5 rounded ${EVENT_BADGE[log.event_type] ?? 'bg-gray-100 text-gray-600'}`}>
                    {log.event_type}
                  </span>
                </td>
                <td className="px-4 py-2 font-mono text-xs text-gray-500">
                  {log.upload_id ? (
                    <Link href={`/reports/${log.upload_id}`} className="underline text-blue-600">
                      {log.upload_id.slice(0, 8)}…
                    </Link>
                  ) : '—'}
                </td>
                <td className="px-4 py-2 text-xs text-gray-600 max-w-lg">
                  {log.payload && Object.keys(log.payload).length > 0 ? (
                    <details>
                      <summary className="cursor-pointer truncate text-gray-700">
                        {summarizePayload(log.payload)}
                      </summary>
                      <pre className="mt-1 bg-gray-50 border rounded p-2 overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(log.payload, null, 2)}
                      </pre>
                    </details>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!logs?.length && (
          <p className="px-6 py-8 text-center text-gray-400 text-sm">
            {event ? `No "${event}" events yet.` : 'No audit events yet.'}
          </p>
        )}
      </div>
    </div>
  )
}

function summarizePayload(payload: Record<string, unknown>): string {
  const preferredKeys = ['error', 'message', 'fileName', 'file_name', 'reportNumber', 'report_number', 'qboTransactionId', 'qbo_transaction_id']
  for (const key of preferredKeys) {
    if (payload[key] != null) return `${key}: ${String(payload[key])}`
  }
  const entries = Object.entries(payload)
  if (!entries.length) return '—'
  return entries.slice(0, 2).map(([k, v]) => `${k}: ${String(v)}`).join(', ')
}
