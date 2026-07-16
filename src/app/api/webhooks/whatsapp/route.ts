export const dynamic = 'force-dynamic'

import { globalPrisma, getTenantPrisma } from '@/lib/prisma-tenant'
import { processBotResponse, processMenuBotResponse, extractContactInfo, sendWhatsAppMessage, sendTypingIndicator, type MenuOption } from '@/lib/bot'
import { transcribeWhatsAppAudio } from '@/lib/transcribe'
import { sendAppointmentEmail } from '@/lib/email'
import { sendPushToTenant } from '@/lib/push'
import crypto from 'crypto'

function verifySignature(body: string, signature: string | null): boolean {
  const secret = process.env.META_APP_SECRET
  if (!secret) {
    console.error('[whatsapp webhook] META_APP_SECRET não configurado — recebimento bloqueado')
    return false
  }
  if (!signature) {
    console.warn('[whatsapp webhook] sem header x-hub-signature-256')
    return false
  }
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  // timingSafeEqual lança se os tamanhos diferem — compara o tamanho antes.
  if (a.length !== b.length) {
    console.warn(`[whatsapp webhook] assinatura inválida (tamanho) recv=${a.length} exp=${b.length} — verifique se META_APP_SECRET do Railway = App Secret atual da Meta`)
    return false
  }
  const ok = crypto.timingSafeEqual(a, b)
  if (!ok) console.warn('[whatsapp webhook] assinatura não confere — provável divergência de META_APP_SECRET')
  return ok
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 })
  }

  return new Response('Forbidden', { status: 403 })
}

export async function POST(req: Request) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-hub-signature-256')

  if (!verifySignature(rawBody, signature)) {
    return new Response('Invalid signature', { status: 401 })
  }

  const body = JSON.parse(rawBody)
  const entry = body.entry?.[0]
  const changes = entry?.changes?.[0]
  const phoneNumberId = changes?.value?.metadata?.phone_number_id

  if (!phoneNumberId) {
    return Response.json({ ok: true })
  }

  const tenant = await globalPrisma.tenant.findFirst({
    where: { phone_number_id: phoneNumberId }
  })

  if (!tenant) {
    console.warn(`Unknown phone_number_id: ${phoneNumberId}`)
    return Response.json({ ok: true })
  }

  const messages = changes?.value?.messages || []
  const contacts = changes?.value?.contacts || []

  for (const message of messages) {
    const contactInfo = contacts[0]
    await processIncomingMessage(tenant as any, message, contactInfo)
  }

  return Response.json({ ok: true })
}

async function processIncomingMessage(
  tenant: {
    id: string
    plan: string
    schema_name: string
    phone_number_id: string
    whatsapp_token: string
    bot_enabled: boolean
    bot_prompt: string | null
    menu_bot_enabled: boolean
    menu_bot_greeting: string | null
    menu_bot_options: any
  },
  message: any,
  contactInfo: any
) {
  const tenantPrisma = getTenantPrisma(tenant.schema_name)

  // Identificadores do WhatsApp:
  // - senderId (message.from): id endereçável para responder (telefone ou BSUID)
  // - bsuid (contacts[].user_id): identificador estável por empresa (usernames)
  // - waId (contacts[].wa_id): telefone, quando disponível
  const senderId: string = message.from
  const bsuid: string | null = contactInfo?.user_id || null
  const waId: string | null = contactInfo?.wa_id || null
  const profileName: string | null = contactInfo?.profile?.name || null

  // Resolve o contato por BSUID > id endereçável > telefone (evita duplicar quando o telefone é ocultado).
  let dbContact =
    (bsuid ? await tenantPrisma.contact.findFirst({ where: { bsuid } }) : null) ||
    (await tenantPrisma.contact.findFirst({ where: { whatsapp_id: senderId } })) ||
    (waId ? await tenantPrisma.contact.findFirst({ where: { phone: waId } }) : null)

  if (dbContact) {
    dbContact = await tenantPrisma.contact.update({
      where: { id: dbContact.id },
      data: {
        ...(profileName ? { name: profileName } : {}),
        ...(bsuid && !dbContact.bsuid ? { bsuid } : {}),
        ...(waId && (!dbContact.phone || dbContact.phone === dbContact.whatsapp_id) ? { phone: waId } : {})
      }
    })
  } else {
    dbContact = await tenantPrisma.contact.create({
      data: {
        whatsapp_id: senderId,
        bsuid: bsuid || undefined,
        phone: waId || senderId,
        name: profileName
      }
    })
  }

  // Resolve o texto da mensagem (transcreve áudio quando possível)
  let resolvedText = ''
  if (message.type === 'text') {
    resolvedText = message.text?.body || ''
  } else if (message.type === 'audio' && message.audio?.id) {
    const transcription = await transcribeWhatsAppAudio(tenant, message.audio.id)
    if (transcription) resolvedText = transcription
  }

  const storedContent =
    message.type === 'audio' && resolvedText
      ? `🎤 ${resolvedText}`
      : extractMessageContent(message)

  await tenantPrisma.message.create({
    data: {
      whatsapp_id: message.id,
      contact_id: dbContact.id,
      direction: 'inbound',
      type: message.type,
      content: storedContent,
      timestamp: new Date(parseInt(message.timestamp) * 1000)
    }
  })

  // Notificação push para os atendentes do tenant (best-effort).
  sendPushToTenant(tenant.id, {
    title: dbContact.name || dbContact.phone || 'Nova mensagem',
    body: (resolvedText || storedContent || 'Nova mensagem').slice(0, 140),
    url: `/conversations/${dbContact.id}`,
    tag: dbContact.id
  }).catch(() => {})

  // Resposta a um lembrete de agendamento (botões Confirmar/Cancelar/Remarcar)
  const buttonId: string | undefined = message?.interactive?.button_reply?.id
  if (buttonId && buttonId.startsWith('appt_')) {
    await handleAppointmentButton(tenant, tenantPrisma, buttonId, message.from)
    return
  }

  console.log('[whatsapp webhook] routing', JSON.stringify({
    plan: tenant.plan,
    bot_enabled: tenant.bot_enabled,
    menu_bot_enabled: tenant.menu_bot_enabled,
    hasText: !!resolvedText,
    type: message.type
  }))

  // Bot com IA: planos Pro e Promaster
  if (['pro', 'promaster'].includes(tenant.plan) && tenant.bot_enabled) {
    if (resolvedText) {
      // Mostra "digitando…" enquanto a IA elabora a resposta (e marca como lida).
      await sendTypingIndicator(tenant, message.id).catch(() => {})
      try {
        await processBotResponse(tenant, resolvedText, dbContact, message.from)
      } catch (err: any) {
        console.error('[whatsapp webhook] processBotResponse failed', err?.message || String(err), err?.stack)
      }
      try {
        await extractContactInfo(tenant, dbContact)
      } catch (err: any) {
        console.error('[whatsapp webhook] extractContactInfo failed', err?.message || String(err))
      }
    }
    return
  }

  // Menu bot: disponível nos demais planos
  if (tenant.menu_bot_enabled) {
    await sendTypingIndicator(tenant, message.id).catch(() => {})
    await processMenuBotResponse(
      {
        schema_name: tenant.schema_name,
        phone_number_id: tenant.phone_number_id,
        whatsapp_token: tenant.whatsapp_token,
        menu_bot_greeting: tenant.menu_bot_greeting,
        menu_bot_options: (tenant.menu_bot_options as MenuOption[]) || []
      },
      message,
      dbContact
    )
  }
}

