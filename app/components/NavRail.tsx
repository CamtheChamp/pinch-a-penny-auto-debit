'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navLinks = [
  {
    href: '/',
    label: 'Upload',
    icon: (
      <path d="M12 4v10m0-10 4 4m-4-4-4 4M5 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  {
    href: '/reports',
    label: 'Reports',
    icon: (
      <>
        <rect x="5" y="3.5" width="14" height="17" rx="1.5" strokeWidth="1.6" />
        <path d="M8 8h8M8 11.5h8M8 15h5" strokeWidth="1.6" strokeLinecap="round" />
      </>
    ),
  },
  {
    href: '/mappings',
    label: 'Mappings',
    icon: (
      <path d="M4 7h6m4 0h6M4 12h16M4 17h6m4 0h6M4 7a1 1 0 1 0 2 0 1 1 0 1 0-2 0Zm14 0a1 1 0 1 0 2 0 1 1 0 1 0-2 0ZM4 17a1 1 0 1 0 2 0 1 1 0 1 0-2 0Zm14 0a1 1 0 1 0 2 0 1 1 0 1 0-2 0Z" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  {
    href: '/settings',
    label: 'QBO Settings',
    icon: (
      <>
        <circle cx="12" cy="12" r="2.75" strokeWidth="1.6" />
        <path d="M12 3.5v2.2m0 12.6v2.2M3.5 12h2.2m12.6 0h2.2M5.8 5.8l1.55 1.55m9.3 9.3 1.55 1.55M5.8 18.2l1.55-1.55m9.3-9.3 1.55-1.55" strokeWidth="1.6" strokeLinecap="round" />
      </>
    ),
  },
  {
    href: '/audit',
    label: 'Audit Log',
    icon: (
      <path d="M6 4h9l4 4v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm9 0v4h4M9 13h6M9 16.5h6" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
]

export default function NavRail() {
  const pathname = usePathname()

  return (
    <>
      <nav className="hidden md:flex w-56 shrink-0 flex-col bg-white border-r border-gray-200 py-4">
        {navLinks.map((l) => {
          const active = pathname === l.href
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex items-center gap-3 px-5 py-2.5 text-sm font-medium relative transition-colors ${
                active ? 'text-blue-700 bg-blue-50' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {active && <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-blue-600 rounded-full" />}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5 shrink-0">
                {l.icon}
              </svg>
              {l.label}
            </Link>
          )
        })}
      </nav>

      <nav className="md:hidden flex overflow-x-auto bg-white border-b border-gray-200 px-2">
        {navLinks.map((l) => {
          const active = pathname === l.href
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                active ? 'text-blue-700 border-blue-600' : 'text-gray-600 border-transparent hover:bg-gray-50'
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4 shrink-0">
                {l.icon}
              </svg>
              {l.label}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
