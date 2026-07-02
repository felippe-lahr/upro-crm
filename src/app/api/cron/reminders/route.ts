export const dynamic = 'force-dynamic'

import { globalPrisma, getTenantPrisma } from '@/lib/prisma-tenant'
import { sendWhatsAppButtons } from '@/lib/bot'
import { sendAppointmentEmail } from '@/lib/email'

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
  const todayBR = now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

  const tenants = await globalPrisma.tenant.findMany({
    where: { status: 'active', whatsapp_connected: true, phone_number_id: { not: null }, whatsapp_token: { not: null } }
  })

  let sent = 0
  for (const tenant of tenants) {
    if (!tenant.schema_name) continue
    let db: any
    try { db = getTenantPrisma(tenant.schema_name) } catch { continue }

    // Expira pré-reservas cujo prazo de pagamento passou (libera o horário).
    try {
      await db.appointment.updateMany({
        where: { status: 'pending_payment', hold_expires_at: { lt: now } },
        data: { status: 'cancelled', payment_status: 'expired' }
      })
    } catch { /* schema pode não ter as colunas ainda */ }

    let appts: any[] = []
    try {
      appts = await db.appointment.findMany({
        where: {
          status: { in: ['scheduled', 'confirmed'] },
          start_at: { gte: now, lte: limit },
          OR: [{ reminder_sent: false }, { day_reminder_sent: false }]
        },
        include: { service: true, contact: { select: { name: true, phone: true } } }
      })
    } catch { continue }

    for (const a of appts) {
      const to = (a.customer_phone || a.contact?.phone || '').replace(/\D/g, '')
      if (!to) { continue }

      const startDateBR = new Date(a.start_at).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
      const isSameDay = startDateBR === todayBR
      // No dia -> lembrete "no dia"; caso contrário (véspera, dentro de 24h) -> lembrete "1 dia antes".
      const kind: 'day' | 'before' = isSameDay ? 'day' : 'before'
      if (kind === 'day' && a.day_reminder_sent) continue
      if (kind === 'before' && a.reminder_sent) continue

      const when = new Date(a.start_at).toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
      })
      const who = a.customer_name || a.contact?.name || ''
      const what = a.service?.name || a.title || 'seu atendimento'
      const intro = kind === 'day'
        ? `Olá${who ? ` ${who.split(' ')[0]}` : ''}! 👋 Seu agendamento é *hoje*:`
        : `Olá${who ? ` ${who.split(' ')[0]}` : ''}! 👋 Lembrete do seu agendamento:`
      const body = `${intro}\n\n📅 *${what}*\n🕒 ${when}\n\nPodemos confirmar?`

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
        await db.appointment.update({
          where: { id: a.id },
          data: kind === 'day' ? { day_reminder_sent: true } : { reminder_sent: true }
        })
        // Lembrete também por e-mail, se tivermos o endereço.
        if (a.customer_email) {
          sendAppointmentEmail({
            to: a.customer_email,
            businessName: tenant.name || 'Agendamento',
            replyTo: tenant.email,
            serviceName: what,
            whenLabel: when,
            kind: 'reminder',
            attendeeName: a.customer_name,
            bookedBy: a.booked_by
          }).catch((err) => console.error('[cron reminders] email failed', tenant.slug, err))
        }
        sent++
      } catch (err) {
        console.error('[cron reminders] send failed', tenant.slug, err)
      }
    }
  }

  return Response.json({ ok: true, tenants: tenants.length, reminders_sent: sent })
}
