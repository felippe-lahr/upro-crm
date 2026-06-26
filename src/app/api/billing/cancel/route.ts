export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { globalPrisma } from '@/lib/prisma-tenant'

export async function POST() {
  try {
    const session = await auth()
    const tenantId = (session?.user as any)?.tenantId
    if (!tenantId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tenant = await globalPrisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, mp_subscription_id: true }
    })

    if (!tenant) {
      return Response.json({ error: 'Tenant not found' }, { status: 404 })
    }

    // Cancel the subscription at Mercado Pago (stops future charges)
    if (tenant.mp_subscription_id) {
      const { MercadoPagoConfig, PreApproval } = await import('mercadopago')
      const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! })
      const preApproval = new PreApproval(client)

      try {
        await preApproval.update({
          id: tenant.mp_subscription_id,
          body: { status: 'cancelled' }
        })
      } catch (err: any) {
        console.error('[billing cancel] MP error', err?.message || String(err))
        return Response.json(
          { error: 'Não foi possível cancelar a assinatura no Mercado Pago. Tente novamente.' },
          { status: 502 }
        )
      }
    }

    // Mark tenant as cancelled locally
    await globalPrisma.tenant.update({
      where: { id: tenantId },
      data: { status: 'cancelled' }
    })

    return Response.json({ ok: true })
  } catch (err: any) {
    console.error('[billing cancel] unhandled', err?.message || String(err))
    return Response.json({ error: 'Erro interno' }, { status: 500 })
  }
}
