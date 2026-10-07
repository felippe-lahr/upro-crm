export const dynamic = 'force-dynamic'

import { isAdminRequest } from '@/lib/admin-auth'
import { globalPrisma, getTenantPrisma } from '@/lib/prisma-tenant'
import { decrypt } from '@/lib/crypto'
import { inspectToken } from '@/lib/wa-token'

const GRAPH = 'https://graph.facebook.com/v21.0'

/**
 * Verifica e corrige o WhatsApp de um tenant de uma vez.
 * Uso: /api/admin/wa-fix?token=<ADMIN_API_SECRET>&email=<tenant>[&to=5511999999999][&unpause=1]
 * - valida o token; consulta o número; reinscreve o app na WABA (recebimento);
 * - mostra mensagens recebidas recentes e conversas pausadas (pending);
 * - &to= envia uma mensagem de teste; &unpause=1 tira conversas de "pending".
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  if (!(await isAdminRequest(url.searchParams.get('token')))) {
    return Response.json({ error: 'Token inválido' }, { status: 401 })
  }
  const email = (url.searchParams.get('email') || '').trim().toLowerCase()
  const to = (url.searchParams.get('to') || '').replace(/\D/g, '')
  const unpause = url.searchParams.get('unpause') === '1'

  const t = await globalPrisma.tenant.findFirst({ where: { email } })
  if (!t) return Response.json({ error: 'Tenant não encontrado' }, { status: 404 })
  if (!t.whatsapp_token || !t.phone_number_id) return Response.json({ error: 'Tenant sem WhatsApp conectado' }, { status: 400 })

  let token = ''
  try { token = decrypt(t.whatsapp_token) } catch { return Response.json({ error: 'Não foi possível ler o token salvo' }) }
  const auth = { Authorization: `Bearer ${token}` }
  const report: Record<string, unknown> = { tenant: t.name, plano: t.plan, bot_enabled: t.bot_enabled, handoff_pause: t.handoff_pause }

  // 1) Token
  const info = await inspectToken(token)
  report.token = { valido: info.valid, tipo: info.type, vence: info.expires_at ? info.expires_at.toISOString() : 'não expira', erro: info.error }

  // 2) Número
  try {
    const r = await fetch(`${GRAPH}/${t.phone_number_id}?fields=display_phone_number,verified_name,status,quality_rating,code_verification_status,name_status`, { headers: auth })
    report.numero = await r.json()
  } catch (e: any) { report.numero = { erro: e?.message } }

  // 3) Inscrição do app na WABA (sem ela, as mensagens não chegam ao UProCRM)
  if (t.waba_id) {
    try {
      const before = await (await fetch(`${GRAPH}/${t.waba_id}/subscribed_apps`, { headers: auth })).json()
      const sub = await (await fetch(`${GRAPH}/${t.waba_id}/subscribed_apps`, { method: 'POST', headers: auth })).json()
      const after = await (await fetch(`${GRAPH}/${t.waba_id}/subscribed_apps`, { headers: auth })).json()
      report.inscricao_app = {
        antes: (before?.data || []).map((a: any) => a?.whatsapp_business_api_data?.name || a?.whatsapp_business_api_data?.id),
        reinscrever: sub,
        depois: (after?.data || []).map((a: any) => a?.whatsapp_business_api_data?.name || a?.whatsapp_business_api_data?.id),
        erro: before?.error?.message || sub?.error?.message
      }
    } catch (e: any) { report.inscricao_app = { erro: e?.message } }
  } else {
    report.inscricao_app = 'tenant sem waba_id salvo'
  }

  // 4) Recebimento e pausas
  try {
    const db = getTenantPrisma(t.schema_name)
    const since = new Date(Date.now() - 3 * 60 * 60 * 1000)
    const inbound = await db.message.findMany({
      where: { direction: 'inbound', timestamp: { gte: since } },
      orderBy: { timestamp: 'desc' }, take: 5,
      select: { type: true, content: true, timestamp: true }
    })
    report.recebidas_ultimas_3h = inbound.map((m: any) => ({ quando: m.timestamp, tipo: m.type, texto: String(m.content || '').slice(0, 100) }))
    const pending = await db.conversation.count({ where: { status: 'pending' } })
    report.conversas_pausadas_pending = pending
    if (unpause && pending) {
      await db.conversation.updateMany({ where: { status: 'pending' }, data: { status: 'open' } })
      report.conversas_despausadas = pending
    }
  } catch (e: any) { report.banco = { erro: e?.message } }

  report.ultima_falha_do_bot = (t as any).last_bot_error ?? null
  report.ultimo_status_envio = (t as any).last_send_status ?? null

  // 5) Teste de envio (texto livre só entrega se o destino falou com o número nas últimas 24h)
  if (to) {
    try {
      const r = await fetch(`${GRAPH}/${t.phone_number_id}/messages`, {
        method: 'POST',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: 'Teste do UProCRM: envio funcionando ✅' } })
      })
      report.teste_envio = { http: r.status, resposta: await r.json() }
    } catch (e: any) { report.teste_envio = { erro: e?.message } }
  }

  await globalPrisma.tenant.update({ where: { id: t.id }, data: { whatsapp_needs_reconnect: !info.valid } }).catch(() => {})
  return Response.json(report)
}
