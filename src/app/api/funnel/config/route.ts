export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { globalPrisma } from '@/lib/prisma-tenant'
import { STAGE_IDS } from '@/lib/funnel'

export async function PATCH(req: Request) {
  const session = await auth()
  const tenantId = (session?.user as any)?.tenantId
  if (!tenantId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Personalização do funil é exclusiva do plano Pro.
  const tenant = await globalPrisma.tenant.findUnique({ where: { id: tenantId }, select: { plan: true } })
  if (tenant?.plan !== 'pro') {
    return Response.json({ error: 'A personalização do funil está disponível apenas no plano Pro.' }, { status: 403 })
  }

  const { funnel_labels, loss_reasons } = await req.json()
  const data: any = {}

  if (funnel_labels !== undefined) {
    const clean: Record<string, string> = {}
    if (funnel_labels && typeof funnel_labels === 'object') {
      for (const id of STAGE_IDS) {
        const v = funnel_labels[id]
        if (typeof v === 'string' && v.trim()) clean[id] = v.trim().slice(0, 40)
      }
    }
    data.funnel_labels = clean
  }

  if (loss_reasons !== undefined) {
    const clean = (Array.isArray(loss_reasons) ? loss_reasons : [])
      .filter((r: any) => typeof r === 'string' && r.trim())
      .map((r: string) => r.trim().slice(0, 120))
      .slice(0, 10)
    data.loss_reasons = clean
  }

  if (Object.keys(data).length === 0) return Response.json({ error: 'Nada para atualizar' }, { status: 400 })
  await globalPrisma.tenant.update({ where: { id: tenantId }, data })
  return Response.json({ ok: true })
}
