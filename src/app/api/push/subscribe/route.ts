export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { globalPrisma } from '@/lib/prisma-tenant'

// Salva (ou atualiza) a inscrição push do dispositivo do usuário logado.
export async function POST(req: Request) {
  const session = await auth()
  const user = session?.user as any
  if (!user?.tenantId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const sub = await req.json().catch(() => null)
  const endpoint = sub?.endpoint
  const p256dh = sub?.keys?.p256dh
  const authKey = sub?.keys?.auth
  if (!endpoint || !p256dh || !authKey) {
    return Response.json({ error: 'Inscrição inválida' }, { status: 400 })
  }

  await globalPrisma.pushSubscription.upsert({
    where: { endpoint },
    create: { endpoint, p256dh, auth: authKey, tenant_id: user.tenantId, user_email: user.email || '' },
    update: { p256dh, auth: authKey, tenant_id: user.tenantId, user_email: user.email || '' }
  })

  return Response.json({ ok: true })
}