async function handleAppointmentButton(
  tenant: { phone_number_id: string; whatsapp_token: string; name?: string; email?: string | null },
  tenantPrisma: any,
  buttonId: string,
  to: string
) {
  // appt_<action>_<uuid>
  const m = buttonId.match(/^appt_(confirm|cancel|reschedule)_(.+)$/)
  if (!m) return
  const [, action, id] = m

  const appt = await tenantPrisma.appointment.findUnique({ where: { id }, include: { service: true } }).catch(() => null)
  if (!appt) {
    await sendWhatsAppMessage(tenant, to, 'Não encontrei esse agendamento. Fale com a gente para ajudar. 🙏')
    return
  }

  let reply = ''
  if (action === 'confirm') {
    await tenantPrisma.appointment.update({ where: { id }, data: { status: 'confirmed' } })
    reply = 'Tudo certo! Seu horário está *confirmado*. ✅\n\nVocê vai receber um lembrete *um dia antes* e outro *no dia* do agendamento. Até lá! 🙌'
    // Envia confirmação por e-mail, se tivermos o endereço.
    if (appt.customer_email) {
      const whenLabel = new Date(appt.start_at).toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
      })
      sendAppointmentEmail({
        to: appt.customer_email,
        businessName: tenant.name || 'Agendamento',
        replyTo: tenant.email,
        serviceName: appt.service?.name || appt.title || 'Atendimento',
        whenLabel,
        kind: 'confirmed',
        attendeeName: appt.customer_name,
        bookedBy: appt.booked_by
      }).catch((e) => console.error('[appointment email] confirm failed', e))
    }
  } else if (action === 'cancel') {
    await tenantPrisma.appointment.update({ where: { id }, data: { status: 'cancelled' } })
    reply = 'Seu agendamento foi *cancelado*. Se quiser remarcar, é só nos chamar. 🙂'
    if (appt.customer_email) {
      const whenLabel = new Date(appt.start_at).toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
      })
      sendAppointmentEmail({
        to: appt.customer_email,
        businessName: tenant.name || 'Agendamento',
        replyTo: tenant.email,
        serviceName: appt.service?.name || appt.title || 'Atendimento',
        whenLabel,
        kind: 'cancelled',
        attendeeName: appt.customer_name,
        bookedBy: appt.booked_by
      }).catch((e) => console.error('[appointment email] cancel failed', e))
    }
  } else {
    // remarcar: marca a conversa como pendente para um humano/bot reabrir
    const conv = await tenantPrisma.conversation.findFirst({ where: { contact_id: appt.contact_id }, orderBy: { created_at: 'desc' } }).catch(() => null)
    if (appt.contact_id) {
      if (conv) await tenantPrisma.conversation.update({ where: { id: conv.id }, data: { status: 'pending' } })
      else await tenantPrisma.conversation.create({ data: { contact_id: appt.contact_id, status: 'pending' } })
    }
    reply = 'Sem problema! Me diga qual o melhor dia e horário para remarcar. 🔄'
  }

  await sendWhatsAppMessage(tenant, to, reply)
  if (appt.contact_id) {
    await tenantPrisma.message.create({
      data: { contact_id: appt.contact_id, direction: 'outbound', type: 'text', content: reply, sent_by_bot: true, timestamp: new Date() }
    })
  }
}

function extractMessageContent(message: any): string {
  switch (message.type) {
    case 'text':
      return message.text?.body || ''
    case 'image':
      return message.image?.caption || '[Imagem]'
    case 'audio':
      return '[Áudio]'
    case 'video':
      return message.video?.caption || '[Vídeo]'
    case 'document':
      return message.document?.filename || '[Documento]'
    case 'location':
      return `[Localização: ${message.location?.latitude}, ${message.location?.longitude}]`
    case 'interactive':
      return (
        message.interactive?.button_reply?.title ||
        message.interactive?.list_reply?.title ||
        '[Resposta do menu]'
      )
    default:
      return `[${message.type}]`
  }
}
