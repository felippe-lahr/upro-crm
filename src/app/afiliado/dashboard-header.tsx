'use client'

import { useState } from 'react'
import { Copy, Check, LogOut } from 'lucide-react'

export function DashboardHeader({ name, link }: { name: string; link: string }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function logout() {
    await fetch('/api/affiliate/logout', { method: 'POST' })
    window.location.href = '/afiliado/login'
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Olá, {name.split(' ')[0]} 👋</h1>
        <p className="text-sm text-muted">Acompanhe suas indicações e comissões.</p>
      </div>
      <button onClick={logout} className="inline-flex items-center gap-1.5 self-start rounded-lg border border-line px-3 py-2 text-sm text-muted transition-colors hover:text-red-400">
        <LogOut className="h-4 w-4" /> Sair
      </button>

      <div className="w-full sm:order-3 sm:w-auto sm:basis-full">
        <div className="mt-2 flex items-center gap-2 rounded-xl border border-brand/30 bg-brand/5 p-2 pl-4">
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{link}</span>
          <button onClick={copy} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-600">
            {copied ? <><Check className="h-4 w-4" /> Copiado</> : <><Copy className="h-4 w-4" /> Copiar link</>}
          </button>
        </div>
      </div>
    </div>
  )
}
