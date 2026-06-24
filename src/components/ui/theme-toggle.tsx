'use client'

import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const [dark, setDark] = useState(true)

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
  }, [])

  function toggle() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light')
    } catch {
      // ignore
    }
  }

  return (
    <button
      onClick={toggle}
      title={dark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-surface2 hover:text-fg"
    >
      <span>{dark ? '☀️' : '🌙'}</span>
      <span>{dark ? 'Tema claro' : 'Tema escuro'}</span>
    </button>
  )
}
