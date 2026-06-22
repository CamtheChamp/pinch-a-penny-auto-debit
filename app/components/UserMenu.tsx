'use client'

import { useRouter } from 'next/navigation'
import { getBrowserSupabase } from '@/lib/supabase-browser'

export default function UserMenu({ email }: { email: string }) {
  const router = useRouter()

  async function signOut() {
    const supabase = getBrowserSupabase()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex items-center gap-3">
      <span className="hidden sm:inline text-sm text-gray-500 truncate max-w-48">{email}</span>
      <button
        onClick={signOut}
        className="text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded px-2 py-1 hover:bg-gray-50 whitespace-nowrap"
      >
        Sign out
      </button>
    </div>
  )
}
