import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'
import { db } from '@/lib/db'

export async function GET() {
  const { data, error } = await db
    .from('accounting_mappings')
    .select('*')
    .order('priority', { ascending: false })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { data, error } = await db
    .from('accounting_mappings')
    .insert(body)
    .select()
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}
