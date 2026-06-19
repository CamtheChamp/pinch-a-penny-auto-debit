import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data, error } = await db
    .from('pdf_uploads')
    .select(`
      id,
      file_name,
      uploaded_at,
      status,
      parse_errors,
      report_headers ( report_number, run_date, customer_name ),
      customer_totals ( open_amount, discount_available, net_amount_due, open_amount_match, discount_match, net_amount_match )
    `)
    .order('uploaded_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
