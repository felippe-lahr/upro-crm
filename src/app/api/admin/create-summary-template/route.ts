export const dynamic = 'force-dynamic'

import { globalPrisma } from '@/lib/prisma-tenant'
import { decrypt } from '@/lib/crypto'

/**
 * Cria (na WABA do tenant) o template usado para encaminhar o resumo do
 * atendimento, com a estrutura exata que o envio espera: corpo com 2 variáveis
 * ({{1}} = contato, {{2}} = resumo), idioma pt_BR, categoria UTILITY.
 * Ao criar, grava o nome em summary_forward_template. A APROVAÇÃO é assíncrona
 * (a Meta revisa; costuma levar minutos).
 * Uso: /api/admin/create-summary-template?token=<NEXTAUTH_SECRET>&email=<tenant>[&name=resumo_atendimento]
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  const email = url.searchParams.get('email')
  const name = (url.searchParams.get('name') || 'resumo_atendimento').toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 60)
  if (!token || token !== process.env.NEXTAUTH_SECRET) {
    return Response.json({ error: 'Token inválido' }, { status: 401 })
  }
  if (!email) return Response.json({ error: 'Informe ?email=<tenant>' }, { status: 400 })

  const tenant = await globalPrisma.tenant.findUnique({ where: { email } })
  if (!tenant) return Response.json({ error: 'Tenant não encontrado' }, { status: 404 })
  const t: any = tenant
  if (!t.waba_id || !t.whatsapp_token) {
    return Response.json({ error: 'Tenant sem WABA/token do WhatsApp (número não conectado?)' }, { status: 400 })
  }

  let waToken: string
  try { waToken = decrypt(t.whatsapp_token) } catch { return Response.json({ error: 'Falha ao ler o token do WhatsApp' }, { status: 500 }) }

  const body = {
    name,
    language: 'pt_BR',
    category: 'UTILITY',
    components: [
      {
        type: 'BODY',
        text: 'Novo resumo de atendimento ({{1}}):\n\n{{2}}',
        example: { body_text: [['João (5511999998888)', 'Cliente quer projeto de interiores e pediu um orçamento.']] }
      }
    ]
  }

  const res = await fetch(`https://graph.facebook.com/v21.0/${t.waba_id}/message_templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${waToken}` },
    body: JSON.stringify(body)
  })
  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    return Response.json({ ok: false, error: data?.error?.message || 'Falha ao criar template', meta: data }, { status: 200 })
  }

  // Guarda o nome para o envio usar. (Status de aprovação é consultado à parte na Meta.)
  await globalPrisma.tenant.update({ where: { id: t.id }, data: { summary_forward_template: name } })

  return Response.json({
    ok: true,
    message: `Template "${name}" criado e enviado para aprovação da Meta (idioma pt_BR, categoria UTILITY). Aprovação costuma levar minutos.`,
    template: { id: data?.id, name, status: data?.status || 'PENDING' }
  })
}
