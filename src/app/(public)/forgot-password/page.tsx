'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
    } catch {
      // silencioso — a resposta é sempre genérica de qualquer forma
    } finally {
      setLoading(false)
      setSent(true)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-fg">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-upro-novo.png" alt="UProCRM" className="h-8 w-8 rounded-lg" />
            <span className="text-lg font-bold text-fg">UProCRM</span>
          </Link>
          <h1 className="mb-1 mt-6 text-2xl font-bold text-fg">Recuperar senha</h1>
          <p className="text-sm text-muted">Enviaremos um link de redefinição para o seu e-mail.</p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-8">
          {sent ? (
            <div className="space-y-4 text-center">
              <div className="text-4xl">📧</div>
              <p className="text-sm text-fg">
                Se houver uma conta com esse e-mail, enviamos um link para redefinir a senha.
                Verifique sua caixa de entrada (e o spam).
              </p>
              <p className="text-xs text-faint">O link expira em 1 hora.</p>
              <Link href="/login" className="inline-block text-sm text-brand hover:underline">
                ← Voltar para o login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-fg">E-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-lg border border-line bg-background px-4 py-3 text-sm text-fg focus:border-brand focus:outline-none"
                  placeholder="seu@email.com"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-brand py-3 font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
              >
                {loading ? 'Enviando...' : 'Enviar link de redefinição'}
              </button>
              <div className="text-center">
                <Link href="/login" className="text-xs text-muted hover:text-fg">
                  ← Voltar para o login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
