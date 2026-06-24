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
            className={`flex-shrink-0 w-72 rounded-2xl p-3 transition-colors ${
              overStage === stage.id ? 'bg-green-50 ring-2 ring-green-300' : 'bg-gray-100'
            }`}
          >
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${stage.color}`} />
                <span className="text-sm font-semibold text-gray-700">{stage.label}</span>
                <span className="text-xs text-gray-400">{stageLeads.length}</span>
              </div>
              {total > 0 && (
                <span className="text-xs font-medium text-gray-500">
                  {formatBRL(String(total))}
                </span>
              )}
            </div>

            <div className="space-y-2 min-h-[60px]">
              {stageLeads.map((lead) => (
                <div
                  key={lead.id}
                  draggable
                  onDragStart={() => setDragId(lead.id)}
                  onDragEnd={() => setDragId(null)}
                  className={`bg-white rounded-xl p-3 shadow-sm border border-gray-100 cursor-grab active:cursor-grabbing ${
                    dragId === lead.id ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-7 h-7 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-medium text-xs flex-shrink-0">
                      {(lead.name || lead.phone)[0].toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {lead.name || lead.phone}
                    </span>
                  </div>
                  {lead.lastMessage && (
                    <p className="text-xs text-gray-400 truncate pl-9">{lead.lastMessage}</p>
                  )}
                  <div className="flex items-center justify-between mt-2 pl-9">
                    <span className="text-xs text-gray-400">{lead.phone}</span>
                    {formatBRL(lead.deal_value) && (
                      <span className="text-xs font-semibold text-green-600">
                        {formatBRL(lead.deal_value)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {stageLeads.length === 0 && (
                <div className="text-xs text-gray-300 text-center py-4 border-2 border-dashed border-gray-200 rounded-xl">
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
