import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'
import { db } from '@/lib/db'

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/reports/[id]'>) {
  const { id } = await ctx.params

  const [uploadRes, headerRes, itemsRes, totalRes] = await Promise.all([
    db.from('pdf_uploads').select('*').eq('id', id).single(),
    db.from('report_headers').select('*').eq('upload_id', id).single(),
    db.from('line_items').select('*').eq('upload_id', id).order('sort_order'),
    db.from('customer_totals').select('*').eq('upload_id', id).single(),
  ])

  if (uploadRes.error) return Response.json({ error: 'Not found' }, { status: 404 })

  const upload = uploadRes.data

  // Resolve prerequisite report info if one is required
  let prerequisiteReport: { id: string; file_name: string; run_date: string } | null = null
  if (upload.prerequisite_date) {
    if (upload.prerequisite_upload_id) {
      const { data: priorUpload } = await db
        .from('pdf_uploads')
        .select('id, file_name')
        .eq('id', upload.prerequisite_upload_id)
        .single()
      const { data: priorHeader } = await db
        .from('report_headers')
        .select('run_date')
        .eq('upload_id', upload.prerequisite_upload_id)
        .single()
      if (priorUpload) {
        prerequisiteReport = { id: priorUpload.id, file_name: priorUpload.file_name, run_date: priorHeader?.run_date ?? upload.prerequisite_date }
      }
    }
  }

  // Reverse lookup: does a downstream (positive) PDF reference this one as its prerequisite?
  // If so, this is a negative PDF whose lines are absorbed into that report's JE.
  let appliedToReport: { id: string; file_name: string; run_date: string } | null = null
  const { data: downstream } = await db
    .from('pdf_uploads')
    .select('id, file_name')
    .eq('prerequisite_upload_id', id)
    .limit(1)
    .single()
  if (downstream) {
    const { data: dsHeader } = await db
      .from('report_headers')
      .select('run_date')
      .eq('upload_id', downstream.id)
      .single()
    appliedToReport = {
      id: downstream.id,
      file_name: downstream.file_name,
      run_date: dsHeader?.run_date ?? '',
    }
  }

  return Response.json({
    upload,
    header: headerRes.data,
    lineItems: itemsRes.data ?? [],
    customerTotal: totalRes.data,
    prerequisiteDate: upload.prerequisite_date ?? null,
    prerequisiteMet: upload.prerequisite_date ? !!upload.prerequisite_upload_id : true,
    prerequisiteReport,
    appliedToReport,
  })
}

export async function PATCH(req: NextRequest, ctx: RouteContext<'/api/reports/[id]'>) {
  const { id } = await ctx.params
  const body = await req.json()

  // Allow updating line items (treatment, qbo fields, memo)
  if (body.lineItemUpdates) {
    for (const update of body.lineItemUpdates as Array<{ id: string; [k: string]: unknown }>) {
      const { id: itemId, ...fields } = update
      await db.from('line_items').update(fields).eq('id', itemId)
    }
  }

  // Allow updating upload status
  if (body.status) {
    await db.from('pdf_uploads').update({ status: body.status }).eq('id', id)
  }

  await db.from('audit_logs').insert({
    upload_id: id,
    event_type: 'manual_edit',
    payload: body,
  })

  return Response.json({ ok: true })
}
