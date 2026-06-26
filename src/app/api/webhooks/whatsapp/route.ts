export const dynamic = 'force-dynamic'

import { globalPrisma, getTenantPrisma } from '@/lib/prisma-tenant'
import { processBotResponse, processMenuBotResponse, extractContactInfo, type MenuOption } from '@/lib/bot'
import { transcribeWhatsAppAudio } from '@/lib/transcribe'
import crypto from 'crypto'

function verifySignature(body: string, signature: string | null): boolean {
  if (!signature) return false
  const expected = `sha256=${crypto
    .createHmac('sha256', process.env.META_APP_SECRET!)
    .update(body)
    .digest('hex')}`
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
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

  const dbContact = await tenantPrisma.contact.upsert({
    where: { whatsapp_id: message.from },
    update: {
      name: contactInfo?.profile?.name || undefined
    },
    create: {
      whatsapp_id: message.from,
      phone: message.from,
      name: contactInfo?.profile?.name || null
    }
  })

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

  // Bot com IA: exclusivo do plano Pro
  if (tenant.plan === 'pro' && tenant.bot_enabled) {
    if (resolvedText) {
      await processBotResponse(tenant, resolvedText, dbContact, message.from)
      await extractContactInfo(tenant, dbContact)
    }
    return
  }

  // Menu bot: disponível nos demais planos
  if (tenant.menu_bot_enabled) {
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
