import type { Metadata } from 'next'
import './globals.css'
import NavRail from '@/app/components/NavRail'

export const metadata: Metadata = {
  title: 'PennyWise Ledger',
  description: 'Parse and process Preauthorized Debit PDF reports for QuickBooks Online',
}

const VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-100 text-gray-900">
        <header className="bg-white border-b border-gray-200 px-6 h-14 flex items-center gap-3 shadow-sm">
          <span className="flex items-center justify-center w-8 h-8 rounded bg-blue-600 text-white font-bold text-sm shrink-0">
            PW
          </span>
          <span className="font-semibold text-base text-gray-900 whitespace-nowrap">PennyWise Ledger</span>
          <span className="hidden sm:inline text-gray-300">|</span>
          <span className="hidden sm:inline text-sm text-gray-500 whitespace-nowrap">Pinch A Penny #144</span>
          <span className="flex-1" />
          <span className="text-gray-400 text-xs font-mono whitespace-nowrap">v{VERSION}</span>
        </header>

        <div className="flex min-h-[calc(100vh-56px)]">
          <NavRail />
          <div className="flex-1 flex flex-col min-w-0">
            <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">{children}</main>
            <footer className="border-t border-gray-200 py-4 text-center text-xs text-gray-400">
              PennyWise Ledger for Pinch A Penny #144 &nbsp;·&nbsp;
              <a href="mailto:pcameronwhite@gmail.com" className="underline hover:text-gray-600">Contact Support</a>
            </footer>
          </div>
        </div>
      </body>
    </html>
  )
}
