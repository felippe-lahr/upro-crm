'use client'

import { useState } from 'react'
import { FileText } from 'lucide-react'

const STATUSES = [
  { v: 'novo', label: 'Novo' },
  { v: 'em_separacao', label: 'Em separação' },
  { v: 'concluido', label: 'Concluído' },
  { v: 'cancelado', label: 'Cancelado' }
]

export function OrderStatus({ orderId, status }: { orderId: string; status: string }) {
  const [value, setValue] = useState(status)
  const [saving, setSaving] = useState(false)

  async function change(next: string) {
    const prev = value
    setValue(next); setSaving(true)
    try {
      const res = await fetch('/api/orders/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status: next })
      })
      if (!res.ok) setValue(prev)
    } catch {
      setValue(prev)
    } finally {
      setSaving(false)
    }
  }

  return (
    <select
      value={value}
      disabled={saving}
      onChange={(e) => change(e.target.value)}
      className="rounded-lg border border-line bg-background px-2 py-1 text-xs text-fg focus:border-brand focus:outline-none disabled:opacity-50"
    >
      {STATUSES.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
    </select>
  )
}

export function OrderPdfLink({ token }: { token: string }) {
  return (
    <a
      href={`/api/pedido/${token}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs text-muted transition-colors hover:border-brand/40 hover:text-brand"
    >
      <FileText className="h-3.5 w-3.5" /> PDF
    </a>
  )
}
