export const dynamic = 'force-dynamic'

import { globalPrisma } from '@/lib/prisma-tenant'
import { encrypt } from '@/lib/crypto'

/**
 * Atalho para conectar manualmente um número de WhatsApp a um tenant (teste).
 * Protegido pelo NEXTAUTH_SECRET. Use via POST com JSON:
 * {
 *   "token": "<NEXTAUTH_SECRET>",
 *   "email": "<email do tenant>"  // ou "tenantId": "<uuid>"
 *   "phone_number_id": "<id do número (Meta)>",
 *   "access_token": "<token de acesso da Meta>",
 *   "waba_id": "<id da WABA, opcional>"
 * }
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { token, email, tenantId, phone_number_id, access_token, waba_id, plan } = body

  if (!token || token !== process.env.NEXTAUTH_SECRET) {
    return Response.json({ error: 'Token inválido' }, { status: 401 })
  }

  const tenant = tenantId
    ? await globalPrisma.tenant.findUnique({ where: { id: tenantId } })
    : email
      ? await globalPrisma.tenant.findUnique({ where: { email } })
      : null

  if (!tenant) {
    return Response.json({ error: 'Tenant não encontrado (informe email ou tenantId)' }, { status: 404 })
  }

  // Desconectar: limpa a configuração de WhatsApp do tenant
  if (body.disconnect === true) {
    await globalPrisma.tenant.update({
      where: { id: tenant.id },
      data: {
        phone_number_id: null,
        whatsapp_token: null,
        whatsapp_connected: false,
        bot_enabled: false
      }
    })
    return Response.json({ ok: true, disconnected: true, tenant: tenant.email })
  }

  if (!phone_number_id || !access_token) {
    return Response.json(
      { error: 'Informe phone_number_id e access_token' },
      { status: 400 }
    )
  }

  await globalPrisma.tenant.update({
    where: { id: tenant.id },
    data: {
      phone_number_id: String(phone_number_id),
      whatsapp_token: encrypt(String(access_token)),
      waba_id: waba_id ? String(waba_id) : tenant.waba_id,
      whatsapp_connected: true,
      ...(plan ? { plan: String(plan) } : {})
    }
  })

  return Response.json({
    ok: true,
    tenant: tenant.email,
    phone_number_id: String(phone_number_id),
    plan: plan ? String(plan) : tenant.plan
  })
}
