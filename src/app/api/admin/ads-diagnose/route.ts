export const dynamic = 'force-dynamic'

import { isValidAdminToken } from '@/lib/admin-auth'
import { globalPrisma } from '@/lib/prisma-tenant'

/**
 * Diagnóstico do rastreamento Google Ads.
 * Uso: /api/admin/ads-diagnose?token=<NEXTAUTH_SECRET>
 * Mostra os últimos cliques (AdClick) capturados pelo /r/wa: se estão sendo
 * salvos, com qual gclid e se já foram casados com uma 1ª mensagem (matched_at).
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  if (!isValidAdminToken(token)) {
    return Response.json({ error: 'Token inválido' }, { status: 401 })
  }

  const code = url.searchParams.get('code')
  if (code) {
    const one = await globalPrisma.adClick.findUnique({ where: { code } }).catch(() => null)
    return Response.json({ found: !!one, click: one })
  }

  const recent = await globalPrisma.adClick.findMany({
    orderBy: { created_at: 'desc' },
    take: 20
  }).catch(() => [])

  return Response.json({
    total_recent: recent.length,
    hint: 'matched_at != null significa que a 1ª mensagem com #GAD:<code> chegou e o lead foi etiquetado.',
    clicks: recent
  })
}
