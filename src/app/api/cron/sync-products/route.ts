export const dynamic = 'force-dynamic'

import { globalPrisma } from '@/lib/prisma-tenant'
import { syncTenantProducts } from '@/lib/product-feed'

/**
 * Cron de sincronização do catálogo Promaster. Chamar periodicamente (ex.: de
 * hora em hora) com ?token=<CRON_SECRET>. Para cada tenant com feed configurado,
 * baixa o XML e faz upsert dos produtos no schema do tenant.
 */
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET
  const token = new URL(req.url).searchParams.get('token')
  if (!token || token !== expected) {
    return Response.json({ error: 'Token inválido' }, { status: 401 })
  }

  const tenants = await globalPrisma.tenant.findMany({
    where: { status: 'active', products_feed_url: { not: null } },
    select: { id: true, slug: true, schema_name: true, products_feed_url: true }
  })

  const results: Array<{ slug: string; ok: boolean; total?: number; error?: string }> = []
  for (const tenant of tenants) {
    if (!tenant.schema_name) continue
    try {
      const r = await syncTenantProducts(tenant)
      results.push({ slug: tenant.slug, ok: r.ok, total: r.total, error: r.error })
    } catch (e: any) {
      results.push({ slug: tenant.slug, ok: false, error: e?.message || String(e) })
    }
  }

  return Response.json({ ok: true, tenants: tenants.length, results })
}
