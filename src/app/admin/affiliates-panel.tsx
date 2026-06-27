'use client'

import { useEffect, useState } from 'react'

interface Affiliate {
  id: string
  name: string
  email: string
  code: string
  commission_type: string
  commission_value: number
  recurrence: string
  status: string
  pix_key: string | null
  referred: number
  pending: number
  paid: number
}

interface Commission {
  id: string
  tenant: string
  amount: number
  reference_month: string
  status: string
}

const RECUR_LABEL: Record<string, string> = { lifetime: 'Vitalícia', '12m': '12 meses', first: '1ª venda' }

export function AffiliatesPanel({ baseUrl }: { baseUrl: string }) {
  const [list, setList] = useState<Affiliate[]>([])
  const [open, setOpen] = useState<string | null>(null)
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', commission_type: 'percent', commission_value: 30, recurrence: 'lifetime' })

  async function load() {
    const r = await fetch('/api/admin/affiliates', { cache: 'no-store' })
    if (r.ok) setList(await r.json())
  }
  useEffect(() => { load() }, [])

  async function patch(id: string, body: any) {
    await fetch('/api/admin/affiliates', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...body }) })
    load()
  }

  async function create(e: React.FormEvent) {
    e.preventDefault()
    const r = await fetch('/api/admin/affiliates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    if (r.ok) { setForm({ name: '', email: '', password: '', commission_type: 'percent', commission_value: 30, recurrence: 'lifetime' }); setCreating(false); load() }
    else alert((await r.json()).error || 'Erro')
  }

  async function viewCommissions(id: string) {
    if (open === id) { setOpen(null); return }
    setOpen(id)
    const r = await fetch(`/api/admin/affiliates/commissions?affiliate_id=${id}`, { cache: 'no-store' })
    if (r.ok) setCommissions(await r.json())
  }

  async function markPaid(affiliateId: string) {
    if (!confirm('Marcar todas as comissões pendentes deste afiliado como pagas?')) return
    await fetch('/api/admin/affiliates/commissions', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ affiliate_id: affiliateId }) })
    load(); if (open === affiliateId) viewCommissions(affiliateId)
  }

  return (
    <div className="rounded-2xl border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-6 py-4">
        <h2 className="font-semibold text-fg">Programa de Afiliados</h2>
        <button onClick={() => setCreating(!creating)} className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600">
          {creating ? 'Cancelar' : '+ Novo afiliado'}
        </button>
      </div>

      {creating && (
        <form onSubmit={create} className="grid grid-cols-1 gap-3 border-b border-line bg-surface2 p-6 sm:grid-cols-2">
          <input required placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-lg border border-line bg-background px-3 py-2 text-sm" />
          <input required type="email" placeholder="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-lg border border-line bg-background px-3 py-2 text-sm" />
          <input required type="password" placeholder="Senha (mín 8)" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="rounded-lg border border-line bg-background px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <select value={form.commission_type} onChange={(e) => setForm({ ...form, commission_type: e.target.value })} className="rounded-lg border border-line bg-background px-2 py-2 text-sm">
              <option value="percent">%</option>
              <option value="fixed">R$</option>
            </select>
            <input type="number" placeholder="Comissão" value={form.commission_value} onChange={(e) => setForm({ ...form, commission_value: Number(e.target.value) })} className="w-24 rounded-lg border border-line bg-background px-3 py-2 text-sm" />
            <select value={form.recurrence} onChange={(e) => setForm({ ...form, recurrence: e.target.value })} className="flex-1 rounded-lg border border-line bg-background px-2 py-2 text-sm">
              <option value="lifetime">Vitalícia</option>
              <option value="12m">12 meses</option>
              <option value="first">1ª venda</option>
            </select>
          </div>
          <button className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 sm:col-span-2">Criar afiliado</button>
        </form>
      )}

      <div className="divide-y divide-line">
        {list.length === 0 && <div className="px-6 py-8 text-center text-sm text-muted">Nenhum afiliado ainda.</div>}
        {list.map((a) => (
          <div key={a.id}>
            <div className="flex flex-wrap items-center gap-4 px-6 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-fg">{a.name}</span>
                  <StatusBadge status={a.status} />
                </div>
                <div className="text-xs text-muted">{a.email}</div>
                {a.status === 'active' && (
                  <button
                    onClick={() => navigator.clipboard.writeText(`${baseUrl}/?ref=${a.code}`)}
                    className="mt-1 text-xs text-brand hover:underline"
                    title="Copiar link"
                  >
                    {baseUrl}/?ref={a.code} 📋
                  </button>
                )}
              </div>

              <div className="text-center">
                <div className="text-xs text-faint">Comissão</div>
                <div className="text-sm font-medium text-fg">
                  {a.commission_type === 'percent' ? `${a.commission_value}%` : `R$ ${a.commission_value}`}
                  <span className="text-faint"> · {RECUR_LABEL[a.recurrence]}</span>
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-faint">Indicados</div>
                <div className="text-sm font-medium text-fg">{a.referred}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-faint">A pagar</div>
                <div className="text-sm font-semibold text-brand">R$ {a.pending.toFixed(2)}</div>
              </div>

              <div className="flex items-center gap-2">
                {a.status === 'pending' && (
                  <>
                    <button onClick={() => patch(a.id, { status: 'active' })} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600">Aprovar</button>
                    <button onClick={() => patch(a.id, { status: 'rejected' })} className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted hover:text-red-400">Recusar</button>
                  </>
                )}
                {a.status === 'active' && (
                  <>
                    <button onClick={() => viewCommissions(a.id)} className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted hover:text-fg">{open === a.id ? 'Fechar' : 'Vendas'}</button>
                    {a.pending > 0 && <button onClick={() => markPaid(a.id)} className="rounded-lg border border-line px-3 py-1.5 text-xs text-brand hover:bg-brand/10">Marcar pago</button>}
                    <button onClick={() => patch(a.id, { status: 'suspended' })} className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted hover:text-red-400">Suspender</button>
                  </>
                )}
                {a.status === 'suspended' && (
                  <button onClick={() => patch(a.id, { status: 'active' })} className="rounded-lg border border-line px-3 py-1.5 text-xs text-brand">Reativar</button>
                )}
              </div>
            </div>

            {open === a.id && (
              <div className="border-t border-line bg-surface2 px-6 py-4">
                {/* Editar comissão */}
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-faint">Editar comissão:</span>
                  <select defaultValue={a.commission_type} onChange={(e) => patch(a.id, { commission_type: e.target.value })} className="rounded border border-line bg-background px-2 py-1">
                    <option value="percent">%</option><option value="fixed">R$</option>
                  </select>
                  <input type="number" defaultValue={a.commission_value} onBlur={(e) => patch(a.id, { commission_value: Number(e.target.value) })} className="w-20 rounded border border-line bg-background px-2 py-1" />
                  <select defaultValue={a.recurrence} onChange={(e) => patch(a.id, { recurrence: e.target.value })} className="rounded border border-line bg-background px-2 py-1">
                    <option value="lifetime">Vitalícia</option><option value="12m">12 meses</option><option value="first">1ª venda</option>
                  </select>
                </div>
                {commissions.length === 0 ? (
                  <p className="text-xs text-muted">Nenhuma comissão registrada ainda.</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead><tr className="text-faint"><th className="py-1 text-left">Cliente</th><th className="text-left">Mês</th><th className="text-right">Valor</th><th className="text-right">Status</th></tr></thead>
                    <tbody>
                      {commissions.map((c) => (
                        <tr key={c.id} className="border-t border-line">
                          <td className="py-1.5 text-fg">{c.tenant}</td>
                          <td className="text-muted">{c.reference_month}</td>
                          <td className="text-right font-medium text-fg">R$ {c.amount.toFixed(2)}</td>
                          <td className="text-right"><span className={c.status === 'paid' ? 'text-brand' : 'text-yellow-500'}>{c.status === 'paid' ? 'Pago' : 'Pendente'}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'bg-brand/15 text-brand',
    pending: 'bg-yellow-500/15 text-yellow-500',
    rejected: 'bg-red-500/15 text-red-400',
    suspended: 'bg-surface2 text-muted'
  }
  const label: Record<string, string> = { active: 'Ativo', pending: 'Pendente', rejected: 'Recusado', suspended: 'Suspenso' }
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${map[status] || ''}`}>{label[status] || status}</span>
}
