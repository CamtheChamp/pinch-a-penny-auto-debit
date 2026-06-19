/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient, SupabaseClient } from '@supabase/supabase-js'

function createDb(): SupabaseClient<any, 'public', any> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase env vars not set: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required')
  return createClient<any>(url, key)
}

// Lazily initialized so build-time evaluation doesn't crash without env vars
let _db: SupabaseClient<any, 'public', any> | null = null

export function getDb(): SupabaseClient<any, 'public', any> {
  if (!_db) _db = createDb()
  return _db
}

// Convenience proxy so callers can still use `db.from(...)` directly
export const db: SupabaseClient<any, 'public', any> = new Proxy({} as SupabaseClient<any>, {
  get(_, prop: string) {
    const client = getDb()
    const value = client[prop as keyof typeof client]
    return typeof value === 'function' ? value.bind(client) : value
  },
})
