'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

export interface QboAccount {
  id: string
  name: string
  fullName: string
  type: string
  subType: string
}

interface Props {
  value: { id: string | null; name: string | null }
  accounts: QboAccount[]
  onChange: (account: { id: string; name: string } | null) => void
  placeholder?: string
}

export default function AccountPicker({ value, accounts, onChange, placeholder = 'Select account…' }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current && !containerRef.current.contains(e.target as Node) &&
        menuRef.current && !menuRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
      const updatePosition = () => {
        const rect = containerRef.current?.getBoundingClientRect()
        if (rect) setMenuPos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX })
      }
      updatePosition()
      window.addEventListener('scroll', updatePosition, true)
      window.addEventListener('resize', updatePosition)
      return () => {
        window.removeEventListener('scroll', updatePosition, true)
        window.removeEventListener('resize', updatePosition)
      }
    }
  }, [open])

  const filtered = accounts.filter((a) =>
    search === '' ||
    a.fullName.toLowerCase().includes(search.toLowerCase()) ||
    a.type.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 50)

  function select(account: QboAccount) {
    onChange({ id: account.id, name: account.name })
    setOpen(false)
    setSearch('')
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange(null)
  }

  const displayName = value.name ?? value.id

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`text-xs border rounded px-2 py-1 w-44 text-left flex items-center justify-between gap-1 ${
          value.id ? 'border-green-300 bg-green-50 text-green-800' : 'border-gray-200 text-gray-400'
        }`}
      >
        <span className="truncate">{displayName ?? placeholder}</span>
        <span className="flex items-center gap-1 shrink-0">
          {value.id && (
            <span
              onClick={clear}
              className="text-gray-400 hover:text-red-500 cursor-pointer leading-none"
              title="Clear"
            >×</span>
          )}
          <span className="text-gray-300">▾</span>
        </span>
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'absolute', top: menuPos.top, left: menuPos.left }}
          className="z-50 w-72 bg-white border border-gray-200 rounded-lg shadow-lg"
        >
          <div className="p-2 border-b">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search accounts…"
              className="w-full text-xs border border-gray-200 rounded px-2 py-1 outline-none focus:border-blue-400"
            />
          </div>
          <ul className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-gray-400">No accounts found</li>
            ) : filtered.map((a) => (
              <li
                key={a.id}
                onClick={() => select(a)}
                className={`px-3 py-2 cursor-pointer hover:bg-blue-50 flex items-center justify-between ${
                  value.id === a.id ? 'bg-blue-50 font-medium' : ''
                }`}
              >
                <div>
                  <p className="text-xs font-medium text-gray-800">{a.fullName}</p>
                  <p className="text-xs text-gray-400">{a.type} · {a.subType}</p>
                </div>
                <span className="text-xs font-mono text-gray-300 ml-2">#{a.id}</span>
              </li>
            ))}
          </ul>
        </div>,
        document.body
      )}
    </div>
  )
}
