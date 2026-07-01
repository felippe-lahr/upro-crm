import { getTenantPrisma } from './prisma-tenant'
import { decrypt } from './crypto'
import { chatComplete } from './ai'
import { getAvailableSlots, brDateTime, weekdayName } from './scheduling'

/**
 * Lê o histórico da conversa e extrai dados estruturados do lead para o CRM:
 * nome, e-mail e um resumo curto. Avança o funil de "novo_lead" para
 * "em_atendimento" quando já há informação suficiente. Best-effort: falhas
 * são silenciosas para nunca quebrar o atendimento.
 */
export async function extractContactInfo(
  tenant: { schema_name: string },
  contact: { id: string }
) {
  try {
    const tenantPrisma = getTenantPrisma(tenant.schema_name)

    const current = await tenantPrisma.contact.findUnique({ where: { id: contact.id } })
    if (!current) return

    const history = await tenantPrisma.message.findMany({
      where: { contact_id: contact.id },
      orderBy: { timestamp: 'desc' },
      take: 30
    })

    const transcript = (history as any[])
      .reverse()
      .filter((m: any) => m.content)
      .map((m: any) => `${m.direction === 'inbound' ? 'Cliente' : 'Atendente'}: ${m.content}`)
      .join('\n')

    if (!transcript.trim()) return

    const raw = await chatComplete({
      maxTokens: 400,
      system:
        'Você extrai dados de um lead a partir de uma conversa de atendimento. ' +
        'Responda APENAS com um JSON válido, sem texto extra, no formato: ' +
        '{"name": string|null, "email": string|null, "summary": string, "qualified": boolean}. ' +
        '- name: nome da pessoa/responsável, se mencionado. ' +
        '- email: e-mail, se mencionado (valide formato básico). ' +
        '- summary: resumo de 1 a 2 frases do que o cliente quer/precisa, em português. ' +
        '- qualified: true se já dá para entender claramente o interesse/necessidade do cliente. ' +
        'Use null quando a informação não aparecer. NUNCA invente dados.',
      messages: [{ role: 'user', content: transcript }]
    })

    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return

    let data: any
    try {
      data = JSON.parse(jsonMatch[0])
    } catch {
      return
    }

    const update: any = {}
    if (data.name && !current.name) update.name = String(data.name).slice(0, 120)
    if (data.email && /\S+@\S+\.\S+/.test(data.email)) update.email = String(data.email).slice(0, 160)
    if (data.summary) update.ai_summary = String(data.summary).slice(0, 500)
    if (data.qualified && current.stage === 'novo_lead') update.stage = 'em_atendimento'

    if (Object.keys(update).length > 0) {
      await tenantPrisma.contact.update({ where: { id: contact.id }, data: update })
    }
  } catch (err) {
    console.error('[extractContactInfo] failed', err)
  }
}

// Janela (minutos) em que o bot fica em silêncio após um humano responder
const HUMAN_TAKEOVER_MINUTES = 30
// Quantas mensagens de histórico o bot considera como contexto
const HISTORY_LIMIT = 25
// Marcador que o bot emite quando precisa encaminhar a um humano
const ESCALATE_MARKER = '[ESCALAR]'
// Aviso enviado quando o lead volta a falar numa conversa já escalada (pendente)
const HANDOFF_NOTICE =
  'Obrigado pela mensagem! Já encaminhei seu contato para um de nossos atendentes, que vai te responder por aqui em breve. 🙏'

const GUARDRAIL = `\n\n---\nREGRAS IMPORTANTES (siga sempre):\n` +
  `- Responda APENAS com base nas informações fornecidas acima. NUNCA invente valores, datas, horários, regras ou disponibilidade.\n` +
  `- Se você não souber a resposta, ou se o cliente pedir para falar com um humano/atendente, ou se for um assunto sensível (reclamação, cancelamento, negociação), responda de forma breve e cordial avisando que vai encaminhar para um atendente, e inclua o marcador ${ESCALATE_MARKER} ao final da mensagem.\n` +
  `- Seja claro, objetivo e responda em português do Brasil.\n` +
  `- Se ainda não souber o nome e o e-mail do cliente, peça-os de forma natural ao longo da conversa (não tudo de uma vez, sem parecer um formulário), para que possamos dar continuidade ao atendimento.`

// ─── Tool use (agendamento via Claude) ──────────────────────────────────────

