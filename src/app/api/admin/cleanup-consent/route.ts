export const dynamic = 'force-dynamic'

import { isValidAdminToken } from '@/lib/admin-auth'
import { globalPrisma, getTenantPrisma } from '@/lib/prisma-tenant'

/**
 * Remove a etiqueta "consentiu" aplicada por engano (qualquer "sim" dito ao bot
 * virava consentimento). Mantém só em quem recebeu o convite de disparo.
 *
 * Simular:  /api/admin/cleanup-consent?token=<ADMIN_API_SECRET>
 * Executar: /api/admin/cleanup-consent?token=<ADMIN_API_SECRET>&run=1
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  if (!isValidAdminToken(url.searchParams.get('token'))) {
    return Response.json({ error: 'Token inválido' }, { status: 401 })
  }
  const run = url.searchParams.get('run') === '1'

  const tenants = await globalPrisma.tenant.findMany({
    where: { schema_name: { not: '' } },
    select: { slug: true, schema_name: true }
  })

  const results: Record<string, number | string> = {}
  let total = 0
  for (const t of tenants) {
    try {
      const db = getTenantPrisma(t.schema_name)
      const where = `'consentiu' = ANY(tags) AND broadcast_sent_at IS NULL`
      const rows: { n: number }[] = await db.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM contacts WHERE ${where}`)
      const n = Number(rows?.[0]?.n) || 0
      if (run && n > 0) {
        await db.$executeRawUnsafe(`UPDATE contacts SET tags = array_remove(tags, 'consentiu') WHERE ${where}`)
      }
      results[t.slug] = n
      total += n
    } catch (e: any) {
      results[t.slug] = `erro: ${(e?.message || String(e)).slice(0, 120)}`
    }
  }

  return Response.json({
    mode: run ? 'executado' : 'simulação (nada foi alterado — adicione &run=1 para aplicar)',
    total_contatos: total,
    por_tenant: results
  })
}
