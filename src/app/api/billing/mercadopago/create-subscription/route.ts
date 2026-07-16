export const dynamic = 'force-dynamic'

import { globalPrisma } from '@/lib/prisma-tenant'

export async function POST(req: Request) {
  try {
  const { MercadoPagoConfig, PreApproval } = await import('mercadopago')
  const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! })

  const { tenantId, couponCode, billing, plan: rawPlan, cardTokenId, payerEmail, payerDocType, payerDocNumber, installments, paymentMethodId, issuerId } = await req.json()
  const plan = ['pro', 'promaster'].includes(rawPlan) ? rawPlan : 'basic'

  const saasConfig = await globalPrisma.saasConfig.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton' },
    update: {}
  })

  const monthlyPrice = plan === 'promaster'
    ? Number(saasConfig.price_promaster)
    : plan === 'pro'
      ? Number(saasConfig.price_pro)
      : Number(saasConfig.price_basic)
  const planLabel = plan === 'promaster' ? 'Promaster' : plan === 'pro' ? 'Pro' : 'Básico'
  const BASE_PRICE = billing === 'annual'
    ? Math.round(monthlyPrice * 12 * (1 - saasConfig.annual_discount / 100))
    : monthlyPrice

  const tenant = await globalPrisma.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant) {
    return Response.json({ error: 'Tenant not found' }, { status: 404 })
  }

  // Registra o plano escolhido para o provisionamento refletir corretamente
  await globalPrisma.tenant.update({ where: { id: tenantId }, data: { plan } })

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

  // ── Plano ANUAL: pagamento único parcelado em até 12x (sem assinatura) ──
  // O mensal segue como assinatura recorrente (PreApproval) mais abaixo.
  if (billing === 'annual' && cardTokenId) {
    const { Payment } = await import('mercadopago')
    const payment = new Payment(client)
    const cleanDoc = payerDocNumber ? payerDocNumber.replace(/\D/g, '') : undefined
    let result: any
    try {
      result = await payment.create({
        body: {
          transaction_amount: finalPrice, // valor anual (já com desconto/cupom)
          token: cardTokenId,
          installments: Math.min(12, Math.max(1, Number(installments) || 12)),
          payment_method_id: paymentMethodId,
          ...(issuerId ? { issuer_id: Number(issuerId) } : {}),
          description: `UProCRM — Plano ${planLabel} Anual (12x)`,
          external_reference: tenantId,
          payer: {
            email: payerEmail || tenant.email,
            ...(payerDocType && cleanDoc ? { identification: { type: payerDocType, number: cleanDoc } } : {})
          }
        }
      })
    } catch (err: any) {
      const errMsg = err?.message || String(err)
      console.error('[MP annual payment error]', errMsg, err?.cause ? String(err.cause) : '')
      return Response.json({ error: errMsg || 'Erro ao processar o pagamento anual' }, { status: 500 })
    }

    const status = (result as any).status
    console.log('[MP annual payment]', JSON.stringify({ status, id: (result as any).id, detail: (result as any).status_detail }))
    // approved → ativa via webhook (payment). in_process/pending → idem. rejected → erro.
    if (['approved', 'in_process', 'pending', 'authorized'].includes(status)) {
      return Response.json({ success: true, status, final_price: finalPrice })
    }
    return Response.json({
      error: `Pagamento não aprovado (${(result as any).status_detail || status}). Verifique os dados do cartão.`,
      status
    }, { status: 422 })
  }

  const preApproval = new PreApproval(client)

  // Transparent checkout: cardTokenId provided → create subscription directly
  if (cardTokenId) {
    // Sanitize doc number (remove formatting)
    const cleanDoc = payerDocNumber ? payerDocNumber.replace(/\D/g, '') : undefined

    let result: any
    try {
      result = await preApproval.create({
        body: {
          reason: billing === 'annual' ? 'UProCRM — Plano Anual' : 'UProCRM — Plano Mensal',
          payer_email: payerEmail || tenant.email,
          external_reference: tenantId,
          card_token_id: cardTokenId,
          status: 'authorized',
          back_url: `${process.env.NEXT_PUBLIC_URL}/onboarding?tenant=${tenantId}`,
          auto_recurring: {
            frequency: billing === 'annual' ? 12 : 1,
            frequency_type: 'months',
            transaction_amount: finalPrice,
            currency_id: 'BRL'
          },
          ...(payerDocType && cleanDoc ? {
            payer: {
              email: payerEmail || tenant.email,
              identification: { type: payerDocType, number: cleanDoc }
            }
          } : {})
        }
      })
    } catch (err: any) {
      const errMsg = err?.message || String(err)
      const errCause = err?.cause ? String(err.cause) : undefined
      console.error('[MP preapproval error]', errMsg, errCause)
      return Response.json({ error: errMsg || 'Erro ao criar assinatura' }, { status: 500 })
    }

    const status = (result as any).status
    console.log('[MP preapproval result]', JSON.stringify({ status, id: (result as any).id, init_point: (result as any).init_point }))
    if (status === 'authorized' || status === 'pending') {
      return Response.json({ success: true, status, final_price: finalPrice })
    }
    // MP may return init_point even for transparent checkout in some cases
    if ((result as any).init_point) {
      return Response.json({ init_point: (result as any).init_point, final_price: finalPrice })
    }
    return Response.json({ error: `Pagamento não autorizado (status: ${status}). Verifique os dados do cartão.`, status }, { status: 422 })
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
  } catch (err: any) {
    const errMsg = err?.message || String(err)
    console.error('[create-subscription unhandled]', errMsg, err?.stack)
    return Response.json({ error: errMsg || 'Erro interno' }, { status: 500 })
  }
}
