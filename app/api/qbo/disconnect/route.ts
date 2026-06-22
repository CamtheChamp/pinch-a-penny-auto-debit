import { getServerSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function POST() {
  const supabase = await getServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await supabase.from('qbo_connections').delete().eq('user_id', user.id)
  return Response.json({ ok: true })
}
