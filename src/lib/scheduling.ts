// Utilidades de agendamento (cálculo de horários livres).
// Fuso fixo do Brasil (sem horário de verão desde 2019).
const TZ = '-03:00'

export function weekdayOf(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

const WD_NAMES = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
export function weekdayName(dateStr: string): string {
  return WD_NAMES[weekdayOf(dateStr)] || ''
}

function minToHM(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/**
 * Retorna os horários livres ("HH:MM") de um dia, dado a duração do serviço,
 * respeitando os horários de atendimento e os agendamentos já existentes.
 */
export async function getAvailableSlots(prisma: any, dateStr: string, durationMin: number, gapMin = 0): Promise<string[]> {
  const wd = weekdayOf(dateStr)
  const rules = await prisma.availability.findMany({ where: { weekday: wd } })
  if (!rules.length) return []

  const dayStart = new Date(`${dateStr}T00:00:00${TZ}`)
  const dayEnd = new Date(`${dateStr}T23:59:59${TZ}`)
  const existing = await prisma.appointment.findMany({
    where: { status: { notIn: ['cancelled', 'no_show'] }, start_at: { gte: dayStart, lte: dayEnd } }
  })

  const gapMs = gapMin * 60000
  const now = Date.now()
  const slots: string[] = []
  for (const r of rules) {
    // Passo de duração + intervalo (gap) entre atendimentos.
    for (let m = r.start_min; m + durationMin <= r.end_min; m += durationMin + gapMin) {
      const hm = minToHM(m)
      const start = new Date(`${dateStr}T${hm}:00${TZ}`)
      const end = new Date(start.getTime() + durationMin * 60000)
      if (start.getTime() < now) continue
      // Considera o gap como bloqueio antes/depois de cada agendamento existente.
      const overlap = existing.some((a: any) =>
        start.getTime() < a.end_at.getTime() + gapMs && end.getTime() + gapMs > a.start_at.getTime())
      if (!overlap) slots.push(hm)
    }
  }
  return slots
}

/** Monta um Date (UTC) a partir de data + hora no fuso do Brasil. */
export function brDateTime(dateStr: string, hm: string): Date {
  return new Date(`${dateStr}T${hm}:00${TZ}`)
}
