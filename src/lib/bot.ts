import { getTenantPrisma } from './prisma-tenant'
import { decrypt } from './crypto'
import { chatComplete } from './ai'
import { getAvailableSlots, brDateTime, weekdayName } from './scheduling'
import { sendAppointmentEmail } from './email'
import { searchProducts, getProductById } from './products'

/**
 * Lê o histórico da conversa e extrai dados estruturados do lead para o CRM:
 * nome, e-mail e um resumo curto. Avança o funil de "novo_lead" para
 * "em_atendimento" quando já há informação suficiente. Best-effort: falhas
 * são silenciosas para nunca quebrar o atendimento.
 */
export async function extractContactInfo(
  tenant: {
    schema_name: string; bot_prompt?: string | null; summary_instructions?: string | null
    feature_summary_forward?: boolean; summary_forward_number?: string | null; summary_forward_template?: string | null
    phone_number_id?: string; whatsapp_token?: string; lead_tags?: string[]
  },
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

    // Resumo configurável (4.0): se o negócio definiu summary_instructions, o campo
    // "summary" é montado seguindo essas orientações, usando o bot_prompt como
    // contexto do domínio. Sem instruções → mantém o resumo padrão de 1-2 frases.
    const summaryGuide = tenant.summary_instructions?.trim()
      ? `- summary: monte SEGUINDO estritamente estas orientações do negócio (o que incluir e o formato):\n"""${tenant.summary_instructions.trim().slice(0, 1200)}"""\n` +
        `  Telefone do contato (use se as orientações pedirem telefone): ${current.phone || 'desconhecido'}. NUNCA invente dados que não estejam na conversa. `
      : '- summary: resumo de 1 a 2 frases do que o cliente quer/precisa, em português. '
    const businessContext = tenant.bot_prompt?.trim()
      ? `\n\nContexto do negócio (apenas para você entender o domínio; não copie literalmente):\n"""${tenant.bot_prompt.trim().slice(0, 2000)}"""`
      : ''

    // Auto-etiquetagem: a IA escolhe tags EXCLUSIVAMENTE da taxonomia do tenant.
    const taxonomy = (tenant.lead_tags || []).map((s) => String(s).trim()).filter(Boolean).slice(0, 40)
    const tagsField = taxonomy.length ? ', "tags": string[]' : ''
    const tagsGuide = taxonomy.length
      ? `- tags: escolha 0 ou mais etiquetas que descrevem este lead, EXCLUSIVAMENTE desta lista (copie exatamente, sem inventar nem criar novas): [${taxonomy.map((t) => `"${t}"`).join(', ')}]. Se nenhuma se aplica, use []. `
      : ''

    const raw = await chatComplete({
      maxTokens: 500,
      system:
        'Você extrai dados de um lead a partir de uma conversa de atendimento. ' +
        'Responda APENAS com um JSON válido, sem texto extra, no formato: ' +
        `{"name": string|null, "email": string|null, "summary": string, "qualified": boolean, "concluded": boolean${tagsField}}. ` +
        '- name: nome da pessoa/responsável, se mencionado. ' +
        '- email: e-mail, se mencionado (valide formato básico). ' +
        summaryGuide +
        '- qualified: true se já dá para entender claramente o interesse/necessidade do cliente. ' +
        '- concluded: true APENAS se a conversa parece ter chegado ao fim (o cliente se despediu, agradeceu, disse que era só isso, ou já obteve o que precisava e não há pergunta pendente). Se ainda parece em andamento, use false. ' +
        tagsGuide +
        'Use null quando a informação não aparecer. NUNCA invente dados.' +
        businessContext,
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
    if (data.summary) update.ai_summary = String(data.summary).slice(0, 1500)
    // Qualificação: dispara uma única vez (novo_lead → em_atendimento)
    const qualifiedNow = !!(data.qualified && current.stage === 'novo_lead')
    if (qualifiedNow) update.stage = 'em_atendimento'

    // Auto-tags: só aceita as que estão na taxonomia; faz UNIÃO com as manuais.
    if (taxonomy.length && Array.isArray(data.tags)) {
      const allow = new Set(taxonomy)
      const picked = data.tags.map((t: any) => String(t).trim()).filter((t: string) => allow.has(t))
      const currentTags: string[] = current.tags || []
      const merged = Array.from(new Set([...currentTags, ...picked]))
      if (merged.length !== currentTags.length) update.tags = merged
    }

    if (Object.keys(update).length > 0) {
      await tenantPrisma.contact.update({ where: { id: contact.id }, data: update })
    }

    // 4.1 — Encaminhar o resumo COMPLETO ao gestor assim que a conversa CONCLUIR
    // (o bot detecta a despedida/fim). É o caminho imediato ("logo após a conversa").
    // Conversas que ficam no ar sem despedida são pegas pela varredura do cron
    // (forwardPendingSummaries) como rede de segurança.
    const resumoAtual = update.ai_summary || current.ai_summary
    if (
      data.concluded === true &&
      resumoAtual &&
      tenant.feature_summary_forward &&
      tenant.summary_forward_number &&
      tenant.summary_forward_template &&
      tenant.phone_number_id && tenant.whatsapp_token &&
      !(current as any).summary_forwarded_at
    ) {
      try {
        const who = update.name || current.name || current.phone || 'Contato'
        const label = `${who}${current.phone ? ` (${current.phone})` : ''}`
        await sendWhatsAppTemplate(
          { phone_number_id: tenant.phone_number_id, whatsapp_token: tenant.whatsapp_token },
          String(tenant.summary_forward_number).replace(/\D/g, ''),
          tenant.summary_forward_template,
          [label, String(resumoAtual).slice(0, 900)]
        )
        await tenantPrisma.contact.update({ where: { id: contact.id }, data: { summary_forwarded_at: new Date() } })
      } catch (e) {
        // Se falhar (ex.: template ainda não aprovado), o cron tenta de novo depois.
        console.error('[extractContactInfo] encaminhar resumo (concluído) falhou', (e as any)?.message || e)
      }
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
    description: 'Cria um NOVO agendamento em uma data e horário livres. Use apenas quando o cliente não tem um agendamento anterior para alterar.',
    input_schema: {
      type: 'object',
      properties: {
        data: { type: 'string', description: 'Data AAAA-MM-DD' },
        hora: { type: 'string', description: 'Horário HH:MM' },
        servico: { type: 'string', description: 'Nome do serviço (opcional)' },
        nome: { type: 'string', description: 'Nome de quem vai ao atendimento (o participante: aluno/paciente/próprio). Pode ser diferente de quem está falando no WhatsApp. Sempre preencha.' },
        agendado_por: { type: 'string', description: 'Nome de quem está fazendo o agendamento (responsável), quando for diferente do participante. Se o agendamento for para a própria pessoa, deixe vazio.' },
        email: { type: 'string', description: 'E-mail do cliente para envio da confirmação' }
      },
      required: ['data', 'hora']
    }
  },
  {
    name: 'reagendar',
    description: 'Remarca o agendamento do cliente: cancela o(s) agendamento(s) futuro(s) existente(s) dele e cria um novo na nova data/horário. Use sempre que o cliente quiser mudar/remarcar um horário já agendado.',
    input_schema: {
      type: 'object',
      properties: {
        data: { type: 'string', description: 'Nova data AAAA-MM-DD' },
        hora: { type: 'string', description: 'Novo horário HH:MM' },
        servico: { type: 'string', description: 'Nome do serviço (opcional)' },
        nome: { type: 'string', description: 'Nome de quem vai ao atendimento (o participante: aluno/paciente/próprio). Pode ser diferente de quem está falando no WhatsApp. Sempre preencha.' },
        agendado_por: { type: 'string', description: 'Nome de quem está fazendo o agendamento (responsável), quando for diferente do participante. Se o agendamento for para a própria pessoa, deixe vazio.' },
        email: { type: 'string', description: 'E-mail do cliente para envio da confirmação' }
      },
      required: ['data', 'hora']
    }
  }
]

// Ferramentas do catálogo de produtos (plano Promaster).
const PRODUCT_TOOLS = [
  {
    name: 'buscar_produtos',
    description: 'Busca produtos no catálogo da loja por termo, marca, preço máximo e disponibilidade. Use SEMPRE antes de citar qualquer produto, preço ou link — nunca invente produtos.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Termos da busca (ex.: "shampoo cabelo cacheado", "protetor solar facial")' },
        marca: { type: 'string', description: 'Filtrar por marca (opcional)' },
        preco_max: { type: 'number', description: 'Preço máximo em reais (opcional)' },
        so_em_estoque: { type: 'boolean', description: 'Se true, retorna apenas produtos em estoque (opcional)' }
      },
      required: ['query']
    }
  },
  {
    name: 'detalhes_produto',
    description: 'Retorna a ficha completa de um produto (preço, promoção, parcelamento, disponibilidade e link da página) pelo id retornado por buscar_produtos.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'id do produto retornado por buscar_produtos' }
      },
      required: ['id']
    }
  }
]

