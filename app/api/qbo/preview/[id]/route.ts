import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { resolvePrerequisiteChain } from '@/lib/report-chain'

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

function buildJeLine(
  item: LineItemRow,
  idx: number,
  sourceReport: 'prerequisite' | 'current',
  sourceInfo?: { uploadId: string; runDate: string | null; reportNumber: string | null },
) {
  const net = item.net_amount_due ?? item.open_amount ?? 0
  const postingType = net >= 0 ? 'Debit' : 'Credit'
  return {
    Id: String(idx + 1),
    Description: item.remarks,
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
      sourceUploadId: sourceInfo?.uploadId,
      sourceRunDate: sourceInfo?.runDate,
      sourceReportNumber: sourceInfo?.reportNumber,
    },
  }
}

// Builds a proposed QBO Journal Entry payload for review.
// One JE per bank charge: positive PDFs absorb their prerequisite (negative) PDF's lines.
// Negative PDFs never generate their own JE — return 422 if one is requested.
// Does NOT post to QuickBooks — posting requires a separate confirmed step.
export async function GET(_req: NextRequest, ctx: RouteContext<'/api/qbo/preview/[id]'>) {
  const { id } = await ctx.params

  const [uploadRes, itemsRes, totalRes, headerRes, bankSettingRes, apVendorSettingRes] = await Promise.all([
    db.from('pdf_uploads').select('*').eq('id', id).single(),
    db.from('line_items').select('*').eq('upload_id', id).order('sort_order'),
    db.from('customer_totals').select('*').eq('upload_id', id).single(),
    db.from('report_headers').select('*').eq('upload_id', id).single(),
    db.from('app_settings').select('value').eq('key', 'bank_account').single(),
    db.from('app_settings').select('value').eq('key', 'ap_vendor').single(),
  ])

  const bankAccount = bankSettingRes.data?.value as { id: string; name: string; type?: string } | null ?? null
  const apVendor = apVendorSettingRes.data?.value as { id: string; name: string } | null ?? null

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

  const prerequisiteChain = await resolvePrerequisiteChain(upload)

  // Block if any prerequisite PDF in the carry-forward chain hasn't been uploaded yet
  if (prerequisiteChain.unresolvedDate) {
    return Response.json({
      error: `Prerequisite report from ${prerequisiteChain.unresolvedDate} has not been uploaded. Upload that PDF first.`,
      prerequisiteDate: prerequisiteChain.unresolvedDate,
    }, { status: 422 })
  }

  if (prerequisiteChain.cycleDetected) {
    return Response.json({
      error: 'A circular prerequisite link was detected. Cannot build Journal Entry until the report chain is corrected.',
    }, { status: 422 })
  }

  // Block if this report's totals don't validate
  if (total && (!total.open_amount_match || !total.discount_match || !total.net_amount_match)) {
    return Response.json({
      error: 'Total validation failed — line item sums do not match customer total. Cannot build Journal Entry.',
      validation: { openAmountMatch: total.open_amount_match, discountMatch: total.discount_match, netAmountMatch: total.net_amount_match },
    }, { status: 422 })
  }

  const prerequisiteReports: Array<{
    upload: { id: string; file_name: string }
    header: { report_number: string | null; run_date: string | null } | null
    items: LineItemRow[]
  }> = []

  for (const chainReport of prerequisiteChain.reports) {
    const [itemsRes, totalRes] = await Promise.all([
      db.from('line_items').select('*').eq('upload_id', chainReport.upload.id).order('sort_order'),
      db.from('customer_totals').select('*').eq('upload_id', chainReport.upload.id).single(),
    ])

    const chainTotal = totalRes.data
    if (chainTotal && (!chainTotal.open_amount_match || !chainTotal.discount_match || !chainTotal.net_amount_match)) {
      return Response.json({
        error: `Prerequisite report (${chainReport.header?.run_date ?? chainReport.upload.prerequisite_date ?? chainReport.upload.file_name}) has not passed validation. Resolve it before building this Journal Entry.`,
      }, { status: 422 })
    }

    prerequisiteReports.push({
      ...chainReport,
      items: (itemsRes.data ?? []) as LineItemRow[],
    })
  }

  // Build JE lines:
  //   1. Real lines from every prerequisite PDF, oldest to newest
  //   2. Lines from this (positive) PDF — non-ignored, carry-forward rows excluded
  //      (carry-forward RU rows are replaced by the actual prerequisite chain lines above)
  //
  // Convention: positive net → Debit, negative net → Credit
  // Balancing line → Credit to bank/AP for the positive PDF's customer total (= actual bank charge)

  const activePrereqItems = prerequisiteReports.flatMap((report) =>
    report.items
      .filter(i => i.treatment !== 'ignore' && !i.is_carry_forward)
      .map((item) => ({
        item,
        sourceInfo: {
          uploadId: report.upload.id,
          runDate: report.header?.run_date ?? null,
          reportNumber: report.header?.report_number ?? null,
        },
      }))
  )
  const activeCurrentItems = items.filter(i => i.treatment !== 'ignore' && !i.is_carry_forward)

  const prereqLines = activePrereqItems.map(({ item, sourceInfo }, idx) => buildJeLine(item, idx, 'prerequisite', sourceInfo))
  const currentLines = activeCurrentItems.map((item, idx) =>
    buildJeLine(item, prereqLines.length + idx, 'current')
  )
  const jeLines = [...prereqLines, ...currentLines]

  // Balancing line: Credit to bank for the positive PDF's net (= the actual ACH debit amount)
  const bankAccountNeedsVendor = !!bankAccount && (
    bankAccount.type === 'Accounts Payable' ||
    bankAccount.name.toLowerCase().includes('accounts payable')
  )

  const balancingLineDetail: Record<string, unknown> = {
    PostingType: netAmountDue >= 0 ? 'Credit' : 'Debit',
    AccountRef: bankAccount ? { value: bankAccount.id, name: bankAccount.name } : null,
  }

  if (bankAccountNeedsVendor && apVendor) {
    balancingLineDetail.Entity = {
      Type: 'Vendor',
      EntityRef: { value: apVendor.id, name: apVendor.name },
    }
  }

  const balancingLine = {
    Id: String(jeLines.length + 1),
    Description: `Preauthorized debit — ${header?.report_number ?? ''} run ${header?.run_date ?? ''}`,
    Amount: Math.abs(netAmountDue),
    DetailType: 'JournalEntryLineDetail',
    JournalEntryLineDetail: balancingLineDetail,
    _meta: { isBalancingLine: true, needsQboAccount: !bankAccount, needsQboVendor: bankAccountNeedsVendor && !apVendor },
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

  const unmappedCount =
    activePrereqItems.filter(({ item }) => !item.qbo_account_id).length +
    activeCurrentItems.filter(i => !i.qbo_account_id).length

  const prerequisiteSummaries = prerequisiteReports.map((report) => ({
    uploadId: report.upload.id,
    fileName: report.upload.file_name,
    reportNumber: report.header?.report_number ?? null,
    runDate: report.header?.run_date ?? null,
  }))

  const includedReportNumbers = prerequisiteSummaries
    .map((report) => report.reportNumber)
    .filter(Boolean)

  const includesReports = includedReportNumbers.length
    ? `${header?.report_number ?? ''} + ${includedReportNumbers.join(' + ')}`
    : (header?.report_number ?? '')

  const { data: connection } = await db
    .from('qbo_connections')
    .select('environment')
    .limit(1)
    .maybeSingle()

  const environment = connection?.environment ?? process.env.QBO_ENVIRONMENT ?? 'sandbox'

  const journalEntry = {
    TxnDate: txnDate,
    DocNumber: header?.report_number,
    PrivateNote: `Pinch A Penny ${header?.customer_name ?? '#144'} — Bank Charge ${header?.run_date} | Reports: ${includesReports}`,
    Line: [...jeLines, balancingLine],
    _warnings: [
      ...(unmappedCount > 0 ? [`${unmappedCount} line(s) are missing a QBO account — assign accounts before posting`] : []),
      ...(!bankAccount ? ['Set a Bank / AP account in Settings before pushing'] : []),
      ...(bankAccountNeedsVendor && !apVendor ? ['Set an AP Vendor in Settings before pushing to an Accounts Payable account'] : []),
    ],
    _summary: {
      reportNumber: header?.report_number,
      runDate: header?.run_date,
      totalNetAmountDue: netAmountDue,
      lineCount: jeLines.length,
      includesPrerequisiteReport: prerequisiteSummaries.length > 0,
      prerequisiteReportNumber: prerequisiteSummaries.at(-1)?.reportNumber ?? null,
      prerequisiteReports: prerequisiteSummaries,
    },
    _environment: environment,
  }

  const pendingPush = {
    upload_id: id,
    environment,
    proposed_payload: journalEntry,
    status: 'pending',
  }

  const { data: existingPush, error: existingPushError } = await db
    .from('qbo_pushes')
    .select('id')
    .eq('upload_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingPushError) {
    return Response.json({
      error: 'Journal Entry preview was built, but the saved proposal could not be checked. Try preview again before pushing.',
      detail: existingPushError.message,
    }, { status: 500 })
  }

  const saveResult = existingPush
    ? await db.from('qbo_pushes').update(pendingPush).eq('id', existingPush.id)
    : await db.from('qbo_pushes').insert(pendingPush)

  if (saveResult.error) {
    return Response.json({
      error: 'Journal Entry preview was built, but the saved proposal could not be stored. Try preview again before pushing.',
      detail: saveResult.error.message,
    }, { status: 500 })
  }

  return Response.json(journalEntry)
}
