export const dynamic = 'force-dynamic'

import { globalPrisma } from '@/lib/prisma-tenant'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const tenantId = searchParams.get('tenant')

  if (!tenantId) {
    return Response.json({ error: 'Missing tenant' }, { status: 400 })
  }

  const tenant = await globalPrisma.tenant.findUnique({
    where: { id: tenantId },
    select: { status: true, slug: true }
  })

  if (!tenant) {
    return Response.json({ error: 'Tenant not found' }, { status: 404 })
  }

  const active = tenant.status === 'active'
  return Response.json({ active, subdomain: active ? tenant.slug : null })
}
