'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MessageSquare } from 'lucide-react'

export default function AffiliateLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const res = await fetch('/api/affiliate/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Erro ao entrar'); return }
      window.location.href = '/afiliado'
    } catch {
      setError('Erro de conexão.')
    } finally { setLoading(false) }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-fg">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/afiliados" className="inline-flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white">
              <MessageSquare className="h-4 w-4" />
            </div>
            <span className="text-lg font-bold">UProCRM</span>
          </Link>
          <h1 className="mb-1 mt-6 text-2xl font-bold">Painel do Afiliado</h1>
          <p className="text-sm text-muted">Acompanhe suas indicações e comissões.</p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-8">
          <form onSubmit={submit} className="space-y-4">
            {error && <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-500">{error}</div>}
            <div>
              <label className="mb-1 block text-sm font-medium">E-mail</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-line bg-background px-4 py-3 text-sm focus:border-brand focus:outline-none" placeholder="seu@email.com" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Senha</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-line bg-background px-4 py-3 text-sm focus:border-brand focus:outline-none" placeholder="Sua senha" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full rounded-xl bg-brand py-3 font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50">
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        </div>
        <p className="mt-6 text-center text-sm text-muted">
          Quer ser afiliado? <Link href="/afiliados" className="text-brand hover:underline">Candidate-se</Link>
        </p>
      </div>
    </div>
  )
}
