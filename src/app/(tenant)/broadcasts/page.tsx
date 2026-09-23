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
  // Habilita o envio quando o modelo está aprovado OU ainda não existe (o 1º clique
  // cria o modelo na Meta). Só bloqueia quando está em análise (PENDING) ou recusado.
  const canSend = status !== 'PENDING' && status !== 'REJECTED'

  const preview = `Olá [nome], somos da ${company}. ${message || '[sua mensagem]'}. Se tiver interesse digite SIM para continuar. Caso não queira mais receber esta mensagem digite SAIR.`

  async function send() {
    if (!message.trim() || sending) return
    if (!confirm(`Enviar o convite de consentimento para o próximo lote (até ${max} contatos)?`)) return
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
      // Mantém a mensagem e a etiqueta para o usuário disparar o próximo lote.
      const rest = typeof data.remaining === 'number' ? data.remaining : 0
      setNotice(
        `Lote enviado: ${data.sent ?? 0}${data.failed ? ` (${data.failed} falhas)` : ''}. ` +
        (rest > 0
          ? `Restam ${rest} nesta seleção — clique em "Enviar convite" de novo para o próximo lote.`
          : 'Todos os contatos elegíveis já foram convidados. ✅')
      )
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
          Convide até <strong>{max} contatos por lote</strong> a iniciarem uma conversa. Quem responder <strong>SIM</strong> continua o
          atendimento; quem responder <strong>SAIR</strong> é descadastrado automaticamente. Clique novamente para enviar o próximo lote.
        </p>
      </div>

      <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
        <p className="font-medium text-amber-400">⚠️ Use apenas com contatos que já têm relação com você</p>
        <p className="mt-1 text-xs text-amber-500/90">
          Envie somente para pessoas que <strong>já são seus clientes/contatos ou autorizaram</strong> receber sua mensagem.
          Disparar para <strong>listas frias ou compradas</strong> gera bloqueios/denúncias e pode fazer a Meta
          <strong> banir o seu número de WhatsApp</strong> — além de risco de LGPD.
        </p>

        <details className="mt-3 text-xs text-amber-500/90">
          <summary className="cursor-pointer font-medium text-amber-400">Boas práticas e riscos (ler antes de disparar)</summary>
          <div className="mt-2 space-y-3">
            <div>
              <p className="font-semibold text-amber-400">✅ Boas práticas</p>
              <ul className="mt-1 list-disc space-y-1 pl-4">
                <li><strong>Lista morna:</strong> só clientes/contatos que já falaram com você ou deram o número.</li>
                <li><strong>Mensagem relevante e pessoal:</strong> diga quem é você e por que está falando com a pessoa.</li>
                <li><strong>Comece devagar</strong> (aquecimento): poucos por dia num número novo, aumentando aos poucos.</li>
                <li><strong>Respeite o SAIR</strong> (automático) e nunca reenvie para quem saiu.</li>
                <li><strong>Monitore</strong>: se aparecerem falhas/bloqueios, pare e revise a lista.</li>
                <li>Envie em <strong>lotes de {max}</strong>, sem pressa, ao longo do dia.</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-amber-400">🚫 O que arrisca banir o número</p>
              <ul className="mt-1 list-disc space-y-1 pl-4">
                <li><strong>Listas frias/compradas/raspadas</strong> — principal causa de banimento.</li>
                <li>Muitos envios de uma vez para quem <strong>não te conhece</strong> → bloqueios e denúncias.</li>
                <li>Mensagem <strong>genérica/spam</strong> ou repetida.</li>
                <li>Pedir consentimento na mensagem <strong>não</strong> torna o envio a frio seguro: o primeiro contato já é não solicitado.</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-amber-400">🎯 Para atrair novos clientes com segurança</p>
              <p className="mt-1">
                Use anúncios <strong>Click-to-WhatsApp</strong> (Instagram/Facebook) e <strong>Google Ads → WhatsApp</strong>:
                é o <strong>cliente</strong> quem inicia a conversa — sem risco de ban e dentro da política da Meta e da LGPD.
                O UProCRM já recebe e etiqueta esses leads pela origem automaticamente.
              </p>
            </div>
          </div>
        </details>
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
