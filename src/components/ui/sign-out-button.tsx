'use client'

import { signOut } from 'next-auth/react'

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/login' })}
      className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors"
    >
      Sair
    </button>
  )
}
