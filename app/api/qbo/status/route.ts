import { getServerSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await getServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('qbo_connections')
    .select('realm_id, expires_at, environment')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!data) return Response.json({ connected: false })

  return Response.json({
    connected: true,
    realmId: data.realm_id,
    expiresAt: data.expires_at,
    environment: data.environment,
  })
}
