'use client'

import { useMemo, useState } from 'react'
import { FUNNEL_STAGES, LOST_STAGE_ID, type Stage } from '@/lib/funnel'

export interface LeadCard {
  id: string
  name: string | null
  phone: string
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
                  className={`cursor-grab rounded-xl border border-line bg-surface p-3 shadow-sm active:cursor-grabbing ${
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
                  </div>
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
                <div className="rounded-xl border-2 border-dashed border-line py-4 text-center text-xs text-faint">
                  Arraste leads aqui
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
