import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'
import { getServerSupabase } from '@/lib/supabase-server'

export async function GET() {
  const db = await getServerSupabase()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await db
    .from('accounting_mappings')
    .select('*')
    .eq('user_id', user.id)
    .order('priority', { ascending: false })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(req: NextRequest) {
  const db = await getServerSupabase()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { data, error } = await db
    .from('accounting_mappings')
    .insert({ ...body, user_id: user.id })
    .select()
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}
