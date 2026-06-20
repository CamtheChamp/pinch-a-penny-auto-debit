import { getValidAccessToken, QboAuthError } from '@/lib/qbo-auth'

export const dynamic = 'force-dynamic'

const QBO_API_BASE = {
  sandbox: 'https://sandbox-quickbooks.api.intuit.com/v3/company',
  production: 'https://quickbooks.api.intuit.com/v3/company',
}

export async function GET() {
  let auth: { accessToken: string; realmId: string; environment: string }
  try {
    auth = await getValidAccessToken()
  } catch (e) {
    if (e instanceof QboAuthError) {
      return Response.json({ error: e.message, code: e.code }, { status: 401 })
    }
    throw e
  }

  const base = QBO_API_BASE[auth.environment as keyof typeof QBO_API_BASE] ?? QBO_API_BASE.sandbox
  const query = encodeURIComponent('select Id, DisplayName, Active from Vendor where Active = true ORDERBY DisplayName maxresults 100')
  const url = `${base}/${auth.realmId}/query?query=${query}&minorversion=75`

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      Accept: 'application/json',
    },
  })

  if (!res.ok) {
    const body = await res.text()
    return Response.json({ error: `QBO vendors fetch failed: ${body}` }, { status: res.status })
  }

  const data = await res.json()
  const vendors = (data?.QueryResponse?.Vendor ?? []) as Array<{
    Id: string
    DisplayName: string
  }>

  return Response.json(vendors.map((v) => ({
    id: v.Id,
    name: v.DisplayName,
  })))
}
