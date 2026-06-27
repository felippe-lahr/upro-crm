'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MessageSquare, Check, TrendingUp, Wallet, LineChart } from 'lucide-react'

export default function AffiliatesLandingPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', pix_key: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/affiliates/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Erro ao enviar'); return }
      setDone(true)
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-fg">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white shadow-lg shadow-brand/25">
              <MessageSquare className="h-4 w-4" />
            </div>
            <span className="font-bold tracking-tight">UProCRM</span>
          </Link>
          <Link href="/afiliado/login" className="text-sm font-medium text-muted hover:text-fg">Painel do afiliado</Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-10 px-6 py-12 lg:grid-cols-2">
        {/* Pitch */}
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-sm font-medium text-brand">
            <TrendingUp className="h-4 w-4" /> Programa de Afiliados
          </div>
          <h1 className="text-balance text-3xl font-bold leading-[1.2] tracking-tight md:text-4xl">
            Indique o UProCRM e ganhe <span className="bg-gradient-to-r from-brand to-brand-700 bg-clip-text text-transparent">comissão recorrente</span>
          </h1>
          <p className="mt-4 text-muted">
            Você indica, a gente cuida do resto. A cada cliente que assina pelo seu link,
            você ganha comissão — todo mês, enquanto ele continuar ativo.
          </p>
          <ul className="mt-8 space-y-4">
            {[
              { icon: Wallet, t: 'Comissão recorrente', d: 'Receba todo mês enquanto seu indicado mantém a assinatura.' },
              { icon: LineChart, t: 'Painel próprio', d: 'Acompanhe indicações, clientes ativos e ganhos em tempo real.' },
              { icon: Check, t: 'Link único de indicação', d: 'Compartilhe seu link e a atribuição é automática.' }
            ].map((b) => (
              <li key={b.t} className="flex gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                  <b.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-semibold">{b.t}</div>
                  <div className="text-sm text-muted">{b.d}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Form */}
        <div className="rounded-2xl border border-line bg-surface p-7 shadow-sm">
          {done ? (
            <div className="py-10 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand">
                <Check className="h-7 w-7" />
              </div>
              <h2 className="text-xl font-bold">Candidatura enviada!</h2>
              <p className="mt-2 text-sm text-muted">
                Vamos analisar seu cadastro. Assim que aprovado, você poderá acessar o painel do afiliado
                com o e-mail e a senha cadastrados.
              </p>
              <Link href="/afiliado/login" className="mt-6 inline-block rounded-xl border border-line px-6 py-2.5 text-sm font-medium hover:border-brand/40">
                Ir para o painel
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-bold">Quero ser afiliado</h2>
              <p className="mt-1 text-sm text-muted">Preencha seus dados — a aprovação é manual.</p>
              <form onSubmit={submit} className="mt-5 space-y-4">
                {error && <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-500">{error}</div>}
                <Field label="Nome completo">
                  <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-lg border border-line bg-background px-4 py-2.5 text-sm focus:border-brand focus:outline-none" placeholder="Seu nome" />
                </Field>
                <Field label="E-mail">
                  <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full rounded-lg border border-line bg-background px-4 py-2.5 text-sm focus:border-brand focus:outline-none" placeholder="seu@email.com" />
                </Field>
                <Field label="Senha">
                  <input required type="password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full rounded-lg border border-line bg-background px-4 py-2.5 text-sm focus:border-brand focus:outline-none" placeholder="Mínimo 8 caracteres" />
                </Field>
                <Field label="Chave Pix (para receber as comissões)">
                  <input value={form.pix_key} onChange={(e) => setForm({ ...form, pix_key: e.target.value })}
                    className="w-full rounded-lg border border-line bg-background px-4 py-2.5 text-sm focus:border-brand focus:outline-none" placeholder="CPF, e-mail, telefone ou chave aleatória" />
                </Field>
                <button type="submit" disabled={loading}
                  className="w-full rounded-xl bg-brand py-3 font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50">
                  {loading ? 'Enviando…' : 'Enviar candidatura'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-fg">{label}</label>
      {children}
    </div>
  )
}