async function resolveService(tenantPrisma: any, name?: string): Promise<{ id: string | null; duration: number; label: string; gap: number; minNotice: number; chargeMode: string; chargeValue: number; holdMinutes: number; price: number }> {
  const toObj = (s: any) => ({ id: s.id, duration: s.duration_min, label: s.name, gap: s.gap_min || 0, minNotice: s.min_notice_min || 0, chargeMode: s.charge_mode || 'none', chargeValue: Number(s.charge_value) || 0, holdMinutes: s.hold_minutes || 30, price: Number(s.price) || 0 })
  if (name) {
    const all = await tenantPrisma.service.findMany({ where: { active: true } })
    const found = all.find((s: any) => s.name.toLowerCase().includes(String(name).toLowerCase()))
    if (found) return toObj(found)
  }
  const first = await tenantPrisma.service.findFirst({ where: { active: true } })
  if (first) return toObj(first)
  return { id: null, duration: 60, label: 'Atendimento', gap: 0, minNotice: 0, chargeMode: 'none', chargeValue: 0, holdMinutes: 30, price: 0 }
}

/** Calcula o valor do sinal a cobrar conforme o modo de cobrança do serviço. */
function computeChargeAmount(svc: { chargeMode: string; chargeValue: number; price: number }): number {
  if (svc.chargeMode === 'fixed') return svc.chargeValue
  if (svc.chargeMode === 'percent') return Math.round(svc.price * svc.chargeValue) / 100
  if (svc.chargeMode === 'full') return svc.price
  return 0
}

