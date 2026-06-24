export const dynamic = 'force-dynamic'

import { globalPrisma } from '@/lib/prisma-tenant'
import { auth } from '@/lib/auth'

async function requireSuperadmin() {
  const session = await auth()
  if ((session?.user as any)?.role !== 'superadmin') return false
  return true
}

export async function GET() {
  if (!(await requireSuperadmin())) {
    return Response.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const coupons = await globalPrisma.coupon.findMany({ orderBy: { created_at: 'desc' } })
  return Response.json(coupons)
}

export async function POST(req: Request) {
  if (!(await requireSuperadmin())) {
    return Response.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { code, description, discount_type, discount_value, max_uses, expires_at } = await req.json()

  if (!code || !discount_value) {
    return Response.json({ error: 'Código e desconto são obrigatórios' }, { status: 400 })
  }

  const existing = await globalPrisma.coupon.findUnique({ where: { code: code.toUpperCase() } })
  if (existing) {
    return Response.json({ error: 'Código já existe' }, { status: 409 })
  }

  const coupon = await globalPrisma.coupon.create({
    data: {
      code: code.toUpperCase(),
      description,
      discount_type: discount_type || 'percent',
      discount_value,
      max_uses: max_uses || null,
      expires_at: expires_at ? new Date(expires_at) : null
    }
  })

  return Response.json(coupon)
}

export async function DELETE(req: Request) {
  if (!(await requireSuperadmin())) {
    return Response.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { id } = await req.json()
  await globalPrisma.coupon.delete({ where: { id } })
  return Response.json({ ok: true })
}
