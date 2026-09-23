'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

export function ImportContacts({ existingTags = [] }: { existingTags?: string[] }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [tag, setTag] = useState('')
  const router = useRouter()

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    setMsg('')
    try {
      const csv = await file.text()
      const res = await fetch('/api/contacts/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv, tag: tag.trim() || undefined })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha')
      setMsg(
        `${data.imported} importados, ${data.skipped} ignorados` +
        (data.tag ? ` · etiqueta "${data.tag}"` : '')
      )
      router.refresh()
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Erro na importação')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {msg && <span className="w-full text-xs text-muted sm:w-auto">{msg}</span>}
      <a
        href="/modelo-contatos.csv"
        download
        className="rounded-lg border border-line px-3 py-2 text-xs font-medium text-muted transition-colors hover:border-brand/40 hover:text-brand"
      >
        ⬇ Baixar modelo
      </a>
      <input
        value={tag}
        onChange={(e) => setTag(e.target.value)}
        list="import-tags"
        placeholder="Etiqueta (opcional)"
        className="w-40 rounded-lg border border-line bg-background px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none"
      />
      <datalist id="import-tags">
        {existingTags.map((t) => <option key={t} value={t} />)}
      </datalist>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv,text/plain"
        onChange={onFile}
        className="hidden"
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-40"
      >
        {busy ? 'Importando...' : '⬆ Importar CSV'}
      </button>
    </div>
  )
}
