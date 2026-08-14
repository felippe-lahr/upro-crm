'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { MoveRight } from 'lucide-react'
import { FUNNEL_STAGES, LOST_STAGE_ID, type Stage } from '@/lib/funnel'

export interface LeadCard {
  id: string
  name: string | null
  phone: string
  email: string | null
  notes: string | null
  stage: string
  deal_value: string | null
  lastMessage: string | null
  tags: string[]
  lossReason?: string | null
  createdAt: string
}

const DATE_PRESETS = [
  { id: 'all', label: 'Todos' },
  { id: 'today', label: 'Hoje' },
  { id: '7d', label: '7 dias' },
  { id: '30d', label: '30 dias' }
]

function withinPreset(iso: string, preset: string): boolean {
  if (preset === 'all') return true
  const d = new Date(iso).getTime()
  if (preset === 'today') {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    return d >= start.getTime()
  }
  const days = preset === '7d' ? 7 : 30
  return d >= Date.now() - days * 24 * 60 * 60 * 1000
}

export function KanbanBoard({
  initialLeads,
  stages = FUNNEL_STAGES,
  lossReasons = [],
  isPro = false
}: {
  initialLeads: LeadCard[]
  stages?: Stage[]
  lossReasons?: string[]
  isPro?: boolean
}) {
  const [leads, setLeads] = useState<LeadCard[]>(initialLeads)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overStage, setOverStage] = useState<string | null>(null)
  const [datePreset, setDatePreset] = useState('all')
  const [activeTags, setActiveTags] = useState<string[]>([])
  const [pendingLost, setPendingLost] = useState<string | null>(null) // contactId aguardando motivo
  const [config, setConfig] = useState(false)
  const [menuId, setMenuId] = useState<string | null>(null) // card com o menu "mover" aberto (mobile)
  const [detailId, setDetailId] = useState<string | null>(null) // card com o painel de detalhes aberto

  const detailLead = useMemo(() => leads.find((l) => l.id === detailId) || null, [leads, detailId])

  // Salva alterações de campos do lead (nome, e-mail, valor, observações) — otimista.
  async function updateLead(contactId: string, patch: Partial<LeadCard>) {
    const prev = leads
    setLeads((ls) => ls.map((l) => (l.id === contactId ? { ...l, ...patch } : l)))
    try {
      const res = await fetch('/api/contacts/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId, ...patch })
      })
      if (!res.ok) throw new Error('falhou')
    } catch {
      setLeads(prev) // rollback
    }
  }

  // Move via botão (toque) — respeita o fluxo de motivo de perda.
  function requestMove(contactId: string, stage: string) {
    setMenuId(null)
    if (stage === LOST_STAGE_ID && lossReasons.length > 0) {
      setPendingLost(contactId)
      return
    }
    moveLead(contactId, stage)
  }

  const allTags = useMemo(
    () => Array.from(new Set(leads.flatMap((l) => l.tags))).sort(),
    [leads]
  )

  const visibleLeads = useMemo(
    () =>
      leads.filter((l) => {
        if (!withinPreset(l.createdAt, datePreset)) return false
        if (activeTags.length > 0 && !activeTags.some((t) => l.tags.includes(t))) return false
        return true
      }),
    [leads, datePreset, activeTags]
  )

  function toggleTag(t: string) {
    setActiveTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
  }

  async function moveLead(contactId: string, stage: string, lossReason?: string | null) {
    const prev = leads
    setLeads((ls) => ls.map((l) => (l.id === contactId ? { ...l, stage, lossReason: stage === LOST_STAGE_ID ? (lossReason || null) : null } : l)))
    try {
      const res = await fetch('/api/leads/stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId, stage, loss_reason: lossReason })
      })
      if (!res.ok) throw new Error('falhou')
    } catch {
      setLeads(prev) // rollback
    }
  }

  function onDrop(stage: string) {
    const id = dragId
    setDragId(null)
    setOverStage(null)
    if (!id) return
    // Ao soltar em "perdido" com motivos configurados, pede o motivo antes de mover.
    if (stage === LOST_STAGE_ID && lossReasons.length > 0) {
      setPendingLost(id)
      return
    }
    moveLead(id, stage)
  }

  function formatBRL(v: string | null) {
    if (!v) return null
    const n = Number(v)
    if (!n) return null
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  return (
    <div>
      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex overflow-hidden rounded-lg border border-line">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => setDatePreset(p.id)}
              className={`px-3 py-2 text-xs font-medium transition-colors ${
                datePreset === p.id ? 'bg-brand text-white' : 'bg-surface text-muted hover:text-fg'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-faint">Etiquetas:</span>
            {allTags.map((t) => (
              <button
                key={t}
                onClick={() => toggleTag(t)}
                className={`rounded-full px-2.5 py-0.5 text-xs transition-colors ${
                  activeTags.includes(t) ? 'bg-brand text-white' : 'bg-surface2 text-muted hover:text-fg'
                }`}
              >
                {t}
              </button>
            ))}
            {activeTags.length > 0 && (
              <button onClick={() => setActiveTags([])} className="text-xs text-faint hover:text-red-400">
                limpar
              </button>
            )}
          </div>
        )}
        {isPro && (
          <button onClick={() => setConfig(true)} className="ml-auto rounded-lg border border-line px-3 py-2 text-xs font-medium text-muted hover:text-fg">
            Personalizar funil
          </button>
        )}
      </div>

      {config && (
        <FunnelConfig
          stages={stages}
          lossReasons={lossReasons}
          onClose={() => setConfig(false)}
        />
      )}

      {pendingLost && (
        <LossReasonModal
          reasons={lossReasons}
          onCancel={() => setPendingLost(null)}
          onPick={(reason) => { moveLead(pendingLost, LOST_STAGE_ID, reason); setPendingLost(null) }}
        />
      )}

      {detailLead && (
        <LeadDetailModal
          lead={detailLead}
          stages={stages}
          onClose={() => setDetailId(null)}
          onSave={(patch) => updateLead(detailLead.id, patch)}
        />
      )}

      <div className="flex gap-4 overflow-x-auto pb-4">
      {stages.map((stage) => {
        const stageLeads = visibleLeads.filter((l) => l.stage === stage.id)
        const total = stageLeads.reduce((sum, l) => sum + Number(l.deal_value || 0), 0)
        return (
          <div
            key={stage.id}
            onDragOver={(e) => {
              e.preventDefault()
              setOverStage(stage.id)
            }}
            onDragLeave={() => setOverStage(null)}
            onDrop={() => onDrop(stage.id)}
            className={`w-72 flex-shrink-0 rounded-2xl p-3 transition-colors ${
              overStage === stage.id ? 'bg-brand/10 ring-2 ring-brand/50' : 'bg-surface2'
            }`}
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${stage.color}`} />
                <span className="text-sm font-semibold text-fg">{stage.label}</span>
                <span className="text-xs text-faint">{stageLeads.length}</span>
              </div>
              {total > 0 && (
                <span className="text-xs font-medium text-muted">
                  {formatBRL(String(total))}
                </span>
              )}
            </div>

            <div className="min-h-[60px] space-y-2">
              {stageLeads.map((lead) => (
                <div
                  key={lead.id}
                  draggable
                  onDragStart={() => setDragId(lead.id)}
                  onDragEnd={() => setDragId(null)}
                  onClick={() => { if (!dragId) setDetailId(lead.id) }}
                  className={`cursor-pointer rounded-xl border border-line bg-surface p-3 shadow-sm ${
                    dragId === lead.id ? 'opacity-50' : ''
                  }`}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand/15 text-xs font-medium text-brand">
                      {(lead.name || lead.phone)[0].toUpperCase()}
                    </div>
                    <span className="truncate text-sm font-medium text-fg">
                      {lead.name || lead.phone}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenuId(menuId === lead.id ? null : lead.id) }}
                      className="ml-auto flex-shrink-0 rounded-md p-1.5 text-faint transition-colors hover:bg-brand/5 hover:text-brand"
                      title="Mover para outra etapa"
                      aria-label="Mover"
                    >
                      <MoveRight className="h-4 w-4" />
                    </button>
                  </div>

                  {menuId === lead.id && (
                    <div className="mt-2 space-y-1 rounded-lg border border-line bg-background p-1.5">
                      <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-faint">Mover para</p>
                      {stages.filter((s) => s.id !== lead.stage).map((s) => (
                        <button
                          key={s.id}
                          onClick={(e) => { e.stopPropagation(); requestMove(lead.id, s.id) }}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs text-fg hover:bg-brand/5"
                        >
                          <span className={`h-2 w-2 flex-shrink-0 rounded-full ${s.color}`} />
                          {s.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {lead.lastMessage && (
                    <p className="truncate pl-9 text-xs text-faint">{lead.lastMessage}</p>
                  )}
                  {lead.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1 pl-9">
                      {lead.tags.map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-brand/15 px-2 py-0.5 text-[11px] text-brand"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  {stage.id === LOST_STAGE_ID && lead.lossReason && (
                    <div className="mt-2 pl-9">
                      <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] text-red-500">Motivo: {lead.lossReason}</span>
                    </div>
                  )}
                  <div className="mt-2 flex items-center justify-between pl-9">
                    <span className="text-xs text-faint">{lead.phone}</span>
                    {formatBRL(lead.deal_value) && (
                      <span className="text-xs font-semibold text-brand">
                        {formatBRL(lead.deal_value)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {stageLeads.length === 0 && (
                <div className="rounded-xl border-2 border-dashed border-line px-2 py-4 text-center text-xs text-faint">
                  Arraste um lead aqui ou use o botão <MoveRight className="mx-0.5 inline h-3 w-3" /> no card
                </div>
              )}
            </div>
          </div>
        )
      })}
      </div>
    </div>
  )
}

function LossReasonModal({ reasons, onPick, onCancel }: {
  reasons: string[]
  onPick: (reason: string) => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-1 text-base font-semibold text-fg">Motivo da perda</h3>
        <p className="mb-4 text-sm text-muted">Selecione por que este lead foi perdido.</p>
        <div className="space-y-2">
          {reasons.map((r) => (
            <button key={r} onClick={() => onPick(r)} className="block w-full rounded-lg border border-line bg-background px-3 py-2 text-left text-sm hover:border-brand hover:bg-brand/5">
              {r}
            </button>
          ))}
        </div>
        <button onClick={onCancel} className="mt-4 w-full rounded-lg px-3 py-2 text-sm text-muted hover:text-fg">Cancelar</button>
      </div>
    </div>
  )
}

function LeadDetailModal({ lead, stages, onClose, onSave }: {
  lead: LeadCard
  stages: Stage[]
  onClose: () => void
  onSave: (patch: Partial<LeadCard>) => void
}) {
  const [name, setName] = useState(lead.name || '')
  const [email, setEmail] = useState(lead.email || '')
  const [dealValue, setDealValue] = useState(lead.deal_value || '')
  const [stage, setStage] = useState(lead.stage)
  const [notes, setNotes] = useState(lead.notes || '')

  function save() {
    onSave({
      name: name.trim() || null,
      email: email.trim() || null,
      deal_value: dealValue ? String(Number(String(dealValue).replace(',', '.'))) : null,
      stage,
      notes: notes.trim() || null
    })
    onClose()
  }

  const waPhone = lead.phone.replace(/\D/g, '')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl border border-line bg-surface p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand/15 text-sm font-semibold text-brand">
            {(lead.name || lead.phone)[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-fg">{lead.name || lead.phone}</h3>
            <p className="truncate text-xs text-faint">{lead.phone}</p>
          </div>
        </div>

        {lead.tags.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {lead.tags.map((t) => (
              <span
                key={t}
                className={
                  t.startsWith('anúncio')
                    ? 'rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400'
                    : 'rounded-full bg-brand/15 px-2 py-0.5 text-[11px] text-brand'
                }
              >
                {t.startsWith('anúncio') ? `📣 ${t}` : t}
              </span>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Nome</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm focus:border-brand focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">E-mail</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm focus:border-brand focus:outline-none" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-muted">Valor (R$)</label>
              <input value={dealValue} onChange={(e) => setDealValue(e.target.value)} inputMode="decimal" placeholder="0,00" className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm focus:border-brand focus:outline-none" />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-muted">Etapa</label>
              <select value={stage} onChange={(e) => setStage(e.target.value)} className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm focus:border-brand focus:outline-none">
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Observações</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full resize-none rounded-lg border border-line bg-background px-3 py-2 text-sm focus:border-brand focus:outline-none" />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button onClick={save} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">Salvar</button>
          <Link href={`/conversations/${lead.id}`} className="rounded-lg border border-brand px-4 py-2 text-sm font-medium text-brand hover:bg-brand/5">Abrir conversa</Link>
          {waPhone && (
            <a href={`https://wa.me/${waPhone}`} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-line px-4 py-2 text-sm text-muted hover:text-fg">WhatsApp</a>
          )}
          <button onClick={onClose} className="ml-auto rounded-lg px-4 py-2 text-sm text-muted hover:text-fg">Fechar</button>
        </div>
      </div>
    </div>
  )
}

function FunnelConfig({ stages, lossReasons, onClose }: {
  stages: Stage[]
  lossReasons: string[]
  onClose: () => void
}) {
  const [labels, setLabels] = useState<Record<string, string>>(() => Object.fromEntries(stages.map((s) => [s.id, s.label])))
  const [reasons, setReasons] = useState<string[]>(() => (lossReasons.length ? [...lossReasons] : ['']))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function setReason(i: number, v: string) { setReasons((rs) => rs.map((r, idx) => (idx === i ? v : r))) }
  function addReason() { setReasons((rs) => (rs.length >= 10 ? rs : [...rs, ''])) }
  function delReason(i: number) { setReasons((rs) => rs.filter((_, idx) => idx !== i)) }

  async function save() {
    setSaving(true); setError('')
    const res = await fetch('/api/funnel/config', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ funnel_labels: labels, loss_reasons: reasons.filter((r) => r.trim()) })
    })
    setSaving(false)
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error || 'Erro ao salvar.'); return }
    window.location.reload()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-surface p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-base font-semibold text-fg">Personalizar funil</h3>

        <div className="mb-5">
          <p className="mb-2 text-sm font-medium text-fg">Nomes das etapas</p>
          <div className="space-y-2">
            {stages.map((s) => (
              <div key={s.id} className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${s.color}`} />
                <input value={labels[s.id] || ''} onChange={(e) => setLabels({ ...labels, [s.id]: e.target.value })} className="flex-1 rounded-lg border border-line bg-background px-3 py-1.5 text-sm focus:border-brand focus:outline-none" />
              </div>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <p className="mb-1 text-sm font-medium text-fg">Motivos de perda (até 10)</p>
          <p className="mb-2 text-xs text-muted">Ao arrastar um lead para a etapa de perdido, você escolhe um destes motivos.</p>
          <div className="space-y-2">
            {reasons.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <input value={r} onChange={(e) => setReason(i, e.target.value)} placeholder={`Motivo ${i + 1}`} className="flex-1 rounded-lg border border-line bg-background px-3 py-1.5 text-sm focus:border-brand focus:outline-none" />
                <button onClick={() => delReason(i)} className="text-faint hover:text-red-500 text-sm px-2">✕</button>
              </div>
            ))}
          </div>
          {reasons.length < 10 && (
            <button onClick={addReason} className="mt-2 text-sm text-brand hover:underline">+ Adicionar motivo</button>
          )}
        </div>

        {error && <p className="mb-3 text-sm text-red-500">{error}</p>}
        <div className="flex gap-2">
          <button onClick={save} disabled={saving} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">{saving ? 'Salvando…' : 'Salvar'}</button>
          <button onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm text-muted hover:text-fg">Cancelar</button>
        </div>
      </div>
    </div>
  )
}
