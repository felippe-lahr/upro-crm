export const dynamic = 'force-dynamic'

import { globalPrisma } from '@/lib/prisma-tenant'

export async function POST(req: Request) {
  const { code } = await req.json()

  if (!code) return Response.json({ error: 'Código inválido' }, { status: 400 })

  const coupon = await globalPrisma.coupon.findUnique({
    where: { code: code.toUpperCase() }
  })

  if (!coupon || !coupon.active) {
    return Response.json({ error: 'Cupom inválido ou inativo' }, { status: 404 })
  }

  if (coupon.expires_at && coupon.expires_at < new Date()) {
    return Response.json({ error: 'Cupom expirado' }, { status: 400 })
  }

  if (coupon.max_uses !== null && coupon.uses_count >= coupon.max_uses) {
    return Response.json({ error: 'Cupom esgotado' }, { status: 400 })
  }

  return Response.json({
    valid: true,
    code: coupon.code,
    discount_type: coupon.discount_type,
    discount_value: Number(coupon.discount_value),
    description: coupon.description
  })
}
