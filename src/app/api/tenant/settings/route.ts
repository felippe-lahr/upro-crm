export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { globalPrisma } from '@/lib/prisma-tenant'

export async function GET() {
  const session = await auth()
  if (!(session?.user as any)?.tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId = (session!.user as any).tenantId
  const tenant = await globalPrisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true, name: true, email: true, plan: true, status: true,
      whatsapp_connected: true, phone_number_id: true, waba_id: true,
      bot_enabled: true, bot_prompt: true, trial_ends_at: true
    }
  })

  return Response.json(tenant)
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!(session?.user as any)?.tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId = (session!.user as any).tenantId
  const { bot_enabled, bot_prompt } = await req.json()

  const updated = await globalPrisma.tenant.update({
    where: { id: tenantId },
    data: {
      ...(bot_enabled !== undefined && { bot_enabled }),
      ...(bot_prompt !== undefined && { bot_prompt })
    },
    select: { id: true, bot_enabled: true, bot_prompt: true }
  })

  return Response.json(updated)
}
