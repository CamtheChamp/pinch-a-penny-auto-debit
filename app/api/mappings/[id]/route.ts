import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'
import { getServerSupabase } from '@/lib/supabase-server'

export async function PUT(req: NextRequest, ctx: RouteContext<'/api/mappings/[id]'>) {
  const { id } = await ctx.params
  const db = await getServerSupabase()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from('accounting_mappings')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<'/api/mappings/[id]'>) {
  const { id } = await ctx.params
  const db = await getServerSupabase()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await db.from('accounting_mappings').delete().eq('id', id).eq('user_id', user.id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
