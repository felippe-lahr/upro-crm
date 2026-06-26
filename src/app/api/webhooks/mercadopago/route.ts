export const dynamic = 'force-dynamic'

import { provisionTenant } from '@/lib/provision-tenant'
import { globalPrisma } from '@/lib/prisma-tenant'
import crypto from 'crypto'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function verifyMPSignature(req: Request, body: string): boolean {
  const xSignature = req.headers.get('x-signature')
  const xRequestId = req.headers.get('x-request-id')
  const dataId = new URL(req.url).searchParams.get('data.id') || ''

  if (!xSignature) return false

  const parts = Object.fromEntries(
    xSignature.split(',').map((p) => p.trim().split('=') as [string, string])
  )

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${parts['ts']};`
  const expected = crypto
    .createHmac('sha256', process.env.MP_WEBHOOK_SECRET || process.env.MP_ACCESS_TOKEN!)
    .update(manifest)
    .digest('hex')

  return parts['v1'] === expected
}

export async function POST(req: Request) {
  const rawBody = await req.text()
  const body = JSON.parse(rawBody)

  console.log('[MP webhook]', JSON.stringify(body))

  if (body.type === 'subscription_preapproval') {
    const subscriptionId = body.data?.id
    if (!subscriptionId) return Response.json({ ok: true })

    // Fetch full subscription details from MP (webhook only sends the ID)
    const { MercadoPagoConfig, PreApproval } = await import('mercadopago')
    const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! })
    const preApproval = new PreApproval(client)

    let subscription: any
    try {
      subscription = await preApproval.get({ preApprovalId: subscriptionId })
    } catch (err) {
      console.error('[MP webhook] failed to fetch subscription', err)
      return Response.json({ ok: true })
    }

    console.log('[MP webhook] subscription', JSON.stringify({ status: subscription.status, external_reference: subscription.external_reference }))

    const tenantId = subscription.external_reference
    if (!tenantId) return Response.json({ ok: true })

    if (subscription.status === 'authorized') {
      await globalPrisma.tenant.update({
        where: { id: tenantId },
        data: { mp_subscription_id: subscriptionId }
      })
      await provisionTenant(tenantId)
    } else if (['cancelled', 'paused'].includes(subscription.status)) {
      await globalPrisma.tenant.update({
        where: { id: tenantId },
        data: { status: subscription.status === 'paused' ? 'suspended' : 'cancelled' }
      })
    }
  }

  return Response.json({ ok: true })
}
