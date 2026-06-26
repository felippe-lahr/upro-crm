import { getTenantPrisma } from './prisma-tenant'
import { decrypt } from './crypto'

// Janela (minutos) em que o bot fica em silêncio após um humano responder
const HUMAN_TAKEOVER_MINUTES = 30
// Quantas mensagens de histórico o bot considera como contexto
const HISTORY_LIMIT = 25
// Marcador que o bot emite quando precisa encaminhar a um humano
const ESCALATE_MARKER = '[ESCALAR]'

const GUARDRAIL = `\n\n---\nREGRAS IMPORTANTES (siga sempre):\n` +
  `- Responda APENAS com base nas informações fornecidas acima. NUNCA invente valores, datas, horários, regras ou disponibilidade.\n` +
  `- Se você não souber a resposta, ou se o cliente pedir para falar com um humano/atendente, ou se for um assunto sensível (reclamação, cancelamento, negociação), responda de forma breve e cordial avisando que vai encaminhar para um atendente, e inclua o marcador ${ESCALATE_MARKER} ao final da mensagem.\n` +
  `- Seja claro, objetivo e responda em português do Brasil.`

export async function processBotResponse(
  tenant: {
    id: string
    schema_name: string
    phone_number_id: string
    whatsapp_token: string
    bot_prompt: string | null
  },
  userText: string,
  contact: { id: string },
  from: string
) {
  if (!userText?.trim()) return

  const tenantPrisma = getTenantPrisma(tenant.schema_name)

  // 1) Pausa por atendimento humano: se um humano respondeu recentemente, o bot silencia
  const cutoff = new Date(Date.now() - HUMAN_TAKEOVER_MINUTES * 60 * 1000)
  const recentHuman = await tenantPrisma.message.findFirst({
    where: {
      contact_id: contact.id,
      direction: 'outbound',
      sent_by_bot: false,
      timestamp: { gte: cutoff }
    }
  })
  if (recentHuman) return

  const history = await tenantPrisma.message.findMany({
    where: { contact_id: contact.id },
    orderBy: { timestamp: 'desc' },
    take: HISTORY_LIMIT
  })

  type MessageParam = { role: 'user' | 'assistant'; content: string }
  const messages: MessageParam[] = (history as any[])
    .reverse()
    .filter((m: any) => m.content)
    .map((msg: any) => ({
      role: msg.direction === 'inbound' ? ('user' as const) : ('assistant' as const),
      content: msg.content as string
    }))

  messages.push({ role: 'user', content: userText })

  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const basePrompt =
    tenant.bot_prompt ||
    'Você é um assistente de atendimento ao cliente. Seja sempre educado, claro e prestativo.'

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: basePrompt + GUARDRAIL,
    messages
  })

  let botReply =
    response.content[0].type === 'text' ? response.content[0].text : ''

  if (!botReply) return

  // 2) Handoff: se o bot sinalizou que precisa de humano, marca a conversa como pendente
  const needsHuman = botReply.includes(ESCALATE_MARKER)
  if (needsHuman) {
    botReply = botReply.replace(ESCALATE_MARKER, '').trim()
    await flagConversationForHuman(tenantPrisma, contact.id)
  }

  await sendWhatsAppMessage(tenant, from, botReply)

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

async function flagConversationForHuman(tenantPrisma: any, contactId: string) {
  const existing = await tenantPrisma.conversation.findFirst({
    where: { contact_id: contactId },
    orderBy: { created_at: 'desc' }
  })
  if (existing) {
    await tenantPrisma.conversation.update({
      where: { id: existing.id },
      data: { status: 'pending' }
    })
  } else {
    await tenantPrisma.conversation.create({
      data: { contact_id: contactId, status: 'pending' }
    })
  }
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
