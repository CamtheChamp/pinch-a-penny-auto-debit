import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface LineItemRow {
  id: string
  remarks: string
  doc_type: string
  doc_number: string
  net_amount_due: number | null
  open_amount: number | null
  treatment: string
  qbo_account_id: string | null
  qbo_account_name: string | null
  qbo_class_id: string | null
  qbo_memo: string | null
  is_carry_forward: boolean
}

function buildJeLine(item: LineItemRow, idx: number, sourceReport: 'prerequisite' | 'current') {
  const net = item.net_amount_due ?? item.open_amount ?? 0
  const postingType = net >= 0 ? 'Debit' : 'Credit'
  return {
    Id: String(idx + 1),
    Description: item.qbo_memo ?? item.remarks,
    Amount: Math.abs(net),
    DetailType: 'JournalEntryLineDetail',
    JournalEntryLineDetail: {
      PostingType: postingType,
      AccountRef: item.qbo_account_id
        ? { value: item.qbo_account_id, name: item.qbo_account_name ?? '' }
        : null,
      ClassRef: item.qbo_class_id ? { value: item.qbo_class_id } : undefined,
    },
    _meta: {
      lineItemId: item.id,
      docType: item.doc_type,
      docNumber: item.doc_number,
      treatment: item.treatment,
      needsQboAccount: !item.qbo_account_id,
      isCarryForward: item.is_carry_forward,
      sourceReport,
    },
  }
}

