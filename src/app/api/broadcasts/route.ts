export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { globalPrisma, getTenantPrisma } from '@/lib/prisma-tenant'
import { sendWhatsAppTemplate } from '@/lib/bot'
import {
  CONSENT_TEMPLATE_NAME,
  createConsentTemplate,
  getSummaryTemplateStatus
} from '@/lib/whatsapp-templates'

const MAX_RECIPIENTS = 30

export async function GET() {
  const session = await auth()
  const user = session?.user as any
  const schemaName = user?.schemaName
  const tenantId = user?.tenantId
  if (!schemaName) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getTenantPrisma(schemaName)
  const [broadcasts, tenant] = await Promise.all([
    db.broadcast.findMany({ orderBy: { created_at: 'desc' }, take: 50 }),
    globalPrisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, waba_id: true, whatsapp_token: true, broadcast_consent_template: true, lead_tags: true }
    })
  ])

  // Status do template de consentimento (best-effort).
  let consent_status: string | null = null
  const templateName = tenant?.broadcast_consent_template || CONSENT_TEMPLATE_NAME
  if (tenant?.waba_id && tenant.whatsapp_token) {
    const st = await getSummaryTemplateStatus({ waba_id: tenant.waba_id, whatsapp_token: tenant.whatsapp_token }, templateName)
    consent_status = st.status
  }

  // Etiquetas disponíveis = taxonomia do tenant (lead_tags) UNIÃO com as etiquetas
  // realmente usadas nos contatos (inclui as criadas na importação em lote).
  let usedTags: string[] = []
  try {
    const rows: { tag: string }[] = await db.$queryRawUnsafe(
      `SELECT DISTINCT unnest(tags) AS tag FROM contacts WHERE tags IS NOT NULL`
    )
    usedTags = rows.map((r) => r.tag).filter(Boolean)
  } catch { /* sem contatos ainda */ }
  const available_tags = Array.from(
    new Set([...((tenant?.lead_tags as string[]) || []), ...usedTags])
  ).sort()

  return Response.json({
    broadcasts,
    meta: {
      company: tenant?.name || '',
      consent_template: templateName,
      consent_status,
      available_tags,
      max_recipients: MAX_RECIPIENTS
    }
  })
}

export async function POST(req: Request) {
  const session = await auth()
  const user = session?.user as any
  const schemaName = user?.schemaName
  const tenantId = user?.tenantId
  if (!schemaName) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { message, filter_tag, contactIds } = await req.json()
  const phrase = String(message || '').trim()
  if (!phrase) return Response.json({ error: 'Escreva a mensagem (o miolo do convite).' }, { status: 400 })
  if (phrase.length > 500) return Response.json({ error: 'Mensagem muito longa (máx. 500 caracteres).' }, { status: 400 })

  const tenant = await globalPrisma.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant?.whatsapp_connected || !tenant.phone_number_id || !tenant.whatsapp_token) {
    return Response.json({ error: 'WhatsApp não conectado.' }, { status: 400 })
  }

  const templateName = tenant.broadcast_consent_template || CONSENT_TEMPLATE_NAME

  // Garante o template: se ainda não existe, cria e avisa que está em aprovação.
  const st = await getSummaryTemplateStatus({ waba_id: tenant.waba_id, whatsapp_token: tenant.whatsapp_token }, templateName)
  if (st.status !== 'APPROVED') {
    if (st.status === 'NONE') {
      const created = await createConsentTemplate({ waba_id: tenant.waba_id, whatsapp_token: tenant.whatsapp_token }, templateName)
      if (created.ok && !tenant.broadcast_consent_template) {
        await globalPrisma.tenant.update({ where: { id: tenantId }, data: { broadcast_consent_template: created.name } }).catch(() => {})
      }
      return Response.json({
        error: 'Criamos o modelo de mensagem na Meta. Ele passa por uma análise (costuma levar minutos a algumas horas). Tente novamente quando estiver aprovado.'
      }, { status: 409 })
    }
    if (st.status === 'PENDING') {
      return Response.json({ error: 'O modelo de mensagem ainda está em análise pela Meta. Aguarde a aprovação.' }, { status: 409 })
    }
    if (st.status === 'REJECTED') {
      return Response.json({ error: 'O modelo de mensagem foi recusado pela Meta. Fale com o suporte.' }, { status: 409 })
    }
    return Response.json({ error: 'Modelo de mensagem indisponível. Fale com o suporte.' }, { status: 409 })
  }

  const db = getTenantPrisma(schemaName)

  // Seleção de destinatários: por etiqueta e/ou lista manual.
  // Nunca inclui opt-out (SAIR) e NUNCA reenvia para quem já recebeu o convite
  // (broadcast_sent_at) — assim cada clique manda para o PRÓXIMO lote de até 30.
  const where: any = { opted_out: false, broadcast_sent_at: null }
  if (Array.isArray(contactIds) && contactIds.length) {
    where.id = { in: contactIds.map((x: any) => String(x)) }
  } else if (filter_tag) {
    where.tags = { has: String(filter_tag) }
  }
  const contacts = await db.contact.findMany({
    where, orderBy: { created_at: 'asc' }, take: MAX_RECIPIENTS
  })

  if (contacts.length === 0) {
    return Response.json({ error: 'Nenhum contato novo elegível (todos já receberam o convite ou responderam SAIR).' }, { status: 400 })
  }

  const creds = { phone_number_id: tenant.phone_number_id, whatsapp_token: tenant.whatsapp_token }
  const company = tenant.name || 'nós'
  let sent = 0
  let failed = 0

  for (const c of contacts) {
    const to = (c.phone || '').replace(/\D/g, '')
    if (!to) { failed++; continue }
    try {
      const nome = (c.name || '').trim() || 'tudo bem?'
      await sendWhatsAppTemplate(creds, to, templateName, [nome, company, phrase])
      await db.message.create({
        data: {
          contact_id: c.id,
          direction: 'outbound',
          type: 'template',
          content: `Olá ${nome}, somos da ${company}. ${phrase}. Se tiver interesse digite SIM para continuar. Caso não queira mais receber esta mensagem digite SAIR.`,
          sent_by_bot: false,
          timestamp: new Date()
        }
      })
      // Marca como convidado para não reenviar nos próximos lotes.
      await db.contact.update({ where: { id: c.id }, data: { broadcast_sent_at: new Date() } }).catch(() => {})
      sent++
    } catch {
      failed++
    }
    await new Promise((r) => setTimeout(r, 400)) // pequeno intervalo entre envios
  }

  // Quantos ainda faltam nesta seleção (para o progresso "de 30 em 30").
  const remainingWhere: any = { opted_out: false, broadcast_sent_at: null }
  if (Array.isArray(contactIds) && contactIds.length) remainingWhere.id = { in: contactIds.map((x: any) => String(x)) }
  else if (filter_tag) remainingWhere.tags = { has: String(filter_tag) }
  const remaining = await db.contact.count({ where: remainingWhere }).catch(() => 0)

  const broadcast = await db.broadcast.create({
    data: {
      message: phrase,
      status: 'sent',
      total: contacts.length,
      sent_count: sent,
      failed_count: failed,
      filter_tag: filter_tag || null,
      sent_at: new Date()
    }
  })

  return Response.json({ ...broadcast, sent, failed, remaining })
}
