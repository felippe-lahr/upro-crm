import { globalPrisma, getTenantPrisma } from './prisma-tenant'
import { sendWhatsAppTemplate } from './bot'
import { getSummaryTemplateStatus } from './whatsapp-templates'

// Conversa considerada "assentada" após este tempo sem mensagem nova → o resumo
// já está completo e pode ser encaminhado. (O cron roda a cada ~15 min.)
const SETTLE_MS = 8 * 60 * 1000
// Não encaminha leads antigos: só conversas cuja última mensagem foi nas últimas 24h.
const MAX_AGE_MS = 24 * 60 * 60 * 1000

/**
 * Varredura (chamada pelo cron): para cada tenant com a feature ligada, envia o
 * RESUMO COMPLETO (ai_summary atual) ao número configurado, uma vez por lead,
 * assim que a conversa assenta. Assim o WhatsApp recebe o mesmo texto do CRM.
 */
export async function forwardPendingSummaries(now: Date): Promise<number> {
  let sent = 0
  const tenants = await globalPrisma.tenant.findMany({
    where: {
      status: 'active',
      feature_summary_forward: true,
      whatsapp_connected: true,
      phone_number_id: { not: null },
      whatsapp_token: { not: null },
      summary_forward_number: { not: null },
      summary_forward_template: { not: null }
    }
  }).catch(() => [])

  for (const t of tenants as any[]) {
    if (!t.schema_name || !t.summary_forward_number || !t.summary_forward_template) continue

    // Só envia se o template estiver aprovado (evita disparos que falham).
    try {
      const st = await getSummaryTemplateStatus({ waba_id: t.waba_id, whatsapp_token: t.whatsapp_token }, t.summary_forward_template)
      if (st.status !== 'APPROVED') continue
    } catch { continue }

    let db: any
    try { db = getTenantPrisma(t.schema_name) } catch { continue }

    const settleCutoff = new Date(now.getTime() - SETTLE_MS)
    const oldCutoff = new Date(now.getTime() - MAX_AGE_MS)
    const to = String(t.summary_forward_number).replace(/\D/g, '')

    let candidates: any[] = []
    try {
      candidates = await db.contact.findMany({
        where: {
          ai_summary: { not: null },
          summary_forwarded_at: null,
          stage: { not: 'novo_lead' } // já qualificado
        },
        orderBy: { updated_at: 'desc' },
        take: 100
      })
    } catch { continue }

    for (const c of candidates) {
      // Conversa precisa ter assentado (sem msg nova há SETTLE_MS) e ser recente.
      let last: any
      try {
        last = await db.message.findFirst({ where: { contact_id: c.id }, orderBy: { timestamp: 'desc' } })
      } catch { continue }
      if (!last) continue
      const lastAt = new Date(last.timestamp).getTime()
      if (lastAt > settleCutoff.getTime()) continue // ainda conversando
      if (lastAt < oldCutoff.getTime()) continue     // lead antigo, ignora

      const who = c.name || c.phone || 'Contato'
      const label = `${who}${c.phone ? ` (${c.phone})` : ''}`
      try {
        await sendWhatsAppTemplate(
          { phone_number_id: t.phone_number_id, whatsapp_token: t.whatsapp_token },
          to,
          t.summary_forward_template,
          [label, String(c.ai_summary).slice(0, 900)] // limite seguro do corpo do template
        )
        await db.contact.update({ where: { id: c.id }, data: { summary_forwarded_at: new Date() } })
        sent++
      } catch (e) {
        console.error('[summary-forward] envio falhou', t.slug, (e as any)?.message || e)
      }
    }
  }
  return sent
}
