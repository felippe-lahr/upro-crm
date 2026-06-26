export const dynamic = 'force-dynamic'

import { globalPrisma } from '@/lib/prisma-tenant'

export async function POST(req: Request) {
  const { MercadoPagoConfig, PreApproval } = await import('mercadopago')
  const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! })

  const { tenantId, couponCode, billing, cardTokenId, payerEmail, payerDocType, payerDocNumber } = await req.json()

  const saasConfig = await globalPrisma.saasConfig.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton' },
    update: {}
  })

  const monthlyPrice = Number(saasConfig.price_basic)
  const BASE_PRICE = billing === 'annual'
    ? Math.round(monthlyPrice * 12 * (1 - saasConfig.annual_discount / 100))
    : monthlyPrice

  const tenant = await globalPrisma.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant) {
    return Response.json({ error: 'Tenant not found' }, { status: 404 })
  }

  let finalPrice = BASE_PRICE

  if (couponCode) {
    const coupon = await globalPrisma.coupon.findUnique({
      where: { code: couponCode.toUpperCase() }
    })

    const valid =
      coupon &&
      coupon.active &&
      !(coupon.expires_at && coupon.expires_at < new Date()) &&
      (coupon.max_uses === null || coupon.uses_count < coupon.max_uses)

    if (valid && coupon) {
      const disc = Number(coupon.discount_value)
      finalPrice =
        coupon.discount_type === 'percent'
          ? Math.max(1, Math.round(BASE_PRICE * (1 - disc / 100)))
          : Math.max(1, BASE_PRICE - disc)

      await globalPrisma.coupon.update({
        where: { id: coupon.id },
        data: { uses_count: { increment: 1 } }
      })
    }
  }

  const preApproval = new PreApproval(client)

  // Transparent checkout: cardTokenId provided → create subscription directly
  if (cardTokenId) {
    const result = await preApproval.create({
      body: {
        reason: billing === 'annual' ? 'UProCRM — Plano Anual' : 'UProCRM — Plano Mensal',
        payer_email: payerEmail || tenant.email,
        external_reference: tenantId,
        card_token_id: cardTokenId,
        back_url: `${process.env.NEXT_PUBLIC_URL}/onboarding?tenant=${tenantId}`,
        auto_recurring: {
          frequency: billing === 'annual' ? 12 : 1,
          frequency_type: 'months',
          transaction_amount: finalPrice,
          currency_id: 'BRL'
        },
        ...(payerDocType && payerDocNumber ? {
          payer: {
            email: payerEmail || tenant.email,
            identification: { type: payerDocType, number: payerDocNumber }
          }
        } : {})
      }
    })

    const status = (result as any).status
    if (status === 'authorized' || status === 'pending') {
      return Response.json({ success: true, status, final_price: finalPrice })
    }
    return Response.json({ error: 'Pagamento não autorizado. Verifique os dados do cartão.', status }, { status: 422 })
  }

  // Fallback: redirect to MP checkout
  const result = await preApproval.create({
    body: {
      reason: billing === 'annual' ? 'UProCRM — Plano Anual' : 'UProCRM — Plano Mensal',
      payer_email: tenant.email,
      external_reference: tenantId,
      back_url: `${process.env.NEXT_PUBLIC_URL}/onboarding?tenant=${tenantId}`,
      auto_recurring: {
        frequency: billing === 'annual' ? 12 : 1,
        frequency_type: 'months',
        transaction_amount: finalPrice,
        currency_id: 'BRL'
      }
    }
  })

  return Response.json({ init_point: result.init_point, final_price: finalPrice })
}
