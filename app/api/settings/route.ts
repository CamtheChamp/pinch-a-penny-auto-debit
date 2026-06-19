import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data } = await db.from('app_settings').select('key, value')
  const settings: Record<string, unknown> = {}
  for (const row of data ?? []) {
    settings[row.key] = row.value
  }
  return Response.json(settings)
}

export async function PUT(req: NextRequest) {
  const body = await req.json() as Record<string, unknown>
  const updates = Object.entries(body).map(([key, value]) => ({
    key,
    value,
    updated_at: new Date().toISOString(),
  }))
  const { error } = await db.from('app_settings').upsert(updates, { onConflict: 'key' })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
