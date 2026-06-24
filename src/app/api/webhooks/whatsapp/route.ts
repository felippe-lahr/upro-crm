export const dynamic = 'force-dynamic'

import { globalPrisma, getTenantPrisma } from '@/lib/prisma-tenant'
import { processBotResponse } from '@/lib/bot'
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
    schema_name: string
    phone_number_id: string
    whatsapp_token: string
    bot_enabled: boolean
    bot_prompt: string | null
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

  await tenantPrisma.message.create({
    data: {
      whatsapp_id: message.id,
      contact_id: dbContact.id,
      direction: 'inbound',
      type: message.type,
      content: extractMessageContent(message),
      timestamp: new Date(parseInt(message.timestamp) * 1000)
    }
  })

  if (tenant.bot_enabled) {
    await processBotResponse(tenant, message, dbContact)
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
    default:
      return `[${message.type}]`
  }
}