interface SchedulingCtx {
  tenantPrisma: any
  contactId: string
  contactName: string | null
  businessName?: string
  replyTo?: string | null
  tenantId?: string
  schemaName?: string
  mpAccessToken?: string | null
  waTenant?: { phone_number_id: string; whatsapp_token: string }
  contactPhone?: string
}

async function runSchedulingTool(name: string, input: any, ctx: SchedulingCtx): Promise<string> {
  const { tenantPrisma } = ctx
  try {
    if (name === 'buscar_produtos') {
      const produtos = await searchProducts(tenantPrisma, {
        query: input.query, brand: input.marca,
        priceMax: typeof input.preco_max === 'number' ? input.preco_max : undefined,
        inStockOnly: input.so_em_estoque === true, limit: 6
      })
      if (!produtos.length) return JSON.stringify({ produtos: [], aviso: 'Nenhum produto encontrado com esses critérios. Sugira ao cliente refinar a busca ou tente outra marca/termo.' })
      // Envia dados enxutos (o link só na ficha, para o bot não vazar links errados).
      return JSON.stringify({ produtos: produtos.map((p) => ({ id: p.id, titulo: p.title, marca: p.brand, preco: p.price, promocao: p.sale_price, em_estoque: p.in_stock })) })
    }
    if (name === 'detalhes_produto') {
      const p = await getProductById(tenantPrisma, String(input.id))
      if (!p) return JSON.stringify({ ok: false, erro: 'Produto não encontrado. Use buscar_produtos para obter ids válidos.' })
      return JSON.stringify({
        ok: true, id: p.id, titulo: p.title, marca: p.brand, categoria: p.category,
        preco: p.price != null ? Number(p.price) : null,
        promocao: p.sale_price != null ? Number(p.sale_price) : null,
        parcelamento: p.installments || null, em_estoque: p.in_stock, link: p.url
      })
    }
    if (name === 'verificar_horarios') {
      const svc = await resolveService(tenantPrisma, input.servico)
      const slots = await getAvailableSlots(tenantPrisma, input.data, svc.duration, svc.gap, svc.minNotice, svc.id)
      const dia = weekdayName(input.data)
      if (!slots.length) return JSON.stringify({ data: input.data, dia_semana: dia, horarios: [], aviso: `Não há horários de atendimento em ${dia} (${input.data}). Sugira outro dia.` })
      return JSON.stringify({ data: input.data, dia_semana: dia, servico: svc.label, horarios: slots })
    }
    if (name === 'agendar' || name === 'reagendar') {
      const svc = await resolveService(tenantPrisma, input.servico)
      const dia = weekdayName(input.data)
      const start = brDateTime(input.data, input.hora)
      const end = new Date(start.getTime() + svc.duration * 60000)
      if (start.getTime() < Date.now()) return JSON.stringify({ ok: false, erro: 'Esse horário já passou.' })
      // Valida contra a disponibilidade real (dias de atendimento + conflitos + horário)
      const slots = await getAvailableSlots(tenantPrisma, input.data, svc.duration, svc.gap, svc.minNotice, svc.id)
      if (!slots.includes(input.hora)) {
        return JSON.stringify({
          ok: false,
          dia_semana: dia,
          erro: `O horário ${input.hora} de ${dia} (${input.data}) não está disponível. Ofereça apenas horários retornados por verificar_horarios.`,
          horarios_livres: slots
        })
      }
      const email = typeof input.email === 'string' && input.email.includes('@') ? input.email.trim() : null
      const attendee = (typeof input.nome === 'string' && input.nome.trim()) ? input.nome.trim() : (ctx.contactName || null)
      // Quem agendou (responsável): informado pelo bot, ou o próprio contato quando difere do participante.
      const bookedBy = (typeof input.agendado_por === 'string' && input.agendado_por.trim())
        ? input.agendado_por.trim()
        : (attendee && ctx.contactName && attendee !== ctx.contactName ? ctx.contactName : null)
      const whenLabel = start.toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
      })

      // Remarcação: cancela os agendamentos futuros ativos do cliente antes de criar o novo.
      if (name === 'reagendar' && ctx.contactId) {
        await tenantPrisma.appointment.updateMany({
          where: {
            contact_id: ctx.contactId,
            status: { in: ['scheduled', 'confirmed', 'pending_payment'] },
            start_at: { gte: new Date() }
          },
          data: { status: 'cancelled' }
        }).catch(() => {})
      }

      // Guarda o e-mail no contato para reaproveitar em futuros agendamentos.
      if (email && ctx.contactId) {
        await tenantPrisma.contact.update({ where: { id: ctx.contactId }, data: { email } }).catch(() => {})
      }

      // ── Cobrança de sinal (pré-reserva com prazo) ──
      const chargeAmount = computeChargeAmount(svc)
      const requiresPayment = svc.chargeMode !== 'none' && chargeAmount > 0 && !!ctx.mpAccessToken
      if (requiresPayment) {
        if (!email) {
          return JSON.stringify({ ok: false, erro: 'Para reservar este serviço é necessário um pagamento. Peça o e-mail do cliente para enviar a cobrança Pix e chame agendar novamente com o email.' })
        }
        const holdExpires = new Date(Date.now() + svc.holdMinutes * 60000)
        const appt = await tenantPrisma.appointment.create({
          data: {
            contact_id: ctx.contactId, service_id: svc.id,
            customer_name: attendee, customer_email: email, booked_by: bookedBy,
            title: svc.label, start_at: start, end_at: end,
            status: 'pending_payment', amount_due: chargeAmount, payment_status: 'pending', hold_expires_at: holdExpires
          }
        })
        try {
          const { createPixCharge } = await import('./pix')
          const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://uprocrm.com.br'
          const pix = await createPixCharge({
            accessToken: ctx.mpAccessToken!,
            amount: chargeAmount,
            description: `Sinal - ${svc.label}`,
            payerEmail: email,
            externalReference: `appt:${ctx.schemaName}:${appt.id}`,
            notificationUrl: `${baseUrl}/api/webhooks/mercadopago`,
            expiresMinutes: svc.holdMinutes
          })
          await tenantPrisma.appointment.update({ where: { id: appt.id }, data: { payment_id: pix.paymentId } })
          // Mapeamento global para o webhook rotear a confirmação.
          const { globalPrisma } = await import('./prisma-tenant')
          await globalPrisma.appointmentPayment.create({
            data: { payment_id: pix.paymentId, tenant_id: ctx.tenantId!, schema_name: ctx.schemaName!, appointment_id: appt.id, amount: chargeAmount }
          })
          // Envia o Pix "copia e cola" + link ao cliente.
          if (ctx.waTenant) {
            const money = chargeAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
            const msg = `Para *garantir* seu horário (${svc.label} — ${whenLabel}), pague o sinal de *${money}* via Pix em até *${svc.holdMinutes} min*:\n\n*Pix copia e cola:*\n${pix.qrCode}\n\nOu pague pelo link:\n${pix.ticketUrl}\n\nAssim que o pagamento for confirmado, seu horário fica garantido. ✅`
            await sendWhatsAppMessage(ctx.waTenant, ctx.contactPhone || '', msg).catch((e) => console.error('[pix] send failed', e))
          }
          return JSON.stringify({ ok: true, aguardando_pagamento: true, valor: chargeAmount, prazo_min: svc.holdMinutes, servico: svc.label, data: input.data, hora: input.hora, aviso: 'A cobrança Pix já foi enviada ao cliente pelo WhatsApp. Informe que o horário será garantido assim que o pagamento for confirmado, dentro do prazo.' })
        } catch (e: any) {
          // Falhou gerar o Pix: remove a pré-reserva para não travar o horário.
          await tenantPrisma.appointment.delete({ where: { id: appt.id } }).catch(() => {})
          return JSON.stringify({ ok: false, erro: 'Não consegui gerar a cobrança Pix agora. Peça para o cliente tentar novamente em instantes.' })
        }
      }

      // ── Sem cobrança: agendamento direto ──
      await tenantPrisma.appointment.create({
        data: {
          contact_id: ctx.contactId, service_id: svc.id,
          customer_name: attendee, customer_email: email, booked_by: bookedBy,
          title: svc.label, start_at: start, end_at: end, status: 'scheduled'
        }
      })
      if (email) {
        sendAppointmentEmail({
          to: email, businessName: ctx.businessName || 'Agendamento', replyTo: ctx.replyTo,
          serviceName: svc.label, whenLabel, kind: 'created', attendeeName: attendee, bookedBy
        }).catch((e) => console.error('[appointment email] created failed', e))
      }
      return JSON.stringify({ ok: true, servico: svc.label, data: input.data, hora: input.hora, email_registrado: !!email })
    }
  } catch (err: any) {
    return JSON.stringify({ ok: false, erro: err?.message || 'Falha na operação' })
  }
  return JSON.stringify({ ok: false, erro: 'Ferramenta desconhecida' })
}

