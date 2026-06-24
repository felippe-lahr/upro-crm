'use client'

import { useState } from 'react'

interface Coupon {
  id: string
  code: string
  description?: string | null
  discount_type: string
  discount_value: number
  max_uses?: number | null
  uses_count: number
  expires_at?: string | null
  active: boolean
  created_at: string
}

export function CouponsPanel({ initialCoupons }: { initialCoupons: Coupon[] }) {
  const [coupons, setCoupons] = useState<Coupon[]>(initialCoupons)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    code: '',
    description: '',
    discount_type: 'percent',
    discount_value: '',
    max_uses: '',
    expires_at: ''
  })
  const [error, setError] = useState('')

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code,
          description: form.description || undefined,
          discount_type: form.discount_type,
          discount_value: Number(form.discount_value),
          max_uses: form.max_uses ? Number(form.max_uses) : undefined,
          expires_at: form.expires_at || undefined
        })
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setCoupons([data, ...coupons])
      setForm({ code: '', description: '', discount_type: 'percent', discount_value: '', max_uses: '', expires_at: '' })
      setCreating(false)
    } catch {
      setError('Erro ao criar cupom')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este cupom?')) return
    await fetch('/api/admin/coupons', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    })
    setCoupons(coupons.filter(c => c.id !== id))
  }

  return (
    <div className="rounded-2xl border border-[#232c38] bg-[#131820] overflow-hidden">
      <div className="px-6 py-4 border-b border-[#232c38] flex items-center justify-between">
        <h2 className="font-semibold text-white">Cupons de Desconto</h2>
        <button
          onClick={() => setCreating(!creating)}
          className="rounded-lg bg-green-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-600 transition-colors"
        >
          + Novo cupom
        </button>
      </div>

      {creating && (
        <form onSubmit={handleCreate} className="p-6 border-b border-[#232c38] grid grid-cols-2 gap-3">
          {error && <div className="col-span-2 text-xs text-red-400 bg-red-500/10 rounded px-3 py-2">{error}</div>}
          <div>
            <label className="text-xs text-[#9aa6b2] mb-1 block">Código *</label>
            <input
              value={form.code}
              onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
              required
              placeholder="BEMVINDO50"
              className="w-full rounded-lg border border-[#232c38] bg-[#0b0f14] px-3 py-2 text-sm text-white focus:border-green-500 focus:outline-none uppercase"
            />
          </div>
          <div>
            <label className="text-xs text-[#9aa6b2] mb-1 block">Descrição</label>
            <input
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Ex: Desconto de lançamento"
              className="w-full rounded-lg border border-[#232c38] bg-[#0b0f14] px-3 py-2 text-sm text-white focus:border-green-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-[#9aa6b2] mb-1 block">Tipo</label>
            <select
              value={form.discount_type}
              onChange={e => setForm({ ...form, discount_type: e.target.value })}
              className="w-full rounded-lg border border-[#232c38] bg-[#0b0f14] px-3 py-2 text-sm text-white focus:border-green-500 focus:outline-none"
            >
              <option value="percent">Percentual (%)</option>
              <option value="fixed">Valor fixo (R$)</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-[#9aa6b2] mb-1 block">
              Desconto * {form.discount_type === 'percent' ? '(%)' : '(R$)'}
            </label>
            <input
              type="number"
              value={form.discount_value}
              onChange={e => setForm({ ...form, discount_value: e.target.value })}
              required
              min="1"
              max={form.discount_type === 'percent' ? '100' : undefined}
              placeholder={form.discount_type === 'percent' ? '50' : '30'}
              className="w-full rounded-lg border border-[#232c38] bg-[#0b0f14] px-3 py-2 text-sm text-white focus:border-green-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-[#9aa6b2] mb-1 block">Limite de usos</label>
            <input
              type="number"
              value={form.max_uses}
              onChange={e => setForm({ ...form, max_uses: e.target.value })}
              placeholder="Ilimitado"
              min="1"
              className="w-full rounded-lg border border-[#232c38] bg-[#0b0f14] px-3 py-2 text-sm text-white focus:border-green-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-[#9aa6b2] mb-1 block">Expira em</label>
            <input
              type="date"
              value={form.expires_at}
              onChange={e => setForm({ ...form, expires_at: e.target.value })}
              className="w-full rounded-lg border border-[#232c38] bg-[#0b0f14] px-3 py-2 text-sm text-white focus:border-green-500 focus:outline-none"
            />
          </div>
          <div className="col-span-2 flex gap-2 justify-end pt-1">
            <button type="button" onClick={() => setCreating(false)} className="px-4 py-2 text-sm text-[#9aa6b2] hover:text-white transition-colors">
              Cancelar
            </button>
            <button type="submit" className="rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white hover:bg-green-600 transition-colors">
              Criar cupom
            </button>
          </div>
        </form>
      )}

      {coupons.length === 0 ? (
        <div className="px-6 py-8 text-center text-sm text-[#6b7886]">Nenhum cupom criado ainda.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#232c38]">
                {['Código', 'Desconto', 'Usos', 'Expira', 'Status', ''].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-[#6b7886] uppercase tracking-wider px-6 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1b222c]">
              {coupons.map(c => (
                <tr key={c.id} className="hover:bg-[#1b222c] transition-colors">
                  <td className="px-6 py-3">
                    <span className="font-mono text-sm font-semibold text-green-400">{c.code}</span>
                    {c.description && <div className="text-xs text-[#6b7886]">{c.description}</div>}
                  </td>
                  <td className="px-6 py-3 text-sm text-white">
                    {c.discount_type === 'percent' ? `${c.discount_value}%` : `R$ ${c.discount_value}`}
                  </td>
                  <td className="px-6 py-3 text-sm text-[#9aa6b2]">
                    {c.uses_count}{c.max_uses ? `/${c.max_uses}` : ''}
                  </td>
                  <td className="px-6 py-3 text-sm text-[#9aa6b2]">
                    {c.expires_at ? new Date(c.expires_at).toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td className="px-6 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${c.active ? 'bg-green-500/20 text-green-400' : 'bg-[#232c38] text-[#9aa6b2]'}`}>
                      {c.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors"
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
