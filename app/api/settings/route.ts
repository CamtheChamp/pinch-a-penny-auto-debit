import type { NextRequest } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const db = await getServerSupabase()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await db.from('app_settings').select('key, value').eq('user_id', user.id)
  const settings: Record<string, unknown> = {}
  for (const row of data ?? []) {
    settings[row.key] = row.value
  }
  return Response.json(settings)
}

export async function PUT(req: NextRequest) {
  const db = await getServerSupabase()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as Record<string, unknown>
  const updates = Object.entries(body).map(([key, value]) => ({
    user_id: user.id,
    key,
    value,
    updated_at: new Date().toISOString(),
  }))
  const { error } = await db.from('app_settings').upsert(updates, { onConflict: 'user_id,key' })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
