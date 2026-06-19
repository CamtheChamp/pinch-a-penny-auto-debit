import { db } from '@/lib/db'
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
  const query = encodeURIComponent("select Id, Name, AccountType, AccountSubType, FullyQualifiedName from Account where Active = true ORDERBY FullyQualifiedName")
  const url = `${base}/${auth.realmId}/query?query=${query}&minorversion=65`

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      Accept: 'application/json',
    },
  })

  if (!res.ok) {
    const body = await res.text()
    return Response.json({ error: `QBO accounts fetch failed: ${body}` }, { status: res.status })
  }

  const data = await res.json()
  const accounts = (data?.QueryResponse?.Account ?? []) as Array<{
    Id: string
    Name: string
    AccountType: string
    AccountSubType: string
    FullyQualifiedName: string
  }>

  return Response.json(accounts.map((a) => ({
    id: a.Id,
    name: a.Name,
    fullName: a.FullyQualifiedName,
    type: a.AccountType,
    subType: a.AccountSubType,
  })))
}
