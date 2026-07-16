export const dynamic = 'force-dynamic'

import { globalPrisma } from '@/lib/prisma-tenant'
import { auth } from '@/lib/auth'

async function requireSuperadmin() {
  const session = await auth()
  return (session?.user as any)?.role === 'superadmin'
}

export async function GET() {
  const config = await globalPrisma.saasConfig.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton' },
    update: {}
  })
  // Preço nunca pode ser cacheado (navegador/PWA/CDN) — sempre valor atual.
  return Response.json(config, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' }
  })
}

export async function PATCH(req: Request) {
  if (!(await requireSuperadmin())) {
    return Response.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { price_basic, price_pro, price_promaster, annual_discount } = await req.json()

  const config = await globalPrisma.saasConfig.upsert({
    where: { id: 'singleton' },
    create: {
      id: 'singleton',
      price_basic: price_basic ?? 97,
      price_pro: price_pro ?? 197,
      price_promaster: price_promaster ?? 297,
      annual_discount: annual_discount ?? 20
    },
    update: {
      ...(price_basic !== undefined && { price_basic }),
      ...(price_pro !== undefined && { price_pro }),
      ...(price_promaster !== undefined && { price_promaster }),
      ...(annual_discount !== undefined && { annual_discount })
    }
  })

  return Response.json(config)
}
