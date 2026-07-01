export interface Stage {
  id: string
  label: string
  color: string
}

export const FUNNEL_STAGES: Stage[] = [
  { id: 'novo_lead', label: 'Novo Lead', color: 'bg-gray-400' },
  { id: 'em_atendimento', label: 'Em Atendimento', color: 'bg-blue-500' },
  { id: 'proposta', label: 'Proposta Enviada', color: 'bg-amber-500' },
  { id: 'negociacao', label: 'Negociação', color: 'bg-purple-500' },
  { id: 'ganho', label: 'Fechado (Ganho)', color: 'bg-green-500' },
  { id: 'perdido', label: 'Perdido', color: 'bg-red-400' }
]

export const STAGE_IDS = FUNNEL_STAGES.map((s) => s.id)

// Id da etapa de "lead perdido" (onde se aplicam os motivos de perda).
export const LOST_STAGE_ID = 'perdido'

/** Mescla os rótulos padrão com os personalizados do tenant. */
export function resolveStages(labels?: Record<string, string> | null): Stage[] {
  if (!labels) return FUNNEL_STAGES
  return FUNNEL_STAGES.map((s) => ({
    ...s,
    label: typeof labels[s.id] === 'string' && labels[s.id].trim() ? labels[s.id].trim() : s.label
  }))
}
