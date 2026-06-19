import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data } = await db
    .from('qbo_connections')
    .select('realm_id, expires_at, environment')
    .limit(1)
    .single()

  if (!data) return Response.json({ connected: false })

  return Response.json({
    connected: true,
    realmId: data.realm_id,
    expiresAt: data.expires_at,
    environment: data.environment,
  })
}
