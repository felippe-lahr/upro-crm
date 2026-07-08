export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { globalPrisma } from '@/lib/prisma-tenant'

// Remove a inscrição push do dispositivo (ao desativar notificações).
export async function POST(req: Request) {
  const session = await auth()
  if (!(session?.user as any)?.tenantId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { endpoint } = await req.json().catch(() => ({}))
  if (!endpoint) return Response.json({ error: 'endpoint obrigatório' }, { status: 400 })

  await globalPrisma.pushSubscription.deleteMany({ where: { endpoint } })
  return Response.json({ ok: true })
}
