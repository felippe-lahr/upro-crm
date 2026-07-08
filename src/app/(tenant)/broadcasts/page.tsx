'use client'

import { useState, useEffect } from 'react'

interface Broadcast {
  id: string
  message: string
  status: string
  total: number
  sent_count: number
  failed_count: number
  filter_tag: string | null
  created_at: string
}

export default function BroadcastsPage() {
  const [list, setList] = useState<Broadcast[]>([])
  const [message, setMessage] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  function load() {
    fetch('/api/broadcasts')
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setList(d))
      .catch(() => {})
  }

  useEffect(load, [])

  async function send() {
    if (!message.trim() || sending) return
    if (!confirm('Enviar este disparo para os contatos selecionados?')) return
    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/broadcasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, filter_tag: filterTag.trim() || null })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha')
      setMessage('')
      setFilterTag('')
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao enviar')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="max-w-3xl p-4 sm:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-fg">Disparos</h1>
        <p className="mt-1 text-sm text-muted">
          Envie uma mensagem para todos os contatos ou para um segmento por etiqueta.
        </p>
      </div>

      <section className="mb-8 rounded-2xl border border-line bg-surface p-6">
        <h2 className="mb-4 font-semibold text-fg">Novo disparo</h2>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          placeholder="Escreva a mensagem que será enviada..."
          className="mb-3 w-full resize-none rounded-lg border border-line bg-background px-4 py-3 text-sm text-fg focus:border-brand focus:outline-none"
        />
        <div className="flex items-center gap-3">
          <input
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
            placeholder="Filtrar por etiqueta (opcional)"
            className="flex-1 rounded-lg border border-line bg-background px-4 py-2 text-sm text-fg focus:border-brand focus:outline-none"
          />
          <button
            onClick={send}
            disabled={sending || !message.trim()}
            className="rounded-xl bg-brand px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-40"
          >
            {sending ? 'Enviando...' : 'Enviar disparo'}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </section>

      <h2 className="mb-3 font-semibold text-fg">Histórico</h2>
      {list.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface p-12 text-center">
          <div className="mb-3 text-4xl">📣</div>
          <p className="text-sm text-muted">Nenhum disparo enviado ainda.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((b) => (
            <div key={b.id} className="rounded-xl border border-line bg-surface p-4">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs text-faint">
                  {new Date(b.created_at).toLocaleString('pt-BR')}
                  {b.filter_tag && (
                    <span className="ml-2 rounded-full bg-brand/15 px-2 py-0.5 text-brand">
                      #{b.filter_tag}
                    </span>
                  )}
                </span>
                <span className="text-xs font-medium text-muted">
                  ✓ {b.sent_count}/{b.total}
                  {b.failed_count > 0 && (
                    <span className="ml-1 text-red-400">· {b.failed_count} falhas</span>
                  )}
                </span>
              </div>
              <p className="text-sm text-fg">{b.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
