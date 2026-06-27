export const dynamic = 'force-dynamic'

import { globalPrisma } from '@/lib/prisma-tenant'
import { auth } from '@/lib/auth'

async function requireSuperadmin() {
  const session = await auth()
  return (session?.user as any)?.role === 'superadmin'
}

export async function GET(req: Request) {
  if (!(await requireSuperadmin())) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const affiliateId = new URL(req.url).searchParams.get('affiliate_id')
  const commissions = await globalPrisma.affiliateCommission.findMany({
    where: affiliateId ? { affiliate_id: affiliateId } : {},
    orderBy: { created_at: 'desc' },
    take: 200
  })

  // Resolve nomes dos tenants
  const tenantIds = Array.from(new Set(commissions.map((c: any) => c.tenant_id)))
  const tenants = await globalPrisma.tenant.findMany({
    where: { id: { in: tenantIds } },
    select: { id: true, name: true }
  })
  const nameById = Object.fromEntries(tenants.map((t: any) => [t.id, t.name]))

  return Response.json(commissions.map((c: any) => ({
    id: c.id,
    tenant: nameById[c.tenant_id] || '—',
    amount: Number(c.amount),
    base_amount: Number(c.base_amount),
    reference_month: c.reference_month,
    status: c.status,
    created_at: c.created_at
  })))
}

// Marca comissões como pagas (por afiliado, ou ids específicos)
export async function PATCH(req: Request) {
  if (!(await requireSuperadmin())) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const { ids, affiliate_id } = await req.json()
  if (Array.isArray(ids) && ids.length) {
    await globalPrisma.affiliateCommission.updateMany({ where: { id: { in: ids } }, data: { status: 'paid' } })
  } else if (affiliate_id) {
    await globalPrisma.affiliateCommission.updateMany({ where: { affiliate_id, status: 'pending' }, data: { status: 'paid' } })
  } else {
    return Response.json({ error: 'Informe ids ou affiliate_id' }, { status: 400 })
  }
  return Response.json({ ok: true })
}
