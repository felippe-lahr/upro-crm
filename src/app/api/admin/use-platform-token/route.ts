export const dynamic = 'force-dynamic'

import { isValidAdminToken } from '@/lib/admin-auth'
import { globalPrisma } from '@/lib/prisma-tenant'
import { encrypt, decrypt } from '@/lib/crypto'
import { tryPlatformToken } from '@/lib/wa-token'

/**
 * Troca o token do WhatsApp de um tenant pelo token PERMANENTE da plataforma
 * (META_SYSTEM_USER_TOKEN), se ele tiver (ou conseguir) acesso ao número.
 * Uso: /api/admin/use-platform-token?token=<ADMIN_API_SECRET>&email=<tenant>
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  if (!isValidAdminToken(url.searchParams.get('token'))) {
    return Response.json({ error: 'Token inválido' }, { status: 401 })
  }
  const email = (url.searchParams.get('email') || '').trim().toLowerCase()
  const t = await globalPrisma.tenant.findFirst({ where: { email } })
  if (!t) return Response.json({ ok: false, error: 'Tenant não encontrado' }, { status: 404 })

  // &undo=1 volta para o token anterior guardado.
  if (url.searchParams.get('undo') === '1') {
    if (!(t as any).whatsapp_token_prev) return Response.json({ ok: false, error: 'Não há token anterior guardado' })
    await globalPrisma.tenant.update({
      where: { id: t.id },
      data: { whatsapp_token: (t as any).whatsapp_token_prev, whatsapp_token_prev: t.whatsapp_token, whatsapp_needs_reconnect: false } as any
    })
    return Response.json({ ok: true, tenant: t.name, resultado: 'Token anterior restaurado.' })
  }
  if (!t.phone_number_id) return Response.json({ ok: false, error: 'Tenant sem número conectado' }, { status: 400 })

  let clientToken: string | null = null
  try { clientToken = t.whatsapp_token ? decrypt(t.whatsapp_token) : null } catch { clientToken = null }

  const r = await tryPlatformToken({ wabaId: t.waba_id, phoneNumberId: t.phone_number_id, clientToken })
  if (!r.token) {
    return Response.json({
      ok: false,
      tenant: t.name,
      motivo: r.detail,
      proximo_passo: 'Reconecte este tenant com um token de Usuário do Sistema "Nunca expira" (Configurações → Conectar número próprio).'
    })
  }

  await globalPrisma.tenant.update({
    where: { id: t.id },
    data: {
      whatsapp_token_prev: t.whatsapp_token, // guarda para poder desfazer (&undo=1)
      whatsapp_token: encrypt(r.token),
      whatsapp_connected: true,
      whatsapp_needs_reconnect: false,
      whatsapp_token_type: 'SYSTEM_USER',
      whatsapp_token_expires_at: null
    }
  })
  return Response.json({ ok: true, tenant: t.name, resultado: 'Agora usa o token permanente da plataforma (não expira).', detalhe: r.detail })
}
