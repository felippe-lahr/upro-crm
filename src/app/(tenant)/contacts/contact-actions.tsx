'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

/**
 * Botão de exclusão de contato para a lista de Contatos (funciona no PWA/mobile).
 * Abre um modal de confirmação e chama /api/contacts/delete. Mensagens e conversas
 * são removidas em cascata pelo banco.
 */
export function DeleteContact({ contactId, name }: { contactId: string; name: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function run() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/contacts/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId })
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error || 'Falha ao excluir.')
        return
      }
      setOpen(false)
      router.refresh()
    } catch {
      setError('Erro de conexão.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); setError('') }}
        className="inline-flex items-center justify-center rounded-lg border border-line p-2 text-muted transition-colors hover:border-red-500/40 hover:text-red-500"
        title="Excluir contato"
        aria-label="Excluir contato"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !loading && setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-fg">Excluir “{name}”?</h3>
            <p className="mt-2 text-sm text-muted">
              O contato, suas conversas e todas as mensagens serão apagados permanentemente.
            </p>
            {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} disabled={loading}
                className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-fg hover:bg-surface2 disabled:opacity-40">
                Cancelar
              </button>
              <button onClick={run} disabled={loading}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-40">
                {loading ? 'Excluindo…' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