// Builds a proposed QBO Journal Entry payload for review.
// One JE per bank charge: positive PDFs absorb their prerequisite (negative) PDF's lines.
// Negative PDFs never generate their own JE — return 422 if one is requested.
// Does NOT post to QuickBooks — posting requires a separate confirmed step.
export async function GET(_req: NextRequest, ctx: RouteContext<'/api/qbo/preview/[id]'>) {
  const { id } = await ctx.params

  const [uploadRes, itemsRes, totalRes, headerRes] = await Promise.all([
    db.from('pdf_uploads').select('*').eq('id', id).single(),
    db.from('line_items').select('*').eq('upload_id', id).order('sort_order'),
    db.from('customer_totals').select('*').eq('upload_id', id).single(),
    db.from('report_headers').select('*').eq('upload_id', id).single(),
  ])

  if (uploadRes.error) return Response.json({ error: 'Upload not found' }, { status: 404 })

  const upload = uploadRes.data
  const items: LineItemRow[] = itemsRes.data ?? []
  const total = totalRes.data
  const header = headerRes.data

  // Block if this is a negative PDF — it has no bank charge; its lines belong to the positive PDF's JE
  const netAmountDue = total?.net_amount_due ?? 0
  const { data: downstream } = await db
    .from('pdf_uploads')
    .select('id')
    .eq('prerequisite_upload_id', id)
    .limit(1)
    .single()
  if (downstream || netAmountDue < 0) {
    return Response.json({
      error: 'This report has no bank charge. Its lines are included in the Journal Entry for the report that carries it forward.',
      isNegativeReport: true,
      appliedToUploadId: downstream?.id ?? null,
    }, { status: 422 })
  }

  // Block if prerequisite PDF hasn't been uploaded yet
  if (upload.prerequisite_date && !upload.prerequisite_upload_id) {
    return Response.json({
      error: `Prerequisite report from ${upload.prerequisite_date} has not been uploaded. Upload that PDF first.`,
      prerequisiteDate: upload.prerequisite_date,
    }, { status: 422 })
  }

  // Block if this report's totals don't validate
  if (total && (!total.open_amount_match || !total.discount_match || !total.net_amount_match)) {
    return Response.json({
      error: 'Total validation failed — line item sums do not match customer total. Cannot build Journal Entry.',
      validation: { openAmountMatch: total.open_amount_match, discountMatch: total.discount_match, netAmountMatch: total.net_amount_match },
    }, { status: 422 })
  }

  // Fetch prerequisite (negative) PDF data if present
  let prereqItems: LineItemRow[] = []
  let prereqHeader: { report_number: string | null; run_date: string | null } | null = null

  if (upload.prerequisite_upload_id) {
    const [prereqItemsRes, prereqTotalRes, prereqHeaderRes] = await Promise.all([
      db.from('line_items').select('*').eq('upload_id', upload.prerequisite_upload_id).order('sort_order'),
      db.from('customer_totals').select('*').eq('upload_id', upload.prerequisite_upload_id).single(),
      db.from('report_headers').select('report_number, run_date').eq('upload_id', upload.prerequisite_upload_id).single(),
    ])

    prereqItems = prereqItemsRes.data ?? []
    prereqHeader = prereqHeaderRes.data ?? null

    // Block if prerequisite report's totals didn't validate
    const prereqTotal = prereqTotalRes.data
    if (prereqTotal && (!prereqTotal.open_amount_match || !prereqTotal.discount_match || !prereqTotal.net_amount_match)) {
      return Response.json({
        error: `Prerequisite report (${prereqHeader?.run_date ?? upload.prerequisite_date}) has not passed validation. Resolve it before building this Journal Entry.`,
      }, { status: 422 })
    }
  }

  // Build JE lines:
  //   1. Lines from the prerequisite (negative) PDF — all non-ignored
  //   2. Lines from this (positive) PDF — non-ignored, carry-forward rows excluded
  //      (carry-forward RU rows are replaced by the actual prerequisite lines above)
  //
  // Convention: positive net → Debit, negative net → Credit
  // Balancing line → Credit to bank/AP for the positive PDF's customer total (= actual bank charge)

  const activePrereqItems = prereqItems.filter(i => i.treatment !== 'ignore')
  const activeCurrentItems = items.filter(i => i.treatment !== 'ignore' && !i.is_carry_forward)

  const prereqLines = activePrereqItems.map((item, idx) => buildJeLine(item, idx, 'prerequisite'))
  const currentLines = activeCurrentItems.map((item, idx) =>
    buildJeLine(item, prereqLines.length + idx, 'current')
  )
  const jeLines = [...prereqLines, ...currentLines]

  // Balancing line: Credit to bank for the positive PDF's net (= the actual ACH debit amount)
  const balancingLine = {
    Id: String(jeLines.length + 1),
    Description: `Preauthorized debit — ${header?.report_number ?? ''} run ${header?.run_date ?? ''}`,
    Amount: Math.abs(netAmountDue),
    DetailType: 'JournalEntryLineDetail',
    JournalEntryLineDetail: {
      PostingType: netAmountDue >= 0 ? 'Credit' : 'Debit',
      AccountRef: null, // TODO: set your bank/AP account here
    },
    _meta: { isBalancingLine: true, needsQboAccount: true },
  }

  // Parse run date into ISO format for QBO TxnDate
  let txnDate = header?.run_date ?? ''
  if (txnDate) {
    const parts = txnDate.split('/')
    if (parts.length === 3) {
      const [m, d, y] = parts
      const year = y.length === 2 ? `20${y}` : y
      txnDate = `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
  }

  const unmappedCount = [...activePrereqItems, ...activeCurrentItems].filter(i => !i.qbo_account_id).length

  const includesReports = prereqHeader
    ? `${header?.report_number ?? ''} + ${prereqHeader.report_number ?? ''}`
    : (header?.report_number ?? '')

  const journalEntry = {
    TxnDate: txnDate,
    DocNumber: header?.report_number,
    PrivateNote: `Pinch A Penny ${header?.customer_name ?? '#144'} — Bank Charge ${header?.run_date} | Reports: ${includesReports}`,
    Line: [...jeLines, balancingLine],
    _warnings: [
      ...(unmappedCount > 0 ? [`${unmappedCount} line(s) are missing a QBO account — assign accounts before posting`] : []),
      ...(!balancingLine.JournalEntryLineDetail.AccountRef ? ['Balancing line needs a bank/AP account assigned'] : []),
    ],
    _summary: {
      reportNumber: header?.report_number,
      runDate: header?.run_date,
      totalNetAmountDue: netAmountDue,
      lineCount: jeLines.length,
      includesPrerequisiteReport: !!prereqHeader,
      prerequisiteReportNumber: prereqHeader?.report_number ?? null,
    },
  }

  // Persist the proposed payload (keyed on this positive PDF's upload_id)
  await db.from('qbo_pushes').upsert({
    upload_id: id,
    environment: 'sandbox',
    proposed_payload: journalEntry,
    status: 'pending',
  }, { onConflict: 'upload_id' })

  return Response.json(journalEntry)
}
