export const dynamic = 'force-dynamic'

import { globalPrisma, getTenantPrisma } from '@/lib/prisma-tenant'

const HUMAN_TAKEOVER_MINUTES = 30

/**
 * Diagnóstico do fluxo do bot para um tenant. Mostra os flags que
 * controlam a resposta e, para o contato mais recente (ou ?phone=),
 * avalia cada trava para dizer POR QUE o bot não respondeu.
 * Uso: /api/admin/bot-diagnose?token=<NEXTAUTH_SECRET>&email=<tenant>&phone=<opcional>
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  const email = url.searchParams.get('email')
  const phone = url.searchParams.get('phone')
  if (!token || token !== process.env.NEXTAUTH_SECRET) {
    return Response.json({ error: 'Token inválido' }, { status: 401 })
  }
  if (!email) return Response.json({ error: 'Informe ?email=<tenant>' }, { status: 400 })

  const tenant = await globalPrisma.tenant.findUnique({ where: { email } })
  if (!tenant) return Response.json({ error: 'Tenant não encontrado' }, { status: 404 })

  const t: any = tenant
  const planOk = ['pro', 'promaster'].includes(t.plan)
  const config = {
    plan: t.plan,
    status: t.status,
    bot_enabled: t.bot_enabled,
    menu_bot_enabled: t.menu_bot_enabled,
    handoff_pause: t.handoff_pause,
    keep_responding_after_human: t.keep_responding_after_human,
    scheduling_enabled: t.scheduling_enabled,
    whatsapp_connected: t.whatsapp_connected,
    has_phone_number_id: !!t.phone_number_id,
    has_whatsapp_token: !!t.whatsapp_token,
    has_bot_prompt: !!t.bot_prompt
  }

  // Trava de nível do webhook: só entra no bot IA se plano pro/promaster + bot_enabled.
  const botBranchWouldRun = planOk && t.bot_enabled

  const blockers: string[] = []
  if (!planOk) blockers.push(`plano "${t.plan}" não é pro/promaster → bot IA não roda`)
  if (!t.bot_enabled) blockers.push('bot_enabled = false → bot IA desligado em Configurações')
  if (!t.phone_number_id || !t.whatsapp_token) blockers.push('WhatsApp não conectado (sem phone_number_id/token) → não consegue enviar')

  let contact: any = null
  const takeover: any = { active: false }
  let lastMessages: any[] = []
  try {
    const db = getTenantPrisma(t.schema_name)
    contact = phone
      ? await db.contact.findFirst({ where: { OR: [{ phone }, { whatsapp_id: phone }] }, orderBy: { updated_at: 'desc' } })
      : await db.contact.findFirst({ orderBy: { updated_at: 'desc' } })

    if (contact) {
      const msgs = await db.message.findMany({
        where: { contact_id: contact.id },
        orderBy: { timestamp: 'desc' },
        take: 6
      })
      lastMessages = msgs.map((m: any) => ({
        direction: m.direction,
        sent_by_bot: m.sent_by_bot,
        content: (m.content || '').slice(0, 60),
        at: m.timestamp
      }))

      // Pausa por atendimento humano: outbound humano (não-bot) nos últimos 30 min.
      const cutoff = new Date(Date.now() - HUMAN_TAKEOVER_MINUTES * 60 * 1000)
      const recentHuman = await db.message.findFirst({
        where: { contact_id: contact.id, direction: 'outbound', sent_by_bot: false, timestamp: { gte: cutoff } },
        orderBy: { timestamp: 'desc' }
      })
      if (recentHuman && !t.keep_responding_after_human) {
        takeover.active = true
        takeover.since = (recentHuman as any).timestamp
        takeover.releases_at = new Date(new Date((recentHuman as any).timestamp).getTime() + HUMAN_TAKEOVER_MINUTES * 60 * 1000)
        blockers.push(`PAUSA por atendimento humano ativa: um humano respondeu em ${takeover.since} → bot cala até ${takeover.releases_at} (ligue "manter bot respondendo" para ignorar)`)
      }
    }
  } catch (e: any) {
    blockers.push(`erro ao ler schema do tenant: ${e?.message || e}`)
  }

  return Response.json({
    tenant: { name: t.name, email: t.email },
    config,
    botBranchWouldRun,
    contactChecked: contact ? { name: contact.name, phone: contact.phone, id: contact.id } : null,
    takeover,
    lastMessages,
    blockers,
    veredicto: blockers.length === 0
      ? 'Nenhuma trava encontrada — o bot deveria responder. Envie uma mensagem de teste e reveja em seguida.'
      : blockers
  })
}
