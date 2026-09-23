'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DeleteContact } from './contact-actions'

export interface ContactRow {
  id: string
  name: string | null
  phone: string
  tags: string[]
  created_at: string // ISO
}

export function ContactsTable({ contacts }: { contacts: ContactRow[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [tag, setTag] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const allChecked = contacts.length > 0 && selected.size === contacts.length

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(contacts.map((c) => c.id)))
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
      setMsg(`${action === 'remove' ? 'Removida' : 'Aplicada'} etiqueta "${data.tag}" em ${data.affected} contato(s).`)
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
      {/* Barra de ações em lote (aparece quando há seleção) */}
      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-brand/30 bg-brand/5 p-3">
          <span className="text-sm font-medium text-fg">{selected.size} selecionado(s)</span>
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="Etiqueta (ex.: campanha-set)"
            className="w-56 rounded-lg border border-line bg-background px-3 py-1.5 text-sm text-fg focus:border-brand focus:outline-none"
          />
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
            {contacts.map((c) => (
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
    </div>
  )
}
