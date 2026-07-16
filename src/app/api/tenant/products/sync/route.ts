export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { globalPrisma } from '@/lib/prisma-tenant'
import { syncTenantProducts } from '@/lib/product-feed'

/** Dispara a sincronização do catálogo do tenant sob demanda (botão "Sincronizar agora"). */
export async function POST() {
  const session = await auth()
  const tenantId = (session?.user as any)?.tenantId
  if (!tenantId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await globalPrisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, plan: true, schema_name: true, products_feed_url: true }
  })
  if (!tenant) return Response.json({ error: 'Tenant não encontrado' }, { status: 404 })
  if (tenant.plan !== 'promaster') {
    return Response.json({ error: 'O catálogo de produtos está disponível apenas no plano Promaster.' }, { status: 403 })
  }
  if (!tenant.products_feed_url) {
    return Response.json({ error: 'Configure a URL do feed de produtos primeiro.' }, { status: 400 })
  }

  const result = await syncTenantProducts(tenant)
  const status = result.ok ? 200 : 400
  return Response.json(result, { status })
}
