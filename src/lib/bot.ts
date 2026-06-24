import Anthropic from '@anthropic-ai/sdk'
import { getTenantPrisma } from './prisma-tenant'
import { decrypt } from './crypto'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function processBotResponse(
  tenant: {
    id: string
    schema_name: string
    phone_number_id: string
    whatsapp_token: string
    bot_prompt: string | null
  },
  message: { type: string; text?: { body: string }; from: string },
  contact: { id: string }
) {
  if (message.type !== 'text' || !message.text) return

  const tenantPrisma = getTenantPrisma(tenant.schema_name)

  const history = await tenantPrisma.message.findMany({
    where: { contact_id: contact.id },
    orderBy: { timestamp: 'desc' },
    take: 10
  })

  type MessageParam = { role: 'user' | 'assistant'; content: string }
  const messages: MessageParam[] = (history as any[])
    .reverse()
    .filter((m: any) => m.content)
    .map((msg: any) => ({
      role: msg.direction === 'inbound' ? ('user' as const) : ('assistant' as const),
      content: msg.content as string
    }))

  messages.push({ role: 'user', content: message.text.body })

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system:
      tenant.bot_prompt ||
      'Você é um assistente de atendimento ao cliente. Seja sempre educado, claro e prestativo.',
    messages
  })

  const botReply =
    response.content[0].type === 'text' ? response.content[0].text : ''

  if (!botReply) return

  await sendWhatsAppMessage(tenant, message.from, botReply)

  await tenantPrisma.message.create({
    data: {
      contact_id: contact.id,
      direction: 'outbound',
      type: 'text',
      content: botReply,
      sent_by_bot: true,
      timestamp: new Date()
    }
  })
}

export async function sendWhatsAppMessage(
  tenant: { phone_number_id: string; whatsapp_token: string },
  to: string,
  text: string
) {
  const token = decrypt(tenant.whatsapp_token)

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${tenant.phone_number_id}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { body: text }
      })
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`WhatsApp send failed: ${err}`)
  }
}
