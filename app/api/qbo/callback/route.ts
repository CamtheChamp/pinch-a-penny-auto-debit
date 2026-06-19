import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

const CLIENT_ID = process.env.QBO_CLIENT_ID!
const CLIENT_SECRET = process.env.QBO_CLIENT_SECRET!
const REDIRECT_URI = process.env.QBO_REDIRECT_URI!
const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const realmId = searchParams.get('realmId')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // CSRF: validate state matches what we set in the connect cookie
  const cookieStore = await cookies()
  const savedState = cookieStore.get('qbo_oauth_state')?.value
  cookieStore.delete('qbo_oauth_state')

  if (!savedState || savedState !== state) {
    return Response.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings?qbo=error&reason=${encodeURIComponent('csrf_mismatch')}`
    )
  }

  if (error || !code || !realmId) {
    return Response.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings?qbo=error&reason=${encodeURIComponent(error ?? 'missing_code')}`
    )
  }

  // Exchange authorization code for tokens
  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    }),
  })

  if (!tokenRes.ok) {
    const detail = await tokenRes.text()
    return Response.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings?qbo=error&reason=${encodeURIComponent(detail)}`
    )
  }

  const tokens = await tokenRes.json()
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
  const refreshExpiresAt = new Date(Date.now() + tokens.x_refresh_token_expires_in * 1000).toISOString()

  // Upsert into qbo_connections (single row, key = realm_id)
  await db.from('qbo_connections').upsert({
    realm_id: realmId,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: expiresAt,
    refresh_expires_at: refreshExpiresAt,
    environment: process.env.QBO_ENVIRONMENT ?? 'sandbox',
  }, { onConflict: 'realm_id' })

  return Response.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?qbo=connected`)
}
