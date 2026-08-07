export const dynamic = 'force-dynamic'

import { globalPrisma, getTenantPrisma } from '@/lib/prisma-tenant'
import { probeBotReply, sendWhatsAppTemplate } from '@/lib/bot'
import { getSummaryTemplateStatus } from '@/lib/whatsapp-templates'

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

  // ?run=1 executa a geração de resposta com o prompt real (sem enviar ao WhatsApp).
  let probe: any = null
  if (url.searchParams.get('run')) {
    const text = url.searchParams.get('text') || 'Olá'
    probe = await probeBotReply(t, text)
  }

  // Diagnóstico do encaminhamento de resumo (4.1)
  const forward: any = {
    feature_summary_forward: !!t.feature_summary_forward,
    summary_forward_number: t.summary_forward_number || null,
    summary_forward_template: t.summary_forward_template || null
  }
  if (t.feature_summary_forward) {
    const st = await getSummaryTemplateStatus({ waba_id: t.waba_id, whatsapp_token: t.whatsapp_token }, t.summary_forward_template || undefined)
    forward.template_status = st.status
    if (st.rejected_reason) forward.template_rejected = st.rejected_reason
    // Estado do contato verificado (para entender o gatilho de qualificação)
    if (contact) {
      forward.contact_stage = contact.stage
      forward.contact_has_summary = !!contact.ai_summary
      forward.contact_summary_forwarded_at = (contact as any).summary_forwarded_at || null
    }
    // Por que não encaminhou?
    if (!t.summary_forward_number) forward.blocker = 'número de destino vazio'
    else if (!t.summary_forward_template) forward.blocker = 'template não configurado'
    else if (st.status !== 'APPROVED') forward.blocker = `template não aprovado (status: ${st.status})`
    else if (contact && contact.stage !== 'novo_lead' && !(contact as any).summary_forwarded_at) forward.blocker = 'contato já saiu de "novo_lead" sem disparar (qualificou antes de configurar, ou nunca passou por novo_lead→em_atendimento). Teste com um número NOVO.'
    else if (contact && (contact as any).summary_forwarded_at) forward.blocker = 'já encaminhado uma vez para este contato (trava anti-duplicação)'
    else forward.blocker = null

    // ?forwardtest=1 → dispara o template AGORA para o número configurado (teste real de envio)
    if (url.searchParams.get('forwardtest') && t.summary_forward_number && t.summary_forward_template && t.phone_number_id && t.whatsapp_token) {
      try {
        const resp: any = await sendWhatsAppTemplate(
          { phone_number_id: t.phone_number_id, whatsapp_token: t.whatsapp_token },
          String(t.summary_forward_number).replace(/\D/g, ''),
          t.summary_forward_template,
          ['Teste UProCRM (diagnóstico)', 'Este é um envio de teste do encaminhamento de resumo. Se você recebeu, está tudo funcionando.']
        )
        forward.forwardtest = {
          ok: true,
          sentTo: String(t.summary_forward_number).replace(/\D/g, ''),
          wa_id: resp?.contacts?.[0]?.wa_id || null,
          input: resp?.contacts?.[0]?.input || null,
          message_id: resp?.messages?.[0]?.id || null,
          raw: resp
        }
      } catch (e: any) {
        forward.forwardtest = { ok: false, error: e?.message || String(e) }
      }
    }
  }

  return Response.json({
    tenant: { name: t.name, email: t.email },
    config,
    botBranchWouldRun,
    probe,
    forward,
    contactChecked: contact ? { name: contact.name, phone: contact.phone, id: contact.id } : null,
    takeover,
    lastMessages,
    blockers,
    veredicto: blockers.length === 0
      ? 'Nenhuma trava encontrada — o bot deveria responder. Envie uma mensagem de teste e reveja em seguida.'
      : blockers
  })
}
