'use client'

import { useState } from 'react'
import { FUNNEL_STAGES } from '@/lib/funnel'

export interface LeadCard {
  id: string
  name: string | null
  phone: string
  stage: string
  deal_value: string | null
  lastMessage: string | null
}

export function KanbanBoard({ initialLeads }: { initialLeads: LeadCard[] }) {
  const [leads, setLeads] = useState<LeadCard[]>(initialLeads)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overStage, setOverStage] = useState<string | null>(null)

  async function moveLead(contactId: string, stage: string) {
    const prev = leads
    setLeads((ls) => ls.map((l) => (l.id === contactId ? { ...l, stage } : l)))
    try {
      const res = await fetch('/api/leads/stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId, stage })
      })
      if (!res.ok) throw new Error('falhou')
    } catch {
      setLeads(prev) // rollback
    }
  }

  function onDrop(stage: string) {
    if (dragId) moveLead(dragId, stage)
    setDragId(null)
    setOverStage(null)
  }

  function formatBRL(v: string | null) {
    if (!v) return null
    const n = Number(v)
    if (!n) return null
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {FUNNEL_STAGES.map((stage) => {
        const stageLeads = leads.filter((l) => l.stage === stage.id)
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
              overStage === stage.id ? 'bg-green-500/10 ring-2 ring-green-500/50' : 'bg-surface2'
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
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-green-500/15 text-xs font-medium text-green-400">
                      {(lead.name || lead.phone)[0].toUpperCase()}
                    </div>
                    <span className="truncate text-sm font-medium text-fg">
                      {lead.name || lead.phone}
                    </span>
                  </div>
                  {lead.lastMessage && (
                    <p className="truncate pl-9 text-xs text-faint">{lead.lastMessage}</p>
                  )}
                  <div className="mt-2 flex items-center justify-between pl-9">
                    <span className="text-xs text-faint">{lead.phone}</span>
                    {formatBRL(lead.deal_value) && (
                      <span className="text-xs font-semibold text-green-400">
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
  )
}
