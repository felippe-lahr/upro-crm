'use client'

import { useState } from 'react'

interface Config {
  price_basic: number
  price_pro: number
  price_promaster: number
  annual_discount: number
}

export function PricingPanel({ initialConfig }: { initialConfig: Config }) {
  const [config, setConfig] = useState(initialConfig)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ ...initialConfig })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/admin/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price_basic: Number(form.price_basic),
          price_pro: Number(form.price_pro),
          price_promaster: Number(form.price_promaster),
          annual_discount: Number(form.annual_discount)
        })
      })
      const data = await res.json()
      setConfig({
        price_basic: Number(data.price_basic),
        price_pro: Number(data.price_pro),
        price_promaster: Number(data.price_promaster),
        annual_discount: data.annual_discount
      })
      setEditing(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  const annual = (m: number) => Math.round(m * 12 * (1 - config.annual_discount / 100))

  const inputCls = 'w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none'

  return (
    <div className="rounded-2xl border border-line bg-surface overflow-hidden">
      <div className="px-6 py-4 border-b border-line flex items-center justify-between">
        <h2 className="font-semibold text-fg">Preços & Planos</h2>
        <div className="flex items-center gap-3">
          {saved && <span className="text-xs text-brand">✓ Salvo</span>}
          <button
            onClick={() => { setEditing(!editing); setForm({ ...config }) }}
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted hover:border-brand hover:text-brand transition-colors"
          >
            {editing ? 'Cancelar' : 'Editar'}
          </button>
        </div>
      </div>

      {editing ? (
        <form onSubmit={handleSave} className="p-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div>
            <label className="text-xs text-muted mb-1 block">Básico (R$/mês)</label>
            <input type="number" value={form.price_basic} onChange={e => setForm({ ...form, price_basic: Number(e.target.value) })} required min="1" className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Pro (R$/mês)</label>
            <input type="number" value={form.price_pro} onChange={e => setForm({ ...form, price_pro: Number(e.target.value) })} required min="1" className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Promaster (R$/mês)</label>
            <input type="number" value={form.price_promaster} onChange={e => setForm({ ...form, price_promaster: Number(e.target.value) })} required min="1" className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Desconto anual (%)</label>
            <input type="number" value={form.annual_discount} onChange={e => setForm({ ...form, annual_discount: Number(e.target.value) })} required min="0" max="100" className={inputCls} />
          </div>
          <div className="col-span-2 md:col-span-4 flex justify-end pt-1">
            <button type="submit" disabled={saving} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50 transition-colors">
              {saving ? 'Salvando...' : 'Salvar preços'}
            </button>
          </div>
        </form>
      ) : (
        <div className="p-6 grid grid-cols-1 gap-6 md:grid-cols-4">
          <div className="rounded-xl border border-line p-4">
            <div className="text-xs text-faint mb-2">Plano Básico</div>
            <div className="text-2xl font-bold text-fg">R$ {config.price_basic}<span className="text-sm font-normal text-muted">/mês</span></div>
            <div className="text-xs text-muted mt-1">Anual: R$ {annual(config.price_basic)} ({config.annual_discount}% off)</div>
          </div>
          <div className="rounded-xl border border-line p-4">
            <div className="text-xs text-faint mb-2">Plano Pro</div>
            <div className="text-2xl font-bold text-fg">R$ {config.price_pro}<span className="text-sm font-normal text-muted">/mês</span></div>
            <div className="text-xs text-muted mt-1">Anual: R$ {annual(config.price_pro)} ({config.annual_discount}% off)</div>
          </div>
          <div className="rounded-xl border border-line p-4">
            <div className="text-xs text-faint mb-2">Plano Promaster</div>
            <div className="text-2xl font-bold text-fg">R$ {config.price_promaster}<span className="text-sm font-normal text-muted">/mês</span></div>
            <div className="text-xs text-muted mt-1">Anual: R$ {annual(config.price_promaster)} ({config.annual_discount}% off)</div>
          </div>
          <div className="rounded-xl border border-line p-4">
            <div className="text-xs text-faint mb-2">Desconto anual</div>
            <div className="text-2xl font-bold text-brand">{config.annual_discount}%</div>
            <div className="text-xs text-muted mt-1">para pagamento anual</div>
          </div>
        </div>
      )}
    </div>
  )
}
