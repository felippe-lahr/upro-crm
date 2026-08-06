export const dynamic = 'force-dynamic'

import { globalPrisma } from '@/lib/prisma-tenant'
import { decrypt } from '@/lib/crypto'

/**
 * Consulta o status de aprovação do(s) template(s) de resumo na WABA do tenant.
 * Útil para saber quando o template já pode ser usado (APPROVED).
 * Uso: /api/admin/summary-template-status?token=<NEXTAUTH_SECRET>&email=<tenant>[&name=resumo_atendimento]
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  const email = url.searchParams.get('email')
  const name = url.searchParams.get('name') // opcional: filtra por um nome específico
  if (!token || token !== process.env.NEXTAUTH_SECRET) {
    return Response.json({ error: 'Token inválido' }, { status: 401 })
  }
  if (!email) return Response.json({ error: 'Informe ?email=<tenant>' }, { status: 400 })

  const tenant = await globalPrisma.tenant.findUnique({ where: { email } })
  if (!tenant) return Response.json({ error: 'Tenant não encontrado' }, { status: 404 })
  const t: any = tenant
  if (!t.waba_id || !t.whatsapp_token) {
    return Response.json({ error: 'Tenant sem WABA/token do WhatsApp' }, { status: 400 })
  }

  let waToken: string
  try { waToken = decrypt(t.whatsapp_token) } catch { return Response.json({ error: 'Falha ao ler o token' }, { status: 500 }) }

  const wanted = name || t.summary_forward_template || 'resumo_atendimento'
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${t.waba_id}/message_templates?fields=name,status,language,category,rejected_reason&limit=200`,
    { headers: { Authorization: `Bearer ${waToken}` } }
  )
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return Response.json({ ok: false, error: data?.error?.message || 'Falha ao consultar templates', meta: data }, { status: 200 })
  }

  const all = Array.isArray(data?.data) ? data.data : []
  const match = all.filter((tpl: any) => tpl.name === wanted)
  const approved = match.some((tpl: any) => tpl.status === 'APPROVED')

  return Response.json({
    ok: true,
    tenant: { email: t.email, waba_id: t.waba_id },
    configured: {
      summary_forward_template: t.summary_forward_template || null,
      summary_forward_number: t.summary_forward_number || null,
      feature_summary_forward: !!t.feature_summary_forward
    },
    lookingFor: wanted,
    approved,
    matches: match.map((tpl: any) => ({ name: tpl.name, status: tpl.status, language: tpl.language, category: tpl.category, rejected_reason: tpl.rejected_reason })),
    hint: approved
      ? 'Template APROVADO — pronto para uso.'
      : match.length
        ? `Template encontrado, status: ${match.map((m: any) => m.status).join(', ')}. Aguarde APPROVED.`
        : 'Template ainda não aparece na WABA (recém-criado pode levar alguns segundos) — confira o nome.'
  })
}
