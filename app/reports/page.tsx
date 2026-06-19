import Link from 'next/link'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface UploadRow {
  id: string
  file_name: string
  uploaded_at: string
  status: string
  parse_errors: string[]
  report_headers: { report_number: string; run_date: string; customer_name: string }[] | null
  customer_totals: {
    open_amount: number | null
    net_amount_due: number | null
    open_amount_match: boolean | null
    discount_match: boolean | null
    net_amount_match: boolean | null
  }[] | null
}

function validBadge(ok: boolean | null) {
  if (ok === null) return <span className="text-gray-400 text-xs">—</span>
  return ok
    ? <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">Valid</span>
    : <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">Mismatch</span>
}

export default async function ReportsPage() {
  const { data: reports, error } = await db
    .from('pdf_uploads')
    .select(`
      id, file_name, uploaded_at, status, parse_errors,
      report_headers ( report_number, run_date, customer_name ),
      customer_totals ( open_amount, net_amount_due, open_amount_match, discount_match, net_amount_match )
    `)
    .order('uploaded_at', { ascending: false }) as { data: UploadRow[] | null; error: unknown }

  if (error) {
    return <p className="text-red-600">Failed to load reports. Check Supabase config.</p>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Parsed Reports</h1>
        <Link href="/" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
          + Upload New
        </Link>
      </div>

      {!reports?.length && (
        <p className="text-gray-500">No reports yet. <Link href="/" className="underline text-blue-600">Upload a PDF.</Link></p>
      )}

      <div className="space-y-3">
        {reports?.map((r) => {
          const header = r.report_headers?.[0]
          const total = r.customer_totals?.[0]
          const allValid = (total?.open_amount_match && total?.discount_match && total?.net_amount_match) ?? null
          const hasErrors = r.parse_errors?.length > 0

          return (
            <Link
              key={r.id}
              href={`/reports/${r.id}`}
              className="block bg-white border rounded-xl px-5 py-4 hover:shadow-sm hover:border-blue-300 transition"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-gray-900">{r.file_name}</p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {header?.report_number} · Run {header?.run_date} · {header?.customer_name}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <StatusBadge status={r.status} />
                  {total && validBadge(allValid)}
                  {hasErrors && (
                    <span className="bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 rounded-full">
                      {r.parse_errors.length} parse error{r.parse_errors.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
              {total && (
                <div className="mt-2 text-sm text-gray-600 flex gap-4">
                  <span>Net Due: <strong>${total.net_amount_due?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></span>
                  <span>Open: <strong>${total.open_amount?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></span>
                </div>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-600',
    parsed: 'bg-blue-100 text-blue-700',
    approved: 'bg-green-100 text-green-700',
    pushed: 'bg-purple-100 text-purple-700',
    error: 'bg-red-100 text-red-700',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  )
}
