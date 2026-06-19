import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'
import { db } from '@/lib/db'

export async function PUT(req: NextRequest, ctx: RouteContext<'/api/mappings/[id]'>) {
  const { id } = await ctx.params
  const body = await req.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from('accounting_mappings')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<'/api/mappings/[id]'>) {
  const { id } = await ctx.params
  const { error } = await db.from('accounting_mappings').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
