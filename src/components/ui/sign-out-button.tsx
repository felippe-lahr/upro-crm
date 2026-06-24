'use client'

import { signOut } from 'next-auth/react'

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/login' })}
      className="w-full rounded-lg px-3 py-2 text-left text-sm text-faint transition-colors hover:bg-surface2 hover:text-fg"
    >
      Sair
    </button>
  )
}
