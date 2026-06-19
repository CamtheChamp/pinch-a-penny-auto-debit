import type { Metadata } from 'next'
import './globals.css'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Pinch A Penny — Auto Debit Parser',
  description: 'Parse and process Preauthorized Debit PDF reports for QuickBooks Online',
}

const navLinks = [
  { href: '/', label: 'Upload' },
  { href: '/reports', label: 'Reports' },
  { href: '/mappings', label: 'Mappings' },
  { href: '/settings', label: 'QBO Settings' },
  { href: '/audit', label: 'Audit Log' },
]

const VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <nav className="bg-blue-700 text-white px-6 py-3 flex items-center gap-6 shadow">
          <span className="font-bold text-lg whitespace-nowrap">Pinch A Penny #144</span>
          <div className="flex gap-4 text-sm flex-1">
            {navLinks.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-blue-200 transition-colors">
                {l.label}
              </Link>
            ))}
          </div>
          <span className="text-blue-300 text-xs font-mono whitespace-nowrap">v{VERSION}</span>
        </nav>
        <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
        <footer className="border-t mt-12 py-4 text-center text-xs text-gray-400">
          Pinch A Penny #144 — Internal Tool &nbsp;·&nbsp;
          <a href="mailto:pcameronwhite@gmail.com" className="underline hover:text-gray-600">Contact Support</a>
        </footer>
      </body>
    </html>
  )
}
