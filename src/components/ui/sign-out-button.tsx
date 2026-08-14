'use client'

import { signOut } from 'next-auth/react'

export function SignOutButton() {
  function handleSignOut() {
    // Garante que a home (e o próximo acesso) volte sempre no tema escuro.
    try {
      localStorage.setItem('theme', 'dark')
      document.documentElement.classList.add('dark')
    } catch {}
    signOut({ callbackUrl: 'https://uprocrm.com.br' })
  }

  return (
    <button
      onClick={handleSignOut}
      className="w-full rounded-lg px-3 py-2 text-left text-sm text-faint transition-colors hover:bg-surface2 hover:text-fg"
    >
      Sair
    </button>
  )
}
