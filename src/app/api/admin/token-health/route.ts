export const dynamic = 'force-dynamic'

import { isValidAdminToken } from '@/lib/admin-auth'
import { globalPrisma } from '@/lib/prisma-tenant'
import { decrypt } from '@/lib/crypto'
import { inspectToken } from '@/lib/wa-token'

/**
 * Saúde dos tokens do WhatsApp de TODOS os tenants conectados.
 * Uso: /api/admin/token-health?token=<ADMIN_API_SECRET>
 * Pergunta à Meta validade/tipo/vencimento de cada token e grava no tenant
 * (whatsapp_token_type, whatsapp_token_expires_at, whatsapp_needs_reconnect).
 */
export async function GET(req: Request) {
  if (!isValidAdminToken(new URL(req.url).searchParams.get('token'))) {
    return Response.json({ error: 'Token inválido' }, { status: 401 })
  }
  const tenants = await globalPrisma.tenant.findMany({
    where: { whatsapp_connected: true, whatsapp_token: { not: null } },
    select: { id: true, name: true, email: true, whatsapp_token: true }
  })

  const results = []
  for (const t of tenants) {
    let info
    try {
      info = await inspectToken(decrypt(t.whatsapp_token!))
    } catch {
      info = { valid: false, type: null, expires_at: null, error: 'não foi possível descriptografar o token' }
    }
    await globalPrisma.tenant.update({
      where: { id: t.id },
      data: {
        whatsapp_token_type: info.type,
        whatsapp_token_expires_at: info.expires_at,
        whatsapp_needs_reconnect: !info.valid
      }
    }).catch(() => {})
    const days = info.expires_at ? Math.round((info.expires_at.getTime() - Date.now()) / 86400000) : null
    results.push({
      tenant: t.name,
      email: t.email,
      valido: info.valid,
      tipo: info.type,
      vence: info.expires_at ? `${info.expires_at.toISOString().slice(0, 10)} (${days} dias)` : 'não expira',
      situacao: !info.valid
        ? '❌ RECONECTAR AGORA'
        : info.expires_at
          ? (days! < 15 ? '⚠️ vence em breve — reconectar com token permanente' : '⚠️ expira — trocar por token permanente')
          : '✅ ok',
      erro: info.error
    })
  }
  return Response.json({ total: results.length, tenants: results })
}
