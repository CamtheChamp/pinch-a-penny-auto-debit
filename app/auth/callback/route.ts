import type { NextRequest } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const FAILSAFE_OWNER_EMAIL = 'pcameronwhite@gmail.com'

function isAllowed(email: string): boolean {
  const raw = process.env.ALLOWED_EMAILS
  const allowed = (raw && raw.trim().length > 0)
    ? raw.split(',').map((e) => e.trim().toLowerCase())
    : [FAILSAFE_OWNER_EMAIL.toLowerCase()]
  return allowed.includes(email.toLowerCase())
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const origin = req.nextUrl.origin

  if (!code) {
    return Response.redirect(`${origin}/login?error=not_authorized`)
  }

  const supabase = await getServerSupabase()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user?.email) {
    return Response.redirect(`${origin}/login?error=not_authorized`)
  }

  if (!isAllowed(data.user.email)) {
    await supabase.auth.signOut()
    return Response.redirect(`${origin}/login?error=not_authorized`)
  }

  return Response.redirect(`${origin}/reports`)
}
