export const dynamic = 'force-dynamic'

import { globalPrisma } from '@/lib/prisma-tenant'

export async function POST(req: Request) {
  const Stripe = (await import('stripe')).default
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

  const { tenantId } = await req.json()

  const tenant = await globalPrisma.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant) {
    return Response.json({ error: 'Tenant not found' }, { status: 404 })
  }

  let customerId = tenant.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: tenant.email,
      name: tenant.name,
      metadata: { tenantId }
    })
    customerId = customer.id
    await globalPrisma.tenant.update({
      where: { id: tenantId },
      data: { stripe_customer_id: customerId }
    })
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    metadata: { tenantId },
    success_url: `${process.env.NEXT_PUBLIC_URL}/onboarding?tenant=${tenantId}`,
    cancel_url: `${process.env.NEXT_PUBLIC_URL}/checkout`
  })

  return Response.json({ url: session.url })
}
