export const dynamic = 'force-dynamic'

import { MercadoPagoConfig, PreApproval } from 'mercadopago'
import { globalPrisma } from '@/lib/prisma-tenant'

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!
})

export async function POST(req: Request) {
  const { tenantId } = await req.json()

  const tenant = await globalPrisma.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant) {
    return Response.json({ error: 'Tenant not found' }, { status: 404 })
  }

  const preApproval = new PreApproval(client)
  const result = await preApproval.create({
    body: {
      preapproval_plan_id: process.env.MP_PLAN_ID,
      payer_email: tenant.email,
      external_reference: tenantId,
      back_url: `${process.env.NEXT_PUBLIC_URL}/onboarding?tenant=${tenantId}`
    }
  })

  return Response.json({ init_point: result.init_point })
}
