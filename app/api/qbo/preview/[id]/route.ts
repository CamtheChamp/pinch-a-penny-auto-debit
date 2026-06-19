import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Builds a proposed QBO Journal Entry payload for review.
// Does NOT post to QuickBooks — sandbox/production posting requires a separate confirmed step.
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

  // Block if prerequisite PDF hasn't been uploaded yet
  if (upload.prerequisite_date && !upload.prerequisite_upload_id) {
    return Response.json({
      error: `Prerequisite report from ${upload.prerequisite_date} has not been uploaded. Upload that PDF first.`,
      prerequisiteDate: upload.prerequisite_date,
    }, { status: 422 })
  }

  // Block if totals don't validate
  if (total && (!total.open_amount_match || !total.discount_match || !total.net_amount_match)) {
    return Response.json({
      error: 'Total validation failed — line item sums do not match customer total. Cannot build Journal Entry.',
      validation: { openAmountMatch: total.open_amount_match, discountMatch: total.discount_match, netAmountMatch: total.net_amount_match },
    }, { status: 422 })
  }

  // Build Journal Entry lines
  // Convention:
  //   expense/needs_review rows with positive net  → Debit  (money going out)
  //   credit/rebate rows with negative net         → Credit (reduces the debit)
  //   carry_forward rows with negative net         → Credit (prior balance carried forward)
  //   The balancing line                           → Credit to bank/AP (total net amount debited)
  //
  // QBO JE lines must balance: sum(Debit amounts) == sum(Credit amounts)

  const activeItems = items.filter((i) => i.treatment !== 'ignore')

  const jeLines = activeItems.map((item, idx) => {
    const net = item.net_amount_due ?? item.open_amount ?? 0
    // Negative net = credit side (rebate, carry-forward); positive net = debit side
    const postingType = net >= 0 ? 'Debit' : 'Credit'
    const amount = Math.abs(net)

    return {
      Id: String(idx + 1),
      Description: item.qbo_memo ?? item.remarks,
      Amount: amount,
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
      },
    }
  })

  // Balancing line: Credit to bank/AP for the total net amount debited
  const netAmountDue = total?.net_amount_due ?? 0
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

  const unmappedCount = activeItems.filter((i) => !i.qbo_account_id).length

  const journalEntry = {
    TxnDate: txnDate,
    DocNumber: header?.report_number,
    PrivateNote: `Pinch A Penny ${header?.customer_name ?? '#144'} — Preauthorized Debit ${header?.report_number} run ${header?.run_date}`,
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
      prerequisiteMet: !upload.prerequisite_date || !!upload.prerequisite_upload_id,
    },
  }

  // Persist the proposed payload
  await db.from('qbo_pushes').upsert({
    upload_id: id,
    environment: 'sandbox',
    proposed_payload: journalEntry,
    status: 'pending',
  }, { onConflict: 'upload_id' })

  return Response.json(journalEntry)
}

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
