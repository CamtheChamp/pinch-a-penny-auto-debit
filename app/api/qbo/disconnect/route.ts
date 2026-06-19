import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST() {
  await db.from('qbo_connections').delete().neq('realm_id', '')
  return Response.json({ ok: true })
}
