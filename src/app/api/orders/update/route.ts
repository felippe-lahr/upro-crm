export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { getTenantPrisma, globalPrisma } from '@/lib/prisma-tenant'

const ALLOWED = ['novo', 'em_separacao', 'concluido', 'cancelado']

/**
 * Atualiza o status de um pedido. O schema vem SEMPRE da sessão (nunca do cliente).
 * Requer o recurso feature_orders liberado para o tenant.
 */
export async function POST(req: Request) {
  const session = await auth()
  const tenantId = (session?.user as any)?.tenantId
  const schemaName = (session?.user as any)?.schemaName
  if (!tenantId || !schemaName) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const t = await globalPrisma.tenant.findUnique({ where: { id: tenantId }, select: { feature_orders: true } })
  if (!t?.feature_orders) return Response.json({ error: 'Recurso não liberado' }, { status: 403 })

  const { orderId, status } = await req.json().catch(() => ({}))
  if (!orderId || !ALLOWED.includes(status)) {
    return Response.json({ error: 'Parâmetros inválidos' }, { status: 400 })
  }

  try {
    const db = getTenantPrisma(schemaName)
    await db.order.update({ where: { id: orderId }, data: { status } })
    return Response.json({ ok: true })
  } catch {
    return Response.json({ error: 'Pedido não encontrado' }, { status: 404 })
  }
}
