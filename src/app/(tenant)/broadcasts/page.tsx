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

interface Meta {
  company: string
  consent_template: string
  consent_status: string | null
  available_tags: string[]
  max_recipients: number
}

export default function BroadcastsPage() {
  const [list, setList] = useState<Broadcast[]>([])
  const [meta, setMeta] = useState<Meta | null>(null)
  const [message, setMessage] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  function load() {
    fetch('/api/broadcasts')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.broadcasts)) setList(d.broadcasts)
        if (d.meta) setMeta(d.meta)
      })
      .catch(() => {})
  }

  useEffect(load, [])

  const company = meta?.company || 'sua empresa'
  const max = meta?.max_recipients || 30
  const status = meta?.consent_status
  const canSend = status === 'APPROVED'

  const preview = `Olá [nome], somos da ${company}. ${message || '[sua mensagem]'}. Se tiver interesse digite SIM para continuar. Caso não queira mais receber esta mensagem digite SAIR.`

  async function send() {
    if (!message.trim() || sending) return
    if (!confirm(`Enviar o convite de consentimento para os contatos selecionados (máx. ${max})?`)) return
    setSending(true); setError(''); setNotice('')
    try {
      const res = await fetch('/api/broadcasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, filter_tag: filterTag.trim() || null })
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 409) setNotice(data.error || 'Modelo em análise.')
        else setError(data.error || 'Falha ao enviar.')
        return
      }
      setMessage(''); setFilterTag('')
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao enviar')
    } finally {
      setSending(false)
    }
  }

  const statusBadge = () => {
    const map: Record<string, { txt: string; cls: string }> = {
      APPROVED: { txt: '✓ Modelo aprovado — pronto para enviar', cls: 'text-green-600' },
      PENDING: { txt: '⏳ Modelo em análise pela Meta (minutos a algumas horas)', cls: 'text-amber-600' },
      REJECTED: { txt: '✕ Modelo recusado — fale com o suporte', cls: 'text-red-500' },
      NONE: { txt: 'Modelo ainda não criado — será criado no primeiro envio', cls: 'text-muted' }
    }
    const info = status ? map[status] : null
    return info ? <p className={`text-xs ${info.cls}`}>{info.txt}</p> : null
  }

  return (
    <div className="max-w-3xl p-4 sm:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-fg">Disparos de consentimento</h1>
        <p className="mt-1 text-sm text-muted">
          Convide até <strong>{max} contatos</strong> a iniciarem uma conversa. Quem responder <strong>SIM</strong> continua o
          atendimento; quem responder <strong>SAIR</strong> é descadastrado automaticamente.
        </p>
      </div>

      <section className="mb-8 rounded-2xl border border-line bg-surface p-6">
        <div className="mb-3">{statusBadge()}</div>

        <label className="mb-1 block text-sm font-medium text-fg">Sua mensagem</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.replace(/\n/g, ' '))}
          rows={2}
          maxLength={500}
          placeholder="Ex: temos uma condição especial de projeto de interiores para o seu apartamento"
          className="mb-1 w-full resize-none rounded-lg border border-line bg-background px-4 py-3 text-sm text-fg focus:border-brand focus:outline-none"
        />
        <p className="mb-3 text-xs text-faint">{message.length}/500 · uma linha, sem quebras.</p>

        {/* Preview do que o contato recebe */}
        <div className="mb-4 rounded-lg border border-line bg-background p-3">
          <p className="mb-1 text-xs font-medium text-muted">Prévia da mensagem:</p>
          <p className="text-sm text-fg">{preview}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {meta?.available_tags && meta.available_tags.length > 0 ? (
            <select
              value={filterTag}
              onChange={(e) => setFilterTag(e.target.value)}
              className="rounded-lg border border-line bg-background px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none"
            >
              <option value="">Todos os contatos (até {max})</option>
              {meta.available_tags.map((t) => (
                <option key={t} value={t}>Etiqueta: {t}</option>
              ))}
            </select>
          ) : (
            <input
              value={filterTag}
              onChange={(e) => setFilterTag(e.target.value)}
              placeholder="Filtrar por etiqueta (opcional)"
              className="flex-1 rounded-lg border border-line bg-background px-4 py-2 text-sm text-fg focus:border-brand focus:outline-none"
            />
          )}
          <button
            onClick={send}
            disabled={sending || !message.trim() || !canSend}
            className="rounded-xl bg-brand px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-40"
            title={!canSend ? 'Aguarde a aprovação do modelo pela Meta' : ''}
          >
            {sending ? 'Enviando...' : 'Enviar convite'}
          </button>
        </div>

        {notice && <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-600">{notice}</p>}
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <div className="mt-4 rounded-lg border border-line bg-background px-3 py-2.5 text-xs text-muted">
          <p className="font-medium text-fg">Como funciona</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            <li>Enviado via <strong>modelo aprovado pela Meta</strong> (necessário para iniciar conversa fora da janela de 24h).</li>
            <li>Máximo de <strong>{max} contatos</strong> por disparo. Contatos que já responderam <strong>SAIR</strong> nunca são incluídos.</li>
            <li>Cada mensagem de modelo é <strong>cobrada pela Meta</strong> (conversa de marketing). Requer forma de pagamento configurada na conta do WhatsApp.</li>
          </ul>
        </div>
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
                  {new Date(b.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                  {b.filter_tag && (
                    <span className="ml-2 rounded-full bg-brand/15 px-2 py-0.5 text-brand">#{b.filter_tag}</span>
                  )}
                </span>
                <span className="text-xs font-medium text-muted">
                  ✓ {b.sent_count}/{b.total}
                  {b.failed_count > 0 && <span className="ml-1 text-red-400">· {b.failed_count} falhas</span>}
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
