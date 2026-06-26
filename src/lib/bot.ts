import { getTenantPrisma } from './prisma-tenant'
import { decrypt } from './crypto'

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

  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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

export interface MenuOption {
  id: string
  label: string
  response: string
}

/**
 * Menu bot (planos sem IA): se a mensagem for o clique de um botão, responde a
 * opção correspondente; caso contrário, envia a saudação + os botões do menu.
 */
export async function processMenuBotResponse(
  tenant: {
    schema_name: string
    phone_number_id: string
    whatsapp_token: string
    menu_bot_greeting: string | null
    menu_bot_options: MenuOption[]
  },
  message: any,
  contact: { id: string }
) {
  const options = tenant.menu_bot_options || []
  if (options.length === 0) return

  const tenantPrisma = getTenantPrisma(tenant.schema_name)

  // Clique em um botão do menu
  const buttonId = message?.interactive?.button_reply?.id
  if (buttonId) {
    const chosen = options.find((o) => o.id === buttonId)
    if (chosen) {
      await sendWhatsAppMessage(tenant, message.from, chosen.response)
      await saveOutbound(tenantPrisma, contact.id, chosen.response)
      return
    }
  }

  // Qualquer outra mensagem → mostra o menu
  const greeting = tenant.menu_bot_greeting || 'Olá! Como podemos ajudar?'
  await sendWhatsAppButtons(tenant, message.from, greeting, options.slice(0, 3))
  await saveOutbound(tenantPrisma, contact.id, greeting)
}

async function saveOutbound(tenantPrisma: any, contactId: string, content: string) {
  await tenantPrisma.message.create({
    data: {
      contact_id: contactId,
      direction: 'outbound',
      type: 'text',
      content,
      sent_by_bot: true,
      timestamp: new Date()
    }
  })
}

export async function sendWhatsAppButtons(
  tenant: { phone_number_id: string; whatsapp_token: string },
  to: string,
  bodyText: string,
  options: MenuOption[]
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
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: bodyText },
          action: {
            buttons: options.map((o) => ({
              type: 'reply',
              reply: { id: o.id, title: o.label.slice(0, 20) }
            }))
          }
        }
      })
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`WhatsApp buttons send failed: ${err}`)
  }
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
