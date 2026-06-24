'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

export function ImportContacts() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
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
        body: JSON.stringify({ csv })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha')
      setMsg(`${data.imported} importados, ${data.skipped} ignorados`)
      router.refresh()
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Erro na importação')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex items-center gap-3">
      {msg && <span className="text-xs text-muted">{msg}</span>}
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
        className="rounded-xl bg-green-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-600 disabled:opacity-40"
      >
        {busy ? 'Importando...' : '⬆ Importar CSV'}
      </button>
    </div>
  )
}