async function aiReplyWithTools(
  system: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  ctx: SchedulingCtx,
  tools: any[]
): Promise<string> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5'

  const convo: any[] = messages.map((m) => ({ role: m.role, content: m.content }))

  for (let i = 0; i < 5; i++) {
    const res: any = await anthropic.messages.create({
      model, max_tokens: 1024, system, tools: tools as any, messages: convo
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
    name?: string
    email?: string | null
    schema_name: string
    phone_number_id: string
    whatsapp_token: string
    bot_prompt: string | null
    handoff_pause?: boolean
    keep_responding_after_human?: boolean
    booking_gap_min?: number
    booking_min_notice_min?: number
    scheduling_enabled?: boolean
    mp_access_token?: string | null
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
  let catalogOn = false
  if (useAnthropic) {
    if (tenant.scheduling_enabled === false) {
      schedulingOn = false
    } else {
      try { schedulingOn = (await tenantPrisma.availability.count()) > 0 } catch { schedulingOn = false }
    }
    try { catalogOn = (await tenantPrisma.product.count()) > 0 } catch { catalogOn = false }
  }

  let botReply: string
  if (useAnthropic && (schedulingOn || catalogOn)) {
    let hint = ''
    if (schedulingOn) {
      const todayName = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long' })
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) // AAAA-MM-DD
      hint += `\n\nAGENDAMENTO (regras rígidas):\n` +
        `- Hoje é ${todayName}, ${today} (fuso de São Paulo, UTC-3).\n` +
        `- NUNCA calcule o dia da semana de uma data você mesmo. Sempre use o campo "dia_semana" retornado pelas ferramentas e repita esse valor ao cliente.\n` +
        `- SEMPRE chame verificar_horarios antes de oferecer ou agendar qualquer horário. Ofereça apenas os horários que ela retornar.\n` +
        `- Só use agendar com data e hora que apareceram em verificar_horarios. Se a ferramenta retornar erro ou lista vazia, informe o cliente e sugira outro dia. Nunca invente disponibilidade.\n` +
        `- Antes de agendar, confirme com o cliente o serviço, a data e o horário.\n` +
        `- Antes de chamar agendar, peça o nome e o e-mail do cliente (o e-mail serve para enviarmos a confirmação). Passe ambos para a ferramenta agendar nos campos "nome" e "email".\n` +
        `- Descubra PARA QUEM é o atendimento: pergunte se é para a própria pessoa ou para outra (ex.: filho, parente). No campo "nome" passe SEMPRE o participante (quem será atendido) — é o nome que aparece na agenda. Se for para outra pessoa, passe também "agendado_por" com o nome de quem está agendando. Se for para a própria pessoa, deixe "agendado_por" vazio.\n` +
        `- Alguns serviços exigem um sinal via Pix. Se agendar retornar "aguardando_pagamento", NÃO diga que está confirmado: informe o valor e o prazo, e explique que a cobrança Pix foi enviada e o horário será garantido após o pagamento.\n` +
        `- Se o cliente já tem um agendamento e quer mudar de dia/horário (remarcar), use a ferramenta "reagendar" (ela cancela o horário anterior e cria o novo). NUNCA use "agendar" para uma remarcação, senão o horário antigo fica duplicado na agenda.`
    }
    if (catalogOn) {
      hint += `\n\nCATÁLOGO DE PRODUTOS (regras rígidas):\n` +
        `- Você tem acesso ao catálogo real da loja. SEMPRE chame buscar_produtos antes de citar qualquer produto, preço ou disponibilidade. NUNCA invente produtos, preços ou links.\n` +
        `- Ofereça no máximo 2 a 3 opções por vez, com nome, marca e preço, de forma objetiva.\n` +
        `- Para enviar o LINK de um produto, chame detalhes_produto e use exatamente o campo "link" retornado. Nunca escreva um link que não veio da ferramenta.\n` +
        `- Se o produto estiver "em_estoque": false, avise que está indisponível no momento e ofereça uma alternativa (nova busca).\n` +
        `- Mencione o preço promocional e o parcelamento quando existirem. Ao fechar, mande o link e diga que é só finalizar a compra na página.\n` +
        `- Se buscar_produtos não retornar nada, peça mais detalhes (marca, tipo, faixa de preço) em vez de inventar.`
    }
    let mpToken: string | null = null
    if (tenant.mp_access_token) { try { mpToken = decrypt(tenant.mp_access_token) } catch { mpToken = null } }
    const tools = [...(schedulingOn ? SCHEDULING_TOOLS : []), ...(catalogOn ? PRODUCT_TOOLS : [])]
    botReply = await aiReplyWithTools(basePrompt + GUARDRAIL + welcome + hint, messages, {
      tenantPrisma, contactId: contact.id, contactName: current?.name || null, businessName: tenant.name, replyTo: tenant.email,
      tenantId: tenant.id, schemaName: tenant.schema_name, mpAccessToken: mpToken,
      waTenant: { phone_number_id: tenant.phone_number_id, whatsapp_token: tenant.whatsapp_token }, contactPhone: from
    }, tools)
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

/**
 * Mostra o indicador "digitando…" no WhatsApp do cliente (e marca a mensagem como
 * lida). O indicador dura até ~25s ou até o bot enviar a resposta. Best-effort.
 * Requer o id da mensagem recebida (message.id do webhook).
 */
export async function sendTypingIndicator(
  tenant: { phone_number_id: string; whatsapp_token: string },
  messageId: string
) {
  if (!messageId) return
  try {
    const token = decrypt(tenant.whatsapp_token)
    await fetch(`https://graph.facebook.com/v21.0/${tenant.phone_number_id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
        typing_indicator: { type: 'text' }
      })
    })
  } catch (e) {
    console.error('[typing] failed', e)
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

/**
 * Envia uma mensagem de TEMPLATE aprovado (mensagem iniciada pelo negócio,
 * fora da janela de 24h). Usado para encaminhar o resumo ao gestor (4.1).
 * bodyParams preenchem as variáveis {{1}}, {{2}}... do corpo do template.
 * Parâmetros de template não podem ter quebras de linha nem 4+ espaços.
 */
export async function sendWhatsAppTemplate(
  tenant: { phone_number_id: string; whatsapp_token: string },
  to: string,
  templateName: string,
  bodyParams: string[],
  lang = 'pt_BR'
) {
  const token = decrypt(tenant.whatsapp_token)
  const clean = (s: string) => String(s || '').replace(/\s*\n\s*/g, ' · ').replace(/\s{4,}/g, '   ').trim()

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${tenant.phone_number_id}/messages`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: lang },
          components: [{ type: 'body', parameters: bodyParams.map((p) => ({ type: 'text', text: clean(p) })) }]
        }
      })
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`WhatsApp template send failed: ${err}`)
  }
  // Resposta traz message id e contacts[].wa_id (número que a Meta resolveu).
  return await res.json().catch(() => ({}))
}

