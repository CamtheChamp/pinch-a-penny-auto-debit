import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

const CLIENT_ID = process.env.QBO_CLIENT_ID!
const REDIRECT_URI = process.env.QBO_REDIRECT_URI!
const SCOPE = 'com.intuit.quickbooks.accounting'
const AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2'

export async function GET(_req: NextRequest) {
  const state = crypto.randomUUID()

  // Store state in a short-lived cookie for CSRF validation on callback
  const cookieStore = await cookies()
  cookieStore.set('qbo_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  })

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPE,
    state,
  })
  return Response.redirect(`${AUTH_URL}?${params}`)
}
