'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { FUNNEL_STAGES } from '@/lib/funnel'

interface Contact {
  id: string
  name: string | null
  phone: string
  email: string | null
  notes: string | null
  ai_summary: string | null
  tags: string[]
  stage: string
  deal_value: string | null
}

interface Msg {
  id: string
  direction: string
  content: string | null
  sent_by_bot: boolean
  timestamp: string
}

interface QuickReply {
  shortcut: string
  content: string
}

const STATUSES = [
  { id: 'open', label: 'Aberta', color: 'bg-brand' },
  { id: 'pending', label: 'Pendente', color: 'bg-amber-500' },
  { id: 'closed', label: 'Fechada', color: 'bg-gray-500' }
]

export function ConversationThread({
  contact,
  messages: initialMessages,
  conversationStatus,
  quickReplies
}: {
  contact: Contact
  messages: Msg[]
  conversationStatus: string
  quickReplies: QuickReply[]
}) {
  const [messages, setMessages] = useState<Msg[]>(initialMessages)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState(conversationStatus)
  const [notes, setNotes] = useState(contact.notes || '')
  const [tags, setTags] = useState<string[]>(contact.tags)
  const [tagInput, setTagInput] = useState('')
  const [showQuick, setShowQuick] = useState(false)
  const [savedNote, setSavedNote] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Atualização em tempo real: busca mensagens novas a cada 2s (sem recarregar a página).
  // O envio persiste no banco na hora, então a lista do servidor é a fonte da verdade.
  useEffect(() => {
    let active = true
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/conversations/messages?contactId=${contact.id}`, { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (!active || !Array.isArray(data.messages)) return
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          const srvLast = data.messages[data.messages.length - 1]
          // Só re-renderiza se algo mudou (contagem ou última mensagem).
          if (data.messages.length === prev.length && last?.id === srvLast?.id) return prev
          return data.messages
        })
      } catch { /* ignora falhas transitórias */ }
    }, 2000)
    return () => { active = false; clearInterval(timer) }
  }, [contact.id])

  async function send() {
    if (!text.trim() || sending) return
    setSending(true)
    const body = text.trim()
    setText('')
    try {
      const res = await fetch('/api/conversations/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: contact.id, text: body })
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setMessages((m) => [
        ...m,
        {
          id: data.id || crypto.randomUUID(),
          direction: 'outbound',
          content: body,
          sent_by_bot: false,
          timestamp: new Date().toISOString()
        }
      ])
    } catch {
      setText(body)
      alert('Falha ao enviar. Verifique se o WhatsApp está conectado.')
    } finally {
      setSending(false)
    }
  }

  async function changeStatus(s: string) {
    setStatus(s)
    await fetch('/api/conversations/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId: contact.id, status: s })
    }).catch(() => {})
  }

  async function patchContact(patch: Record<string, unknown>) {
    await fetch('/api/contacts/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId: contact.id, ...patch })
    }).catch(() => {})
  }

  async function saveNotes() {
    await patchContact({ notes })
    setSavedNote(true)
    setTimeout(() => setSavedNote(false), 2000)
  }

  async function deleteContact() {
    if (!confirm('Excluir este contato? Todas as mensagens e o histórico serão apagados permanentemente.')) return
    try {
      const res = await fetch('/api/contacts/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: contact.id })
      })
      if (!res.ok) throw new Error()
      window.location.href = '/conversations'
    } catch {
      alert('Falha ao excluir o contato.')
    }
  }

  function addTag() {
    const t = tagInput.trim().toLowerCase()
    if (!t || tags.includes(t)) return
    const next = [...tags, t]
    setTags(next)
    setTagInput('')
    patchContact({ tags: next })
  }

  function removeTag(t: string) {
    const next = tags.filter((x) => x !== t)
    setTags(next)
    patchContact({ tags: next })
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Thread */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-line bg-surface px-6 py-4">
          <Link href="/conversations" className="text-muted hover:text-fg">←</Link>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/15 font-medium text-brand">
            {(contact.name || contact.phone)[0].toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-fg">{contact.name || contact.phone}</div>
            <div className="truncate text-xs text-faint">{contact.phone}</div>
          </div>
          <div className="flex flex-shrink-0 gap-1">
            {STATUSES.map((s) => (
              <button
                key={s.id}
                onClick={() => changeStatus(s.id)}
                title={s.label}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3 sm:py-1 ${
                  status === s.id ? 'bg-surface2 text-fg' : 'text-faint hover:text-muted'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${s.color}`} />
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            ))}
          </div>
        </header>

        <div className="flex-1 space-y-3 overflow-auto bg-background p-6">
          {messages.length === 0 && (
            <p className="text-center text-sm text-faint">Nenhuma mensagem ainda.</p>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm sm:max-w-[70%] ${
                  m.direction === 'outbound'
                    ? 'bg-brand-600 text-white'
                    : 'border border-line bg-surface text-fg'
                }`}
              >
                {m.sent_by_bot && (
                  <span className="mb-0.5 block text-[10px] uppercase opacity-70">🤖 bot</span>
                )}
                <p className="whitespace-pre-wrap">{m.content || '[mídia]'}</p>
                <span className="mt-1 block text-right text-[10px] opacity-60">
                  {new Date(m.timestamp).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Composer */}
        <div className="relative border-t border-line bg-surface p-4">
          {showQuick && quickReplies.length > 0 && (
            <div className="absolute bottom-full left-4 mb-2 w-80 overflow-hidden rounded-xl border border-line bg-surface shadow-xl">
              {quickReplies.map((q) => (
                <button
                  key={q.shortcut}
                  onClick={() => {
                    setText((t) => (t ? t + ' ' : '') + q.content)
                    setShowQuick(false)
                  }}
                  className="block w-full border-b border-line px-4 py-2 text-left last:border-0 hover:bg-surface2"
                >
                  <span className="text-xs font-semibold text-brand">/{q.shortcut}</span>
                  <span className="ml-2 text-sm text-muted">{q.content.slice(0, 50)}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <button
              onClick={() => setShowQuick((s) => !s)}
              title="Respostas rápidas"
              className="rounded-lg bg-surface2 px-3 py-2 text-fg hover:bg-line"
            >
              ⚡
            </button>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
              rows={1}
              placeholder="Digite uma mensagem..."
              className="flex-1 resize-none rounded-xl border border-line bg-background px-4 py-2 text-sm text-fg focus:border-brand focus:outline-none"
            />
            <button
              onClick={send}
              disabled={sending || !text.trim()}
              className="rounded-xl bg-brand px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-40"
            >
              {sending ? '...' : 'Enviar'}
            </button>
          </div>
        </div>
      </div>

      {/* Side panel: notes / tags / stage */}
      <aside className="hidden w-72 flex-col gap-5 overflow-auto border-l border-line bg-surface p-5 lg:flex">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">Contato</h3>
          <div className="space-y-1 text-xs">
            <div className="flex gap-2">
              <span className="text-faint">Tel:</span>
              <span className="text-fg">{contact.phone}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-faint">E-mail:</span>
              <span className={contact.email ? 'text-fg' : 'text-faint'}>
                {contact.email || 'não informado'}
              </span>
            </div>
          </div>
        </div>

        {contact.ai_summary && (
          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-faint">
              <span>✨</span> Resumo (IA)
            </h3>
            <p className="rounded-lg border border-purple-500/20 bg-purple-500/5 px-3 py-2 text-xs leading-relaxed text-muted">
              {contact.ai_summary}
            </p>
          </div>
        )}

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">Etiquetas</h3>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span
                key={t}
                className="flex items-center gap-1 rounded-full bg-brand/15 px-2 py-0.5 text-xs text-brand"
              >
                {t}
                <button onClick={() => removeTag(t)} className="hover:text-brand">×</button>
              </span>
            ))}
            {tags.length === 0 && <span className="text-xs text-faint">Nenhuma etiqueta</span>}
          </div>
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTag()}
            placeholder="Adicionar etiqueta + Enter"
            className="w-full rounded-lg border border-line bg-background px-3 py-1.5 text-xs text-fg focus:border-brand focus:outline-none"
          />
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">Estágio no funil</h3>
          <select
            value={contact.stage}
            onChange={(e) => patchContact({ stage: e.target.value })}
            className="w-full rounded-lg border border-line bg-background px-3 py-1.5 text-xs text-fg focus:border-brand focus:outline-none"
          >
            {FUNNEL_STAGES.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">Anotações</h3>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={6}
            placeholder="Anotações internas sobre este contato..."
            className="w-full resize-none rounded-lg border border-line bg-background px-3 py-2 text-xs text-fg focus:border-brand focus:outline-none"
          />
          <button
            onClick={saveNotes}
            className="mt-2 w-full rounded-lg bg-surface2 py-1.5 text-xs font-medium text-fg hover:bg-line"
          >
            {savedNote ? 'Salvo ✓' : 'Salvar anotações'}
          </button>
        </div>

        <div className="border-t border-line pt-4">
          <button
            onClick={deleteContact}
            className="w-full rounded-lg border border-red-500/30 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10"
          >
            Excluir contato
          </button>
        </div>
      </aside>
    </div>
  )
}
