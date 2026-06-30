export const dynamic = 'force-dynamic'

import { globalPrisma, getTenantPrisma } from '@/lib/prisma-tenant'
import { sendWhatsAppButtons } from '@/lib/bot'

/**
 * Cron de lembretes. Deve ser chamado periodicamente (ex: a cada 15 min) com
 * ?token=<NEXTAUTH_SECRET>. Para cada tenant com WhatsApp conectado, envia um
 * lembrete com botões (Confirmar / Cancelar / Remarcar) para os agendamentos
 * que começam nas próximas 24h e ainda não foram lembrados.
 */
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET || process.env.NEXTAUTH_SECRET
  const token = new URL(req.url).searchParams.get('token')
  if (!token || token !== expected) {
    return Response.json({ error: 'Token inválido' }, { status: 401 })
  }

  const now = new Date()
  const limit = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  const tenants = await globalPrisma.tenant.findMany({
    where: { status: 'active', whatsapp_connected: true, phone_number_id: { not: null }, whatsapp_token: { not: null } }
  })

  let sent = 0
  for (const tenant of tenants) {
    if (!tenant.schema_name) continue
    let db: any
    try { db = getTenantPrisma(tenant.schema_name) } catch { continue }

    let appts: any[] = []
    try {
      appts = await db.appointment.findMany({
        where: { status: { in: ['scheduled', 'confirmed'] }, reminder_sent: false, start_at: { gte: now, lte: limit } },
        include: { service: true, contact: { select: { name: true, phone: true } } }
      })
    } catch { continue }

    for (const a of appts) {
      const to = (a.customer_phone || a.contact?.phone || '').replace(/\D/g, '')
      if (!to) { continue }

      const when = new Date(a.start_at).toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
      })
      const who = a.customer_name || a.contact?.name || ''
      const what = a.service?.name || a.title || 'seu atendimento'
      const body = `Olá${who ? ` ${who.split(' ')[0]}` : ''}! 👋 Lembrete do seu agendamento:\n\n📅 *${what}*\n🕒 ${when}\n\nPodemos confirmar?`

      try {
        await sendWhatsAppButtons(
          { phone_number_id: tenant.phone_number_id!, whatsapp_token: tenant.whatsapp_token! },
          to,
          body,
          [
            { id: `appt_confirm_${a.id}`, label: '✅ Confirmar', response: '' },
            { id: `appt_cancel_${a.id}`, label: '❌ Cancelar', response: '' },
            { id: `appt_reschedule_${a.id}`, label: '🔄 Remarcar', response: '' }
          ]
        )
        await db.appointment.update({ where: { id: a.id }, data: { reminder_sent: true } })
        sent++
      } catch (err) {
        console.error('[cron reminders] send failed', tenant.slug, err)
      }
    }
  }

  return Response.json({ ok: true, tenants: tenants.length, reminders_sent: sent })
}
