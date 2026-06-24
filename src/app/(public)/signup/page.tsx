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
    <div className="flex min-h-screen items-center justify-center bg-[#0b0f14] px-4 text-[#e6e8eb]">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500">
              <span className="text-sm font-bold text-white">W</span>
            </div>
            <span className="text-lg font-bold text-white">WaCRM</span>
          </Link>
          <h1 className="mb-1 mt-6 text-2xl font-bold text-white">Criar sua conta</h1>
          <p className="text-sm text-[#9aa6b2]">7 dias grátis, sem cartão de crédito</p>
        </div>

        <div className="rounded-2xl border border-[#1b222c] bg-[#131820] p-8">
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
                className="w-full rounded-lg border border-[#232c38] bg-[#0b0f14] px-4 py-3 text-sm text-[#e6e8eb] focus:border-green-500 focus:outline-none"
                placeholder="Minha Empresa Ltda"
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-[#232c38] bg-[#0b0f14] px-4 py-3 text-sm text-[#e6e8eb] focus:border-green-500 focus:outline-none"
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
                className="w-full rounded-lg border border-[#232c38] bg-[#0b0f14] px-4 py-3 text-sm text-[#e6e8eb] focus:border-green-500 focus:outline-none"
                placeholder="Mínimo 8 caracteres"
              />
            </Field>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-green-500 py-3 font-medium text-white transition-colors hover:bg-green-600 disabled:opacity-50"
            >
              {loading ? 'Criando conta...' : 'Criar conta grátis'}
            </button>
            <p className="text-center text-xs text-[#6b7886]">
              Ao criar sua conta você concorda com nossos{' '}
              <span className="cursor-pointer underline">Termos de Uso</span>.
            </p>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-[#9aa6b2]">
          Já tem conta?{' '}
          <Link href="/login" className="text-green-400 hover:underline">
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
      <label className="mb-1 block text-sm font-medium text-[#c4cdd6]">{label}</label>
      {children}
    </div>
  )
}
