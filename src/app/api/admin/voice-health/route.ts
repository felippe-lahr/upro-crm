export const dynamic = 'force-dynamic'

import { isValidAdminToken } from '@/lib/admin-auth'
import { globalPrisma, getTenantPrisma } from '@/lib/prisma-tenant'
import { transcribeWhatsAppAudioDetailed } from '@/lib/transcribe'
import { probeBotReply } from '@/lib/bot'

/**
 * Diagnóstico da transcrição de voz (Groq Whisper).
 * Uso geral:      /api/admin/voice-health?token=<ADMIN_API_SECRET>
 * Por tenant:     /api/admin/voice-health?token=<ADMIN_API_SECRET>&email=<email-do-tenant>
 *   → confere plano/bot, últimos áudios recebidos e tenta transcrever de novo o mais recente.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  if (!isValidAdminToken(token)) {
    return Response.json({ error: 'Token inválido' }, { status: 401 })
  }
  const email = (url.searchParams.get('email') || '').trim().toLowerCase()
  if (email) return tenantCheck(email)

  const raw = process.env.GROQ_API_KEY || ''
  const key = raw.trim()
  const hadWhitespace = raw !== key

  if (!key) {
    return Response.json({ ok: false, reason: 'GROQ_API_KEY ausente' })
  }

  // Verifica a autenticação chamando o endpoint de modelos do Groq.
  let auth_ok = false
  let status = 0
  let detail: string | undefined
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${key}` }
    })
    status = res.status
    auth_ok = res.ok
    if (!res.ok) detail = (await res.text()).slice(0, 300)
  } catch (e: any) {
    detail = e?.message || String(e)
  }

  return Response.json({
    ok: auth_ok,
    groq_key_present: true,
    key_had_trailing_whitespace: hadWhitespace, // se true, era essa a causa
    key_length: key.length,
    groq_status: status,
    detail,
    hint: auth_ok
      ? 'Chave OK — a transcrição de áudio deve funcionar.'
      : 'Groq recusou a chave. Verifique o valor no Railway (sem espaços/quebras).'
  })
}

/** Caminho completo do áudio para um tenant: roteamento, áudios recentes e nova tentativa. */
async function tenantCheck(email: string) {
  const tenant = await globalPrisma.tenant.findFirst({ where: { email } })
  if (!tenant) return Response.json({ ok: false, reason: 'Tenant não encontrado para esse e-mail' }, { status: 404 })

  const aiBot = ['pro', 'promaster'].includes(tenant.plan) && tenant.bot_enabled
  const routing = {
    plan: tenant.plan,
    bot_enabled: tenant.bot_enabled,
    menu_bot_enabled: tenant.menu_bot_enabled,
    whatsapp_connected: tenant.whatsapp_connected,
    audio_vai_para_ia: aiBot,
    nota: aiBot
      ? 'Áudio é transcrito e respondido pela IA.'
      : 'A IA só atende áudio nos planos Pro/Promaster com o bot ligado. Neste tenant o áudio não chega à IA.'
  }

  const db = getTenantPrisma(tenant.schema_name)
  const recent = await db.message.findMany({
    where: { direction: 'inbound', type: 'audio' },
    orderBy: { timestamp: 'desc' },
    take: 5,
    select: { content: true, media_url: true, timestamp: true, contact_id: true }
  }).catch(() => [])

  // Conversa do áudio mais recente: o que aconteceu depois dele?
  let conversa: any = null
  let teste_ia: any = null
  const last: any = recent[0]
  if (last) {
    const msgs = await db.message.findMany({
      where: { contact_id: last.contact_id },
      orderBy: { timestamp: 'desc' },
      take: 12,
      select: { direction: true, sent_by_bot: true, type: true, content: true, timestamp: true }
    }).catch(() => [])
    const conv = await db.conversation.findFirst({
      where: { contact_id: last.contact_id },
      orderBy: { created_at: 'desc' },
      select: { status: true }
    }).catch(() => null)
    const humanCutoff = Date.now() - 30 * 60 * 1000
    const humanRecent = msgs.find((m: any) => m.direction === 'outbound' && !m.sent_by_bot && new Date(m.timestamp).getTime() >= humanCutoff)
    conversa = {
      status_conversa: conv?.status ?? 'sem registro',
      handoff_pause: tenant.handoff_pause,
      keep_responding_after_human: tenant.keep_responding_after_human,
      humano_respondeu_nos_ultimos_30min: !!humanRecent,
      mensagens: msgs.reverse().map((m: any) => ({
        quando: m.timestamp,
        quem: m.direction === 'inbound' ? 'cliente' : m.sent_by_bot ? 'bot' : 'humano',
        tipo: m.type,
        texto: String(m.content || '').slice(0, 140)
      }))
    }
    // Testa a IA com o texto do último áudio (não envia nada ao WhatsApp).
    const texto = String(last.content || '').replace(/^🎤\s*/, '')
    if (texto && !texto.startsWith('[')) {
      teste_ia = await probeBotReply(tenant as any, texto).catch((e: any) => ({ ok: false, error: e?.message || String(e) }))
      if (teste_ia?.reply) teste_ia.reply = String(teste_ia.reply).slice(0, 400)
    }
  }

  // Tenta transcrever de novo o áudio mais recente que tenha o id guardado.
  let retry: any = null
  const withId = recent.find((m: any) => String(m.media_url || '').startsWith('wa-media:'))
  if (withId && tenant.phone_number_id && tenant.whatsapp_token) {
    const mediaId = String(withId.media_url).slice('wa-media:'.length)
    const r = await transcribeWhatsAppAudioDetailed(
      { phone_number_id: tenant.phone_number_id, whatsapp_token: tenant.whatsapp_token },
      mediaId
    )
    retry = r.text ? { ok: true, texto: r.text.slice(0, 200) } : { ok: false, motivo: r.error }
  }

  return Response.json({
    tenant: tenant.name,
    roteamento: routing,
    groq_key_presente: !!(process.env.GROQ_API_KEY || '').trim(),
    feature_orders: tenant.feature_orders,
    ultimos_audios: recent.map((m: any) => ({ quando: m.timestamp, conteudo: m.content })),
    conversa_do_ultimo_audio: conversa,
    teste_ia_com_ultimo_audio: teste_ia,
    nova_tentativa: retry ?? 'nenhum áudio recente com id guardado (envie um áudio novo depois do deploy)'
  })
}
