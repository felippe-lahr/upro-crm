export const dynamic = 'force-dynamic'

import { globalPrisma } from '@/lib/prisma-tenant'
import { createSummaryTemplate, SUMMARY_TEMPLATE_NAME } from '@/lib/whatsapp-templates'

/**
 * Cria (na WABA do tenant) o template de encaminhamento de resumo, com a
 * estrutura exata que o envio espera. Ao criar, grava o nome em
 * summary_forward_template. Aprovação é assíncrona (Meta revisa; ~minutos).
 * Uso: /api/admin/create-summary-template?token=<NEXTAUTH_SECRET>&email=<tenant>
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  const email = url.searchParams.get('email')
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

  const result = await createSummaryTemplate({ waba_id: t.waba_id, whatsapp_token: t.whatsapp_token })
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: 200 })
  }

  await globalPrisma.tenant.update({ where: { id: t.id }, data: { summary_forward_template: result.name } })
  return Response.json({
    ok: true,
    message: result.alreadyExists
      ? `Template "${result.name}" já existia — nome vinculado. Verifique a aprovação.`
      : `Template "${result.name}" criado e enviado para aprovação da Meta (~minutos).`,
    name: result.name,
    status: result.status || (result.alreadyExists ? 'EXISTS' : 'PENDING'),
    templateName: SUMMARY_TEMPLATE_NAME
  })
}
