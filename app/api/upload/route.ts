import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'
import { db } from '@/lib/db'
import { extractPdfText } from '@/lib/pdf-extract'
import { parseReport } from '@/lib/parser'
import { sameReportDate } from '@/lib/report-dates'

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const file = form.get('file')
  if (!file || typeof file === 'string') {
    return Response.json({ error: 'No file provided' }, { status: 400 })
  }

  const fileName = (file as File).name
  const buffer = await (file as File).arrayBuffer()

  let rawText: string
  try {
    rawText = await extractPdfText(buffer)
  } catch (e) {
    return Response.json({ error: 'PDF extraction failed', detail: String(e) }, { status: 422 })
  }

  const parsed = parseReport(rawText)

  // Duplicate check — reject if this report number is already in the DB
  if (parsed.header?.reportNumber) {
    const { data: existingHeaders } = await db
      .from('report_headers')
      .select('upload_id, run_date')
      .eq('report_number', parsed.header.reportNumber)
    const existing = existingHeaders?.find((h: { upload_id: string; run_date: string | null }) =>
      sameReportDate(h.run_date, parsed.header?.runDate)
    )
    if (existing) {
      return Response.json({
        error: `Report ${parsed.header.reportNumber} (run ${parsed.header.runDate}) has already been uploaded.`,
        duplicateUploadId: existing.upload_id,
      }, { status: 409 })
    }
  }

  // Detect carry-forward prerequisite date from any RU row
  const cfItem = parsed.lineItems.find((i) => i.isCarryForward && i.priorReportDate)
  const prerequisiteDate = cfItem?.priorReportDate ?? null

  // Check if the prerequisite PDF is already uploaded
  let prerequisiteUploadId: string | null = null
  if (prerequisiteDate) {
    const { data: priorHeaders } = await db
      .from('report_headers')
      .select('upload_id, run_date')

    const prior = priorHeaders?.find((h: { upload_id: string; run_date: string | null }) =>
      sameReportDate(h.run_date, prerequisiteDate)
    )
    prerequisiteUploadId = prior?.upload_id ?? null
  }

  // Insert upload record
  const { data: upload, error: uploadErr } = await db
    .from('pdf_uploads')
    .insert({
      file_name: fileName,
      raw_text: rawText,
      parse_errors: parsed.parseErrors,
      status: 'parsed',
      prerequisite_date: prerequisiteDate,
      prerequisite_upload_id: prerequisiteUploadId,
    })
    .select()
    .single()

  if (uploadErr || !upload) {
    return Response.json({ error: 'DB insert failed', detail: uploadErr?.message }, { status: 500 })
  }

  const uploadId = upload.id

  // Insert header
  if (parsed.header) {
    await db.from('report_headers').insert({
      upload_id: uploadId,
      report_number: parsed.header.reportNumber,
      run_date: parsed.header.runDate,
      run_time: parsed.header.runTime,
      customer_name: parsed.header.customerName,
      page_number: parsed.header.pageNumber,
    })

    // Now that this report is in the system, resolve any uploads that were waiting for it
    if (parsed.header.runDate) {
      const { data: waiting } = await db
        .from('pdf_uploads')
        .select('id, prerequisite_date')
        .is('prerequisite_upload_id', null)
      const resolvedWaiting = waiting?.filter((r: { id: string; prerequisite_date: string | null }) =>
        sameReportDate(r.prerequisite_date, parsed.header?.runDate)
      ) ?? []
      if (resolvedWaiting.length) {
        await db
          .from('pdf_uploads')
          .update({ prerequisite_upload_id: uploadId })
          .in('id', resolvedWaiting.map((r: { id: string }) => r.id))
      }
    }
  }

  // Fetch accounting mappings for auto-assignment
  const { data: mappings } = await db
    .from('accounting_mappings')
    .select('*')
    .order('priority', { ascending: false })

  // Insert line items
  if (parsed.lineItems.length > 0) {
    const rows = parsed.lineItems.map((item, idx) => {
      const mapping = mappings ? findMapping(item, mappings) : null
      return {
        upload_id: uploadId,
        sort_order: idx,
        customer_number: item.customerNumber,
        remarks: item.remarks,
        doc_type: item.docType,
        doc_number: item.docNumber,
        payment_term: item.paymentTerm,
        invoice_date: item.invoiceDate,
        due_date: item.dueDate,
        discount_due_date: item.discountDueDate,
        open_amount: item.openAmount,
        discount_available: item.discountAvailable,
        net_amount_due: item.netAmountDue,
        raw_text: item.rawText,
        row_category: item.rowCategory,
        is_carry_forward: item.isCarryForward,
        prior_report_date: item.priorReportDate,
        warnings: item.warnings,
        qbo_account_id: mapping?.qbo_account_id ?? null,
        qbo_account_name: mapping?.qbo_account_name ?? null,
        qbo_class_id: mapping?.qbo_class_id ?? null,
        qbo_memo: mapping?.default_memo ?? null,
        treatment: item.isCarryForward ? 'carry_forward' : (mapping?.treatment ?? 'include'),
      }
    })
    await db.from('line_items').insert(rows)
  }

  // Insert customer total + validation
  if (parsed.customerTotal) {
    const v = parsed.validation
    await db.from('customer_totals').insert({
      upload_id: uploadId,
      open_amount: parsed.customerTotal.openAmount,
      discount_available: parsed.customerTotal.discountAvailable,
      net_amount_due: parsed.customerTotal.netAmountDue,
      raw_text: parsed.customerTotal.rawText,
      open_amount_match: v?.openAmountMatch ?? null,
      discount_match: v?.discountMatch ?? null,
      net_amount_match: v?.netAmountMatch ?? null,
      open_amount_diff: v?.openAmountDiff ?? null,
      discount_diff: v?.discountDiff ?? null,
      net_amount_diff: v?.netAmountDiff ?? null,
    })
  }

  // Audit log
  await db.from('audit_logs').insert({
    upload_id: uploadId,
    event_type: 'upload',
    payload: {
      fileName,
      lineItemCount: parsed.lineItems.length,
      errors: parsed.parseErrors,
      prerequisiteDate,
      prerequisiteMet: !!prerequisiteUploadId,
    },
  })

  return Response.json({
    uploadId,
    prerequisiteDate,
    prerequisiteMet: prerequisiteDate ? !!prerequisiteUploadId : true,
  })
}

interface Mapping {
  match_type: string
  match_field: string
  match_value: string
  qbo_account_id: string | null
  qbo_account_name: string | null
  qbo_class_id: string | null
  default_memo: string | null
  treatment: string
}

function findMapping(
  item: { remarks: string; docType: string; docNumber: string },
  mappings: Mapping[]
): Mapping | null {
  for (const m of mappings) {
    const field =
      m.match_field === 'remarks'
        ? item.remarks
        : m.match_field === 'doc_type'
        ? item.docType
        : item.docNumber

    let matched = false
    if (m.match_type === 'exact') {
      matched = field.toUpperCase() === m.match_value.toUpperCase()
    } else if (m.match_type === 'contains') {
      matched = field.toUpperCase().includes(m.match_value.toUpperCase())
    } else if (m.match_type === 'regex') {
      try {
        matched = new RegExp(m.match_value, 'i').test(field)
      } catch {
        /* invalid regex */
      }
    }
    if (matched) return m
  }
  return null
}