const SCHEDULING_TOOLS = [
  {
    name: 'verificar_horarios',
    description: 'Lista os horários livres em uma data específica para um serviço.',
    input_schema: {
      type: 'object',
      properties: {
        data: { type: 'string', description: 'Data no formato AAAA-MM-DD' },
        servico: { type: 'string', description: 'Nome do serviço (opcional)' }
      },
      required: ['data']
    }
  },
  {
    name: 'agendar',
    description: 'Cria um agendamento confirmado em uma data e horário livres.',
    input_schema: {
      type: 'object',
      properties: {
        data: { type: 'string', description: 'Data AAAA-MM-DD' },
        hora: { type: 'string', description: 'Horário HH:MM' },
        servico: { type: 'string', description: 'Nome do serviço (opcional)' },
        nome: { type: 'string', description: 'Nome do cliente (opcional)' }
      },
      required: ['data', 'hora']
    }
  }
]

async function resolveService(tenantPrisma: any, name?: string): Promise<{ id: string | null; duration: number; label: string }> {
  if (name) {
    const all = await tenantPrisma.service.findMany({ where: { active: true } })
    const found = all.find((s: any) => s.name.toLowerCase().includes(String(name).toLowerCase()))
    if (found) return { id: found.id, duration: found.duration_min, label: found.name }
  }
  const first = await tenantPrisma.service.findFirst({ where: { active: true } })
  if (first) return { id: first.id, duration: first.duration_min, label: first.name }
  return { id: null, duration: 60, label: 'Atendimento' }
}

async function runSchedulingTool(name: string, input: any, ctx: { tenantPrisma: any; contactId: string; contactName: string | null }): Promise<string> {
  const { tenantPrisma } = ctx
  try {
    if (name === 'verificar_horarios') {
      const svc = await resolveService(tenantPrisma, input.servico)
      const slots = await getAvailableSlots(tenantPrisma, input.data, svc.duration)
      const dia = weekdayName(input.data)
      if (!slots.length) return JSON.stringify({ data: input.data, dia_semana: dia, horarios: [], aviso: `Não há horários de atendimento em ${dia} (${input.data}). Sugira outro dia.` })
      return JSON.stringify({ data: input.data, dia_semana: dia, servico: svc.label, horarios: slots })
    }
    if (name === 'agendar') {
      const svc = await resolveService(tenantPrisma, input.servico)
      const dia = weekdayName(input.data)
      const start = brDateTime(input.data, input.hora)
      const end = new Date(start.getTime() + svc.duration * 60000)
      if (start.getTime() < Date.now()) return JSON.stringify({ ok: false, erro: 'Esse horário já passou.' })
      // Valida contra a disponibilidade real (dias de atendimento + conflitos + horário)
      const slots = await getAvailableSlots(tenantPrisma, input.data, svc.duration)
      if (!slots.includes(input.hora)) {
        return JSON.stringify({
          ok: false,
          dia_semana: dia,
          erro: `O horário ${input.hora} de ${dia} (${input.data}) não está disponível. Ofereça apenas horários retornados por verificar_horarios.`,
          horarios_livres: slots
        })
      }
      await tenantPrisma.appointment.create({
        data: {
          contact_id: ctx.contactId,
          service_id: svc.id,
          customer_name: input.nome || ctx.contactName || null,
          title: svc.label,
          start_at: start,
          end_at: end,
          status: 'scheduled'
        }
      })
      return JSON.stringify({ ok: true, servico: svc.label, data: input.data, hora: input.hora })
    }
  } catch (err: any) {
    return JSON.stringify({ ok: false, erro: err?.message || 'Falha na operação' })
  }
  return JSON.stringify({ ok: false, erro: 'Ferramenta desconhecida' })
}

async function aiReplyWithScheduling(
  system: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  ctx: { tenantPrisma: any; contactId: string; contactName: string | null }
): Promise<string> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6'

  const convo: any[] = messages.map((m) => ({ role: m.role, content: m.content }))

  for (let i = 0; i < 5; i++) {
    const res: any = await anthropic.messages.create({
      model, max_tokens: 1024, system, tools: SCHEDULING_TOOLS as any, messages: convo
    })
    if (res.stop_reason === 'tool_use') {
      convo.push({ role: 'assistant', content: res.content })
      const toolResults: any[] = []
      for (const block of res.content) {
        if (block.type === 'tool_use') {
          const out = await runSchedulingTool(block.name, block.input, ctx)
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: out })
        }
      }
      convo.push({ role: 'user', content: toolResults })
      continue
    }
    return (res.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n').trim()
  }
  return ''
}

