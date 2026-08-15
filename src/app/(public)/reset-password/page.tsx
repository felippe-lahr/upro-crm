'use client'

import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'

function ResetForm() {
  const params = useSearchParams()
  const router = useRouter()
  const token = params.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('A senha deve ter ao menos 8 caracteres.'); return }
    if (password !== confirm) { setError('As senhas não coincidem.'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error || 'Não foi possível redefinir.'); return }
      setDone(true)
      setTimeout(() => router.push('/login'), 2500)
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-8 text-center">
        <p className="text-sm text-fg">Link inválido. Solicite uma nova redefinição.</p>
        <Link href="/forgot-password" className="mt-3 inline-block text-sm text-brand hover:underline">Recuperar senha</Link>
      </div>
    )
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-8 text-center">
        <div className="mb-3 text-4xl">✅</div>
        <p className="text-sm text-fg">Senha redefinida com sucesso! Redirecionando para o login…</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-8">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-fg">Nova senha</label>
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-line bg-background px-4 py-3 pr-16 text-sm text-fg focus:border-brand focus:outline-none"
              placeholder="mín. 8 caracteres"
            />
            <button type="button" onClick={() => setShow((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted hover:text-fg">
              {show ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-fg">Confirmar nova senha</label>
          <input
            type={show ? 'text' : 'password'}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            className="w-full rounded-lg border border-line bg-background px-4 py-3 text-sm text-fg focus:border-brand focus:outline-none"
            placeholder="repita a senha"
          />
        </div>
        <button type="submit" disabled={loading}
          className="w-full rounded-xl bg-brand py-3 font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-50">
          {loading ? 'Salvando...' : 'Redefinir senha'}
        </button>
      </form>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-fg">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-upro-novo.png" alt="UProCRM" className="h-8 w-8 rounded-lg" />
            <span className="text-lg font-bold text-fg">UProCRM</span>
          </Link>
          <h1 className="mb-1 mt-6 text-2xl font-bold text-fg">Criar nova senha</h1>
        </div>
        <Suspense fallback={<div className="text-center text-sm text-muted">Carregando…</div>}>
          <ResetForm />
        </Suspense>
      </div>
    </div>
  )
}
