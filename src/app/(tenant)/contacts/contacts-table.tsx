'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Download } from 'lucide-react'
import { DeleteContact } from './contact-actions'
import { DatePickerBR } from '@/components/ui/date-picker-br'

const PERIODS = [
  { id: 'all', label: 'Todos' },
  { id: 'today', label: 'Hoje' },
  { id: 'yesterday', label: 'Ontem' },
  { id: '7d', label: '7 dias' },
  { id: '30d', label: '30 dias' },
  { id: 'custom', label: 'Período' }
]
const DAY = 24 * 60 * 60 * 1000
const RENDER_LIMIT = 300

function inPeriod(iso: string, p: string, from: string, to: string): boolean {
  if (p === 'all') return true
  const d = new Date(iso).getTime()
  const today = (() => { const s = new Date(); s.setHours(0, 0, 0, 0); return s.getTime() })()
  if (p === 'today') return d >= today
  if (p === 'yesterday') return d >= today - DAY && d < today
  if (p === '7d') return d >= Date.now() - 7 * DAY
  if (p === '30d') return d >= Date.now() - 30 * DAY
  if (from && d < new Date(from + 'T00:00:00').getTime()) return false
  if (to && d > new Date(to + 'T23:59:59').getTime()) return false
  return true
}

// CSV no padrão do Excel em português: separador ";" e BOM UTF-8 (acentos corretos).
function toCsv(rows: ContactRow[]): string {
  const esc = (v: string | null | undefined) => {
    const t = String(v ?? '').replace(/\r?\n/g, ' ').trim()
    return /[";]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
  }
  const lines = [['Nome', 'Telefone', 'E-mail', 'Resumo da conversa'].join(';')]
  for (const r of rows) lines.push([esc(r.name), esc(r.phone), esc(r.email), esc(r.ai_summary)].join(';'))
  return '\uFEFF' + lines.join('\r\n')
}

export interface ContactRow {
  id: string
  name: string | null
  phone: string
  email?: string | null
  ai_summary?: string | null
  tags: string[]
  created_at: string // ISO
}

export function ContactsTable({ contacts, existingTags = [] }: { contacts: ContactRow[]; existingTags?: string[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [tag, setTag] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [period, setPeriod] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [filterTags, setFilterTags] = useState<string[]>([])

  const allTags = useMemo(() => Array.from(new Set(contacts.flatMap((c) => c.tags || []))).sort(), [contacts])
  const filtered = useMemo(
    () => contacts.filter((c) =>
      inPeriod(c.created_at, period, from, to) &&
      (filterTags.length === 0 || filterTags.some((t) => (c.tags || []).includes(t)))
    ),
    [contacts, period, from, to, filterTags]
  )
  const shown = filtered.slice(0, RENDER_LIMIT)
  const allChecked = filtered.length > 0 && filtered.every((c) => selected.has(c.id))

  function toggleFilterTag(t: string) {
    setFilterTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
  }

  function exportCsv() {
    const rows = selected.size > 0 ? filtered.filter((c) => selected.has(c.id)) : filtered
    if (!rows.length) return
    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `contatos-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    setMsg(`${rows.length} contato(s) exportado(s).`)
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(filtered.map((c) => c.id)))
  }

  async function applyTag(action: 'add' | 'remove') {
    if (!tag.trim() || selected.size === 0 || busy) return
    setBusy(true); setMsg('')
    try {
      const res = await fetch('/api/contacts/tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactIds: Array.from(selected), tag: tag.trim(), action })
      })
      const data = await res.json()
      if (!res.ok) { setMsg(data.error || 'Falha'); return }
      setMsg(
        `${action === 'remove' ? 'Removida' : 'Aplicada'} etiqueta "${data.tag}" em ${data.affected} contato(s).` +
        (data.taxonomy_added ? ' Nova etiqueta criada e disponível nas Configurações.' : '')
      )
      setSelected(new Set()); setTag('')
      router.refresh()
    } catch {
      setMsg('Erro de conexão.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      {/* Filtros */}
      <div className="mb-3 flex flex-col gap-3 rounded-2xl border border-line bg-surface p-3.5">
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`flex-shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors ${
                period === p.id ? 'bg-brand text-white' : 'bg-surface2 text-muted hover:text-fg'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-faint">De</span>
            <DatePickerBR value={from} max={to || undefined} onChange={setFrom} />
            <span className="text-xs text-faint">até</span>
            <DatePickerBR value={to} min={from || undefined} onChange={setTo} />
          </div>
        )}
        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-faint">Etiquetas:</span>
            {allTags.map((t) => (
              <button
                key={t}
                onClick={() => toggleFilterTag(t)}
                className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                  filterTags.includes(t) ? 'bg-brand text-white' : 'bg-brand/10 text-brand hover:bg-brand/20'
                }`}
              >
                {t}
              </button>
            ))}
            {filterTags.length > 0 && (
              <button onClick={() => setFilterTags([])} className="text-xs text-faint hover:text-red-400">limpar</button>
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
          <span className="text-xs text-muted">
            {filtered.length} contato(s) no filtro{selected.size > 0 ? ` · ${selected.size} selecionado(s)` : ''}
          </span>
          <button
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-line px-3.5 py-2 text-sm font-semibold text-fg transition-colors hover:border-brand/50 hover:text-brand disabled:opacity-40"
          >
            <Download className="h-4 w-4" />
            Exportar CSV ({selected.size > 0 ? selected.size : filtered.length})
          </button>
        </div>
      </div>

      {/* Barra de ações em lote (aparece quando há seleção) */}
      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-brand/30 bg-brand/5 p-3">
          <span className="text-sm font-medium text-fg">{selected.size} selecionado(s)</span>
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            list="contact-tags"
            placeholder="Escolher ou criar etiqueta"
            className="w-56 rounded-lg border border-line bg-background px-3 py-1.5 text-sm text-fg focus:border-brand focus:outline-none"
          />
          <datalist id="contact-tags">
            {existingTags.map((t) => <option key={t} value={t} />)}
          </datalist>
          <button
            onClick={() => applyTag('add')}
            disabled={busy || !tag.trim()}
            className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-40"
          >
            Aplicar etiqueta
          </button>
          <button
            onClick={() => applyTag('remove')}
            disabled={busy || !tag.trim()}
            className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-muted hover:border-red-500/40 hover:text-red-500 disabled:opacity-40"
          >
            Remover etiqueta
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs text-muted hover:text-fg"
          >
            limpar seleção
          </button>
          {msg && <span className="w-full text-xs text-muted sm:w-auto">{msg}</span>}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b border-line bg-surface2">
              <th className="px-4 py-3 text-left">
                <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Selecionar todos" />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-faint">Nome</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-faint">Telefone</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-faint">Etiquetas</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-faint">Desde</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-faint">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shown.map((c) => (
              <tr key={c.id} className={`transition-colors hover:bg-surface2 ${selected.has(c.id) ? 'bg-brand/5' : ''}`}>
                <td className="px-4 py-4">
                  <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} aria-label={`Selecionar ${c.name || c.phone}`} />
                </td>
                <td className="px-6 py-4">
                  <Link href={`/conversations/${c.id}`} className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/15 text-sm font-medium text-brand">
                      {(c.name || c.phone)[0].toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-fg">{c.name || 'Sem nome'}</span>
                  </Link>
                </td>
                <td className="px-6 py-4 text-sm text-muted">{c.phone}</td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {(c.tags || []).map((t) => (
                      <span key={t} className="rounded-full bg-brand/15 px-2 py-0.5 text-xs text-brand">{t}</span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-faint">{new Date(c.created_at).toLocaleDateString('pt-BR')}</td>
                <td className="px-6 py-4">
                  <div className="flex justify-end">
                    <DeleteContact contactId={c.id} name={c.name || c.phone} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && (
        <p className="mt-4 text-center text-sm text-faint">Nenhum contato com esses filtros.</p>
      )}
      {filtered.length > RENDER_LIMIT && (
        <p className="mt-3 text-center text-xs text-faint">
          Mostrando {RENDER_LIMIT} de {filtered.length}. A seleção em lote e a exportação valem para todos os {filtered.length}.
        </p>
      )}
    </div>
  )
}
