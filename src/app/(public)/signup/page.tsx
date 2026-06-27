'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SignupPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erro ao criar conta')
        return
      }

      router.push(`/checkout?tenant=${data.tenantId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-fg">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand">
              <span className="text-xs font-bold text-white">UP</span>
            </div>
            <span className="text-lg font-bold text-white">UProCRM</span>
          </Link>
          <h1 className="mb-1 mt-6 text-2xl font-bold text-white">Criar sua conta</h1>
          <p className="text-sm text-muted">Configure em 2 minutos. Cancele quando quiser.</p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}
            <Field label="Nome da empresa">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-lg border border-line bg-background px-4 py-3 text-sm text-fg focus:border-brand focus:outline-none"
                placeholder="Minha Empresa Ltda"
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-line bg-background px-4 py-3 text-sm text-fg focus:border-brand focus:outline-none"
                placeholder="seu@email.com"
              />
            </Field>
            <Field label="Senha">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full rounded-lg border border-line bg-background px-4 py-3 text-sm text-fg focus:border-brand focus:outline-none"
                placeholder="Mínimo 8 caracteres"
              />
            </Field>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-brand py-3 font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
            >
              {loading ? 'Criando conta...' : 'Criar conta grátis'}
            </button>
            <p className="text-center text-xs text-faint">
              Ao criar sua conta você concorda com nossos{' '}
              <span className="cursor-pointer underline">Termos de Uso</span>.
            </p>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-muted">
          Já tem conta?{' '}
          <Link href="/login" className="text-brand hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-fg">{label}</label>
      {children}
    </div>
  )
}
