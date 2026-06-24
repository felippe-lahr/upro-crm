export const dynamic = 'force-dynamic'

import Stripe from 'stripe'
import { provisionTenant } from '@/lib/provision-tenant'
import { globalPrisma } from '@/lib/prisma-tenant'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(req: Request) {
  const rawBody = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return new Response('Invalid signature', { status: 400 })
  }

  const tenantId =
    (event.data.object as any).metadata?.tenantId ||
    (event.data.object as any).client_reference_id

  if (!tenantId) return Response.json({ ok: true })

  switch (event.type) {
    case 'checkout.session.completed':
      await provisionTenant(tenantId)
      break

    case 'customer.subscription.deleted':
      await globalPrisma.tenant.update({
        where: { id: tenantId },
        data: { status: 'cancelled' }
      })
      break

    case 'customer.subscription.paused':
      await globalPrisma.tenant.update({
        where: { id: tenantId },
        data: { status: 'suspended' }
      })
      break

    case 'customer.subscription.resumed':
      await globalPrisma.tenant.update({
        where: { id: tenantId },
        data: { status: 'active' }
      })
      break
  }

  return Response.json({ ok: true })
}
