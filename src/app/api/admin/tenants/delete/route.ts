export const dynamic = 'force-dynamic'

import { globalPrisma } from '@/lib/prisma-tenant'
import { auth } from '@/lib/auth'

export async function POST(req: Request) {
  const session = await auth()
  if ((session?.user as any)?.role !== 'superadmin') {
    return Response.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { tenantId } = await req.json()
  if (!tenantId) return Response.json({ error: 'tenantId obrigatório' }, { status: 400 })

  const tenant = await globalPrisma.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant) return Response.json({ error: 'Tenant não encontrado' }, { status: 404 })

  // Não permite excluir o tenant do sistema (superadmin)
  if (tenant.slug === 'system' || tenant.schema_name === 'tenant_system') {
    return Response.json({ error: 'Não é possível excluir o tenant do sistema' }, { status: 400 })
  }

  try {
    // Remove o schema dedicado do tenant (todas as conversas/mensagens)
    if (tenant.schema_name) {
      await globalPrisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${tenant.schema_name}" CASCADE`)
    }
    // Comissões de afiliado referentes a este tenant
    await globalPrisma.affiliateCommission.deleteMany({ where: { tenant_id: tenantId } })
    // Tenant (TenantUsers caem em cascata)
    await globalPrisma.tenant.delete({ where: { id: tenantId } })
    return Response.json({ ok: true })
  } catch (e) {
    console.error('[tenant delete] failed', e)
    return Response.json({ error: e instanceof Error ? e.message : 'Erro ao excluir' }, { status: 500 })
  }
}
