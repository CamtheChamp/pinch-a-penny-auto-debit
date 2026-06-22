import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Fresh client per call — never cache at module scope. Vercel Fluid Compute
// reuses function instances across concurrent requests, so a cached
// authenticated client could leak one user's session into another's
// concurrent request on the same warm instance.
export async function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase env vars not set: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required')

  const cookieStore = await cookies()

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // setAll called from a Server Component render — middleware refreshes
          // the session instead, so this is safe to ignore.
        }
      },
    },
  })
}
