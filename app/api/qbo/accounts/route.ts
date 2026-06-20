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

  type QboAccountRecord = {
    Id: string
    Name: string
    AccountType: string
    AccountSubType: string
    FullyQualifiedName: string
    AcctNum?: string
  }

  const PAGE_SIZE = 1000
  const allAccounts: QboAccountRecord[] = []
  let startPosition = 1

  while (true) {
    const query = encodeURIComponent(
      `select Id, Name, AccountType, AccountSubType, FullyQualifiedName, AcctNum from Account where Active = true ORDERBY FullyQualifiedName STARTPOSITION ${startPosition} MAXRESULTS ${PAGE_SIZE}`
    )
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
    const page = (data?.QueryResponse?.Account ?? []) as QboAccountRecord[]
    allAccounts.push(...page)

    if (page.length < PAGE_SIZE) break
    startPosition += PAGE_SIZE
  }

  return Response.json(allAccounts.map((a) => ({
    id: a.Id,
    name: a.Name,
    fullName: a.FullyQualifiedName,
    type: a.AccountType,
    subType: a.AccountSubType,
    acctNum: a.AcctNum ?? null,
  })))
}
