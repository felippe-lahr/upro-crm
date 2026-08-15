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

  return Response.json({
    broadcasts,
    meta: {
      company: tenant?.name || '',
      consent_template: templateName,
      consent_status,
      available_tags: (tenant?.lead_tags as string[]) || [],
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

  // Seleção de destinatários: por etiqueta e/ou lista manual. Nunca inclui opt-out.
  const where: any = { opted_out: false }
  if (Array.isArray(contactIds) && contactIds.length) {
    where.id = { in: contactIds.map((x: any) => String(x)) }
  } else if (filter_tag) {
    where.tags = { has: String(filter_tag) }
  }
  const contacts = await db.contact.findMany({ where, take: MAX_RECIPIENTS + 1 })

  if (contacts.length === 0) {
    return Response.json({ error: 'Nenhum contato elegível para o disparo.' }, { status: 400 })
  }
  if (contacts.length > MAX_RECIPIENTS) {
    return Response.json({ error: `Este disparo é para no máximo ${MAX_RECIPIENTS} contatos. Refine a seleção (por etiqueta ou escolhendo manualmente).` }, { status: 400 })
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
      sent++
    } catch {
      failed++
    }
    await new Promise((r) => setTimeout(r, 400)) // pequeno intervalo entre envios
  }

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

  return Response.json(broadcast)
}
