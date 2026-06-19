import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

const CLIENT_ID = process.env.QBO_CLIENT_ID!
const REDIRECT_URI = process.env.QBO_REDIRECT_URI!
const SCOPE = 'com.intuit.quickbooks.accounting'
const AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2'

export async function GET(_req: NextRequest) {
  const state = crypto.randomUUID()
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPE,
    state,
  })
  return Response.redirect(`${AUTH_URL}?${params}`)
}