export async function processBotResponse(
  tenant: {
    id: string
    schema_name: string
    phone_number_id: string
    whatsapp_token: string
    bot_prompt: string | null
    handoff_pause?: boolean
    keep_responding_after_human?: boolean
  },
  userText: string,
  contact: { id: string },
  from: string
) {
  if (!userText?.trim()) return

  const tenantPrisma = getTenantPrisma(tenant.schema_name)

  // 1) Pausa por atendimento humano: se um humano respondeu recentemente, o bot silencia
  // (a não ser que o cliente opte por manter o bot respondendo)
  if (!tenant.keep_responding_after_human) {
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
  }

  // 1b) Pausa por handoff (opção do Pro): conversa já escalada e aguardando humano →
  // não responde com IA; manda o aviso uma única vez.
  if (tenant.handoff_pause) {
    const conv = await tenantPrisma.conversation.findFirst({
      where: { contact_id: contact.id },
      orderBy: { created_at: 'desc' }
    })
    if (conv?.status === 'pending') {
      const lastOutbound = await tenantPrisma.message.findFirst({
        where: { contact_id: contact.id, direction: 'outbound' },
        orderBy: { timestamp: 'desc' }
      })
      if (lastOutbound?.content !== HANDOFF_NOTICE) {
        await sendWhatsAppMessage(tenant, from, HANDOFF_NOTICE)
        await tenantPrisma.message.create({
          data: {
            contact_id: contact.id,
            direction: 'outbound',
            type: 'text',
            content: HANDOFF_NOTICE,
            sent_by_bot: true,
            timestamp: new Date()
          }
        })
      }
      return
    }
  }

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

  const basePrompt =
    tenant.bot_prompt ||
    'Você é um assistente de atendimento ao cliente. Seja sempre educado, claro e prestativo.'

  // Contato novo (ainda sem nome): pede nome e e-mail já na saudação
  const current = await tenantPrisma.contact.findUnique({
    where: { id: contact.id },
    select: { name: true, email: true }
  })
  const welcome =
    !current?.name
      ? `\n\nIMPORTANTE — PRIMEIRO CONTATO: ainda não sabemos quem é esta pessoa. Comece sua resposta com uma saudação calorosa e, de forma cordial e natural, pergunte o nome dela${current?.email ? '' : ' e o melhor e-mail para contato'}. Em seguida, responda à dúvida. Faça isso na mesma mensagem, sem parecer um formulário.`
      : ''

  // Agendamento: se o provedor é Claude e o tenant tem horários configurados,
  // habilita o bot a consultar disponibilidade e agendar sozinho (tool use).
  const useAnthropic =
    (process.env.AI_PROVIDER || '').toLowerCase() === 'anthropic' ||
    (process.env.ANTHROPIC_API_KEY || '').startsWith('sk-ant')
  let schedulingOn = false
  if (useAnthropic) {
    try { schedulingOn = (await tenantPrisma.availability.count()) > 0 } catch { schedulingOn = false }
  }

  let botReply: string
  if (schedulingOn) {
    const todayName = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long' })
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) // AAAA-MM-DD
    const hint = `\n\nAGENDAMENTO (regras rígidas):\n` +
      `- Hoje é ${todayName}, ${today} (fuso de São Paulo, UTC-3).\n` +
      `- NUNCA calcule o dia da semana de uma data você mesmo. Sempre use o campo "dia_semana" retornado pelas ferramentas e repita esse valor ao cliente.\n` +
      `- SEMPRE chame verificar_horarios antes de oferecer ou agendar qualquer horário. Ofereça apenas os horários que ela retornar.\n` +
      `- Só use agendar com data e hora que apareceram em verificar_horarios. Se a ferramenta retornar erro ou lista vazia, informe o cliente e sugira outro dia. Nunca invente disponibilidade.\n` +
      `- Antes de agendar, confirme com o cliente o serviço, a data e o horário.`
    botReply = await aiReplyWithScheduling(basePrompt + GUARDRAIL + welcome + hint, messages, {
      tenantPrisma, contactId: contact.id, contactName: current?.name || null
    })
  } else {
    botReply = await chatComplete({ maxTokens: 1024, system: basePrompt + GUARDRAIL + welcome, messages })
  }

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
