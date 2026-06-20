import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getValidAccessToken, QboAuthError } from '@/lib/qbo-auth'

export const dynamic = 'force-dynamic'

const QBO_API_BASE = {
  sandbox: 'https://sandbox-quickbooks.api.intuit.com/v3/company',
  production: 'https://quickbooks.api.intuit.com/v3/company',
}

interface QboFaultError {
  Message: string
  Detail?: string
  code?: string
  element?: string
}

function parseQboFault(body: unknown): string {
  try {
    const fault = (body as Record<string, unknown>)?.Fault as Record<string, unknown> | undefined
    const errors = fault?.Error as QboFaultError[] | undefined
    if (errors?.length) {
      return errors.map((e) => `[${e.code ?? '?'}] ${e.Message}${e.Detail ? ` — ${e.Detail}` : ''}`).join('; ')
    }
  } catch { /* ignore */ }
  return JSON.stringify(body)
}

// Strip internal _meta fields and clean up null refs before sending to QBO
function sanitizePayload(proposed: Record<string, unknown>): Record<string, unknown> {
  const lines = (proposed.Line as Record<string, unknown>[]).map((line) => {
    const { _meta, ...rest } = line
    void _meta
    const detail = rest.JournalEntryLineDetail as Record<string, unknown>
    // Remove null/undefined optional fields QBO doesn't accept
    if (detail.ClassRef == null) delete detail.ClassRef
    return rest
  })
  const { _warnings, _summary, ...payload } = proposed
  void _warnings; void _summary
  return { ...payload, Line: lines }
}

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params

  // Load the proposed JE payload
  const { data: push } = await db
    .from('qbo_pushes')
    .select('*')
    .eq('upload_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!push?.proposed_payload) {
    return Response.json({ error: 'No proposed Journal Entry found. Generate a preview first.' }, { status: 404 })
  }

  if (push.status === 'pushed') {
    return Response.json({ error: 'This report has already been pushed to QuickBooks.', qboTransactionId: push.qbo_transaction_id }, { status: 409 })
  }

  // Block if any line still needs a QBO account
  const proposed = push.proposed_payload as Record<string, unknown>
  const lines = proposed.Line as Record<string, unknown>[]
  const unmapped = lines.filter((l) => {
    const meta = l._meta as Record<string, unknown> | undefined
    return meta?.needsQboAccount && !meta?.isBalancingLine
  })
  if (unmapped.length > 0) {
    return Response.json({
      error: `${unmapped.length} line(s) are missing a QBO account. Assign all accounts before pushing.`,
    }, { status: 422 })
  }

  const missingVendor = lines.filter((l) => {
    const meta = l._meta as Record<string, unknown> | undefined
    return meta?.needsQboVendor
  })
  if (missingVendor.length > 0) {
    return Response.json({
      error: 'The balancing account is Accounts Payable, so a Vendor must be selected in Settings before pushing.',
    }, { status: 422 })
  }

  // Get a valid (auto-refreshed) access token
  let auth: { accessToken: string; realmId: string; environment: string }
  try {
    auth = await getValidAccessToken()
  } catch (e) {
    if (e instanceof QboAuthError) {
      return Response.json({ error: e.message, code: e.code }, { status: 401 })
    }
    throw e
  }

  const baseUrl = QBO_API_BASE[auth.environment as keyof typeof QBO_API_BASE] ?? QBO_API_BASE.sandbox
  const url = `${baseUrl}/${auth.realmId}/journalentry`
  const body = sanitizePayload(proposed)

  const qboRes = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })

  const intuitTid = qboRes.headers.get('intuit_tid') ?? null
  const responseBody = await qboRes.json()

  if (!qboRes.ok) {
    const errorMessage = parseQboFault(responseBody)

    await db.from('qbo_pushes').update({
      status: 'error',
      qbo_response: responseBody,
      intuit_tid: intuitTid,
    }).eq('upload_id', id)

    await db.from('audit_logs').insert({
      upload_id: id,
      event_type: 'qbo_push_error',
      payload: { httpStatus: qboRes.status, intuitTid, error: errorMessage, response: responseBody },
    })

    return Response.json({
      error: `QBO rejected the Journal Entry: ${errorMessage}`,
      httpStatus: qboRes.status,
      intuitTid,
      qboResponse: responseBody,
    }, { status: 422 })
  }

  const txnId = (responseBody?.JournalEntry?.Id as string) ?? null

  await db.from('qbo_pushes').update({
    status: 'pushed',
    qbo_response: responseBody,
    qbo_transaction_id: txnId,
    intuit_tid: intuitTid,
    pushed_at: new Date().toISOString(),
  }).eq('upload_id', id)

  await db.from('pdf_uploads').update({ status: 'pushed' }).eq('id', id)

  await db.from('audit_logs').insert({
    upload_id: id,
    event_type: 'qbo_push_success',
    payload: { txnId, intuitTid, environment: auth.environment },
  })

  return Response.json({ ok: true, qboTransactionId: txnId, intuitTid, environment: auth.environment })
}
