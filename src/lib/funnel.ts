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
