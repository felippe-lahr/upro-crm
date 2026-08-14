'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { DatePickerBR } from './date-picker-br'

export interface ConversationItem {
  contactId: string
  name: string | null
  phone: string
  tags: string[]
  lastContent: string | null
  lastDirection: string
  lastTimestamp: string
  unread: number
}

const DATE_PRESETS = [
  { id: 'all', label: 'Todas' },
  { id: 'today', label: 'Hoje' },
  { id: '7d', label: '7 dias' },
  { id: '30d', label: '30 dias' },
  { id: 'custom', label: 'Período' }
]

function withinPreset(iso: string, preset: string, from?: string, to?: string): boolean {
  if (preset === 'all') return true
  const d = new Date(iso).getTime()
  if (preset === 'custom') {
    if (from) {
      const start = new Date(from + 'T00:00:00').getTime()
      if (d < start) return false
    }
    if (to) {
      const end = new Date(to + 'T23:59:59').getTime()
      if (d > end) return false
    }
    return true
  }
  const now = Date.now()
  const days = preset === 'today' ? 1 : preset === '7d' ? 7 : 30
  if (preset === 'today') {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    return d >= start.getTime()
  }
  return d >= now - days * 24 * 60 * 60 * 1000
}

export function ConversationsList({
  conversations,
  allTags
}: {
  conversations: ConversationItem[]
  allTags: string[]
}) {
  const [search, setSearch] = useState('')
  const [datePreset, setDatePreset] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [activeTags, setActiveTags] = useState<string[]>([])

  function toggleTag(t: string) {
    setActiveTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
  }

  const filtered = useMemo(() => {
    return conversations.filter((c) => {
      if (search.trim()) {
        const q = search.toLowerCase()
        if (!(c.name || '').toLowerCase().includes(q) && !c.phone.includes(q)) return false
      }
      if (!withinPreset(c.lastTimestamp, datePreset, customFrom, customTo)) return false
      if (activeTags.length > 0 && !activeTags.some((t) => c.tags.includes(t))) return false
      return true
    })
  }, [conversations, search, datePreset, customFrom, customTo, activeTags])

  return (
    <div>
      {/* Filtros */}
      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou telefone..."
            className="flex-1 min-w-[200px] rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none"
          />
          <div className="flex overflow-hidden rounded-lg border border-line">
            {DATE_PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => setDatePreset(p.id)}
                className={`px-3 py-2 text-xs font-medium transition-colors ${
                  datePreset === p.id ? 'bg-brand text-white' : 'bg-surface text-muted hover:text-fg'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {datePreset === 'custom' && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-faint">De:</span>
            <DatePickerBR value={customFrom} max={customTo || undefined} onChange={setCustomFrom} />
            <span className="text-xs text-faint">até:</span>
            <DatePickerBR value={customTo} min={customFrom || undefined} onChange={setCustomTo} />
            {(customFrom || customTo) && (
              <button
                onClick={() => { setCustomFrom(''); setCustomTo('') }}
                className="text-xs text-faint hover:text-red-400"
              >
                limpar
              </button>
            )}
          </div>
        )}
        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-faint">Etiquetas:</span>
            {allTags.map((t) => (
              <button
                key={t}
                onClick={() => toggleTag(t)}
                className={`rounded-full px-2.5 py-0.5 text-xs transition-colors ${
                  activeTags.includes(t)
                    ? 'bg-brand text-white'
                    : 'bg-surface2 text-muted hover:text-fg'
                }`}
              >
                {t}
              </button>
            ))}
            {activeTags.length > 0 && (
              <button onClick={() => setActiveTags([])} className="text-xs text-faint hover:text-red-400">
                limpar
              </button>
            )}
          </div>
        )}
      </div>

      <p className="mb-3 text-sm text-muted">
        {filtered.length} conversa{filtered.length !== 1 ? 's' : ''}
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface p-12 text-center text-sm text-muted">
          Nenhuma conversa com os filtros atuais.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          {filtered.map((conv) => (
            <Link
              key={conv.contactId}
              href={`/conversations/${conv.contactId}`}
              className="flex items-center gap-4 border-b border-line px-6 py-4 transition-colors last:border-0 hover:bg-surface2"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand/15 font-medium text-brand">
                {(conv.name || conv.phone)[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-fg">{conv.name || conv.phone}</span>
                  <span className="flex-shrink-0 text-right text-xs text-faint">
                    <span className="block">
                      {new Date(conv.lastTimestamp).toLocaleDateString('pt-BR', {
                        day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'America/Sao_Paulo'
                      })}
                    </span>
                    <span className="block text-[10px]">
                      {new Date(conv.lastTimestamp).toLocaleTimeString('pt-BR', {
                        hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo'
                      })}
                    </span>
                  </span>
                </div>
                <p className="mt-0.5 truncate text-sm text-muted">
                  {conv.lastDirection === 'outbound' && <span className="mr-1 text-brand">↑</span>}
                  {conv.lastContent || '[mídia]'}
                </p>
                {conv.tags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {conv.tags.map((t) => (
                      t === 'anúncio' ? (
                        <span
                          key={t}
                          className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400"
                        >
                          📣 anúncio
                        </span>
                      ) : (
                        <span
                          key={t}
                          className="rounded-full bg-brand/15 px-2 py-0.5 text-[11px] text-brand"
                        >
                          {t}
                        </span>
                      )
                    ))}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
