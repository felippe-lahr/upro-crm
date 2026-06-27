import { globalPrisma } from './prisma-tenant'

/**
 * Gera (ou garante) a comissão de um afiliado para um pagamento de cliente indicado.
 * Idempotente por (afiliado, tenant, mês) — não duplica se o webhook reenviar.
 *
 * @param tenantId    tenant que pagou
 * @param baseAmount  valor pago naquele ciclo (base da comissão)
 * @param when        data do pagamento (define o mês de referência)
 */
export async function generateAffiliateCommission(tenantId: string, baseAmount: number, when: Date = new Date()) {
  try {
    const tenant = await globalPrisma.tenant.findUnique({
      where: { id: tenantId },
      select: { referred_by: true }
    })
    if (!tenant?.referred_by) return

    const affiliate = await globalPrisma.affiliate.findUnique({ where: { id: tenant.referred_by } })
    if (!affiliate || affiliate.status !== 'active') return

    // Política de recorrência
    const priorCount = await globalPrisma.affiliateCommission.count({
      where: { affiliate_id: affiliate.id, tenant_id: tenantId }
    })
    if (affiliate.recurrence === 'first' && priorCount >= 1) return
    if (affiliate.recurrence === '12m' && priorCount >= 12) return

    const value = Number(affiliate.commission_value)
    const computed = affiliate.commission_type === 'percent'
      ? Math.round((baseAmount * value) / 100 * 100) / 100
      : value

    const referenceMonth = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}`

    await globalPrisma.affiliateCommission.upsert({
      where: {
        affiliate_id_tenant_id_reference_month: {
          affiliate_id: affiliate.id,
          tenant_id: tenantId,
          reference_month: referenceMonth
        }
      },
      create: {
        affiliate_id: affiliate.id,
        tenant_id: tenantId,
        amount: computed,
        base_amount: baseAmount,
        reference_month: referenceMonth,
        status: 'pending'
      },
      update: {} // já existe a comissão do mês → não duplica
    })
  } catch (err) {
    console.error('[generateAffiliateCommission] failed', err)
  }
}
