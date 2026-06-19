import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface Log {
  id: string
  upload_id: string | null
  event_type: string
  payload: Record<string, unknown>
  created_at: string
}

export default async function AuditPage() {
  const { data: logs } = await db
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200) as { data: Log[] | null }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Audit Log</h1>
      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-2 text-left">Time</th>
              <th className="px-4 py-2 text-left">Event</th>
              <th className="px-4 py-2 text-left">Upload ID</th>
              <th className="px-4 py-2 text-left">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs?.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">
                  {new Date(log.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-2">
                  <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{log.event_type}</span>
                </td>
                <td className="px-4 py-2 font-mono text-xs text-gray-500">
                  {log.upload_id ? (
                    <a href={`/reports/${log.upload_id}`} className="underline text-blue-600">
                      {log.upload_id.slice(0, 8)}…
                    </a>
                  ) : '—'}
                </td>
                <td className="px-4 py-2 text-xs text-gray-600 max-w-md truncate">
                  {JSON.stringify(log.payload)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!logs?.length && (
          <p className="px-6 py-8 text-center text-gray-400 text-sm">No audit events yet.</p>
        )}
      </div>
    </div>
  )
}