/**
 * Sondagem de diagnóstico: reproduz a decisão do bot para um tenant e
 * gera uma resposta com o PROMPT REAL, capturando o caminho e o erro.
 * NÃO envia nada pro WhatsApp. Usado por /api/admin/bot-diagnose?run=1.
 */
export async function probeBotReply(
  tenant: { schema_name: string; bot_prompt: string | null; name?: string; email?: string | null; scheduling_enabled?: boolean; mp_access_token?: string | null; phone_number_id?: string; whatsapp_token?: string; id?: string },
  userText: string
): Promise<any> {
  const tenantPrisma = getTenantPrisma(tenant.schema_name)
  const useAnthropic =
    (process.env.AI_PROVIDER || '').toLowerCase() === 'anthropic' ||
    (process.env.ANTHROPIC_API_KEY || '').startsWith('sk-ant')

  let schedulingOn = false
  let catalogOn = false
  let availabilityCount = 0
  let productCount = 0
  if (useAnthropic) {
    if (tenant.scheduling_enabled === false) schedulingOn = false
    else { try { availabilityCount = await tenantPrisma.availability.count(); schedulingOn = availabilityCount > 0 } catch (e: any) { schedulingOn = false } }
    try { productCount = await tenantPrisma.product.count(); catalogOn = productCount > 0 } catch { catalogOn = false }
  }

  const basePrompt = tenant.bot_prompt || 'Você é um assistente de atendimento ao cliente. Seja sempre educado, claro e prestativo.'
  const messages = [{ role: 'user' as const, content: userText }]
  const path = useAnthropic && (schedulingOn || catalogOn) ? 'aiReplyWithTools' : 'chatComplete'

  const started = Date.now()
  try {
    let reply: string
    if (path === 'aiReplyWithTools') {
      const tools = [...(schedulingOn ? SCHEDULING_TOOLS : []), ...(catalogOn ? PRODUCT_TOOLS : [])]
      let mpToken: string | null = null
      if (tenant.mp_access_token) { try { mpToken = decrypt(tenant.mp_access_token) } catch { mpToken = null } }
      reply = await aiReplyWithTools(basePrompt + GUARDRAIL, messages, {
        tenantPrisma, contactId: 'diagnose', contactName: null, businessName: tenant.name || '', replyTo: tenant.email || null,
        tenantId: tenant.id || '', schemaName: tenant.schema_name, mpAccessToken: mpToken,
        waTenant: { phone_number_id: tenant.phone_number_id || '', whatsapp_token: tenant.whatsapp_token || '' }, contactPhone: 'diagnose'
      } as any, tools)
    } else {
      reply = await chatComplete({ maxTokens: 512, system: basePrompt + GUARDRAIL, messages })
    }
    return { ok: true, path, useAnthropic, schedulingOn, catalogOn, availabilityCount, productCount, ms: Date.now() - started, reply }
  } catch (e: any) {
    return { ok: false, path, useAnthropic, schedulingOn, catalogOn, availabilityCount, productCount, ms: Date.now() - started,
      error: e?.message || String(e), status: e?.status ?? e?.statusCode ?? null, type: e?.error?.type ?? e?.type ?? null }
  }
}
