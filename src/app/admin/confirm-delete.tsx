'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'

const PHRASE = 'Confirma'

/**
 * Botão de exclusão com dupla validação: abre um modal e só libera o botão
 * quando o usuário digita exatamente "Confirma".
 */
export function ConfirmDelete({
  title,
  description,
  endpoint,
  method = 'POST',
  payload,
  onDeleted
}: {
  title: string
  description: string
  endpoint: string
  method?: 'POST' | 'DELETE'
  payload: Record<string, unknown>
  onDeleted?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function run() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error || 'Erro ao excluir'); return }
      setOpen(false)
      setText('')
      if (onDeleted) onDeleted()
      else window.location.reload()
    } catch {
      setError('Erro de conexão.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); setText(''); setError('') }}
        className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs text-muted transition-colors hover:border-red-500/40 hover:text-red-400"
        title="Excluir"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !loading && setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-fg">{title}</h3>
            <p className="mt-2 text-sm text-muted">{description}</p>
            <p className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
              Esta ação é permanente e não pode ser desfeita.
            </p>

            <label className="mt-4 block text-xs text-muted">
              Para confirmar, digite <strong className="text-fg">{PHRASE}</strong> abaixo:
            </label>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={PHRASE}
              autoFocus
              className="mt-1.5 w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-fg focus:border-red-500 focus:outline-none"
            />
            {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} disabled={loading}
                className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-fg hover:bg-surface2 disabled:opacity-40">
                Cancelar
              </button>
              <button
                onClick={run}
                disabled={loading || text.trim() !== PHRASE}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? 'Excluindo…' : 'Excluir permanentemente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
