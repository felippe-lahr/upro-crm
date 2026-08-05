'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'

interface TenantLite {
  id: string
  name: string
  email: string
  status: string
  plan: string
  feature_summary_forward?: boolean
}

const PLANS = [
  { v: 'trial', label: 'Trial' },
  { v: 'basic', label: 'Básico' },
  { v: 'pro', label: 'Pro' },
  { v: 'promaster', label: 'Promaster' }
]
const STATUS = [
  { v: 'active', label: 'Ativo' },
  { v: 'pending_payment', label: 'Pendente de pagamento' },
  { v: 'trial', label: 'Trial' },
  { v: 'suspended', label: 'Suspenso' },
  { v: 'cancelled', label: 'Cancelado' }
]

const fieldCls = 'w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none'

export function EditTenant({ tenant }: { tenant: TenantLite }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(tenant.name)
  const [email, setEmail] = useState(tenant.email)
  const [status, setStatus] = useState(tenant.status)
  const [plan, setPlan] = useState(tenant.plan)
  const [trialDays, setTrialDays] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [featureSummaryForward, setFeatureSummaryForward] = useState(!!tenant.feature_summary_forward)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function reset() {
    setName(tenant.name); setEmail(tenant.email); setStatus(tenant.status); setPlan(tenant.plan)
    setTrialDays(''); setNewPassword(''); setFeatureSummaryForward(!!tenant.feature_summary_forward); setError('')
  }

  async function save() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/admin/tenants/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tenant.id, name, email, status, plan,
          featureSummaryForward,
          ...(trialDays !== '' ? { trialDays: Number(trialDays) } : {}),
          ...(newPassword ? { newPassword } : {})
        })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error || 'Erro ao salvar'); return }
      setOpen(false)
      window.location.reload()
    } catch {
      setError('Erro de conexão.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => { reset(); setOpen(true) }}
        className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs text-muted transition-colors hover:border-brand/40 hover:text-brand"
        title="Editar"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !loading && setOpen(false)}>
          <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-fg">Editar tenant</h3>
            <p className="mt-1 text-sm text-muted">{tenant.name}</p>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs text-muted">Nome</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className={fieldCls} />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs text-muted">E-mail (também é o login)</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={fieldCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Plano</label>
                <select value={plan} onChange={(e) => setPlan(e.target.value)} className={fieldCls}>
                  {PLANS.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className={fieldCls}>
                  {STATUS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Estender trial (dias)</label>
                <input type="number" min="0" value={trialDays} onChange={(e) => setTrialDays(e.target.value)} placeholder="deixe vazio p/ não mexer" className={fieldCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Nova senha do login</label>
                <input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="mín. 8 caracteres (opcional)" className={fieldCls} />
              </div>
            </div>

            {/* Entitlements (features de nicho liberadas por tenant) */}
            <div className="mt-4 rounded-lg border border-line bg-background p-3">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-faint">Recursos liberados</div>
              <label className="flex cursor-pointer items-start gap-2.5 py-1">
                <input type="checkbox" checked={featureSummaryForward} onChange={(e) => setFeatureSummaryForward(e.target.checked)} className="mt-0.5" />
                <span className="text-sm text-fg">
                  Encaminhar resumo por WhatsApp
                  <span className="block text-xs text-muted">Libera, nas Configurações do cliente, o envio automático do resumo do atendimento para um número (via template).</span>
                </span>
              </label>
            </div>

            {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} disabled={loading}
                className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-fg hover:bg-surface2 disabled:opacity-40">
                Cancelar
              </button>
              <button onClick={save} disabled={loading}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-40">
                {loading ? 'Salvando…' : 'Salvar alterações'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
