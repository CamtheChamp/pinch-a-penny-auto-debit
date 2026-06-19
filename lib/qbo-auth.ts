import { db } from '@/lib/db'

const CLIENT_ID = process.env.QBO_CLIENT_ID!
const CLIENT_SECRET = process.env.QBO_CLIENT_SECRET!
const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'

interface QboConnection {
  realm_id: string
  access_token: string
  refresh_token: string
  expires_at: string
  refresh_expires_at: string
  environment: string
}

export class QboAuthError extends Error {
  constructor(public code: 'no_connection' | 'refresh_token_expired' | 'refresh_failed', message: string) {
    super(message)
  }
}

export async function getValidAccessToken(): Promise<{ accessToken: string; realmId: string; environment: string }> {
  const { data: conn } = await db
    .from('qbo_connections')
    .select('*')
    .limit(1)
    .single<QboConnection>()

  if (!conn) throw new QboAuthError('no_connection', 'No QBO connection found. Connect via Settings.')

  // If refresh token is expired, user must reconnect — nothing we can do automatically
  if (new Date(conn.refresh_expires_at) <= new Date()) {
    throw new QboAuthError('refresh_token_expired', 'QBO refresh token expired. Please reconnect via Settings.')
  }

  // Access token still valid — use it
  if (new Date(conn.expires_at) > new Date(Date.now() + 60_000)) {
    return { accessToken: conn.access_token, realmId: conn.realm_id, environment: conn.environment }
  }

  // Access token expired — refresh it
  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: conn.refresh_token,
    }),
  })

  if (!res.ok) {
    const detail = await res.text()
    throw new QboAuthError('refresh_failed', `Token refresh failed: ${detail}`)
  }

  const tokens = await res.json()
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
  const refreshExpiresAt = new Date(Date.now() + tokens.x_refresh_token_expires_in * 1000).toISOString()

  await db.from('qbo_connections').update({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: expiresAt,
    refresh_expires_at: refreshExpiresAt,
    updated_at: new Date().toISOString(),
  }).eq('realm_id', conn.realm_id)

  return { accessToken: tokens.access_token, realmId: conn.realm_id, environment: conn.environment }
}
