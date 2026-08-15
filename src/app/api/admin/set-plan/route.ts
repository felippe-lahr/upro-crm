export const dynamic = 'force-dynamic'

import { isValidAdminToken } from '@/lib/admin-auth'
import { globalPrisma } from '@/lib/prisma-tenant'

const ALLOWED_PLANS = ['trial', 'basic', 'pro', 'promaster']

/**
 * Ajuste manual de plano de um tenant (uso administrativo/testes).
 * Uso: /api/admin/set-plan?token=<NEXTAUTH_SECRET>&email=<email>&plan=promaster
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  const email = url.searchParams.get('email')
  const plan = (url.searchParams.get('plan') || '').toLowerCase()

  if (!isValidAdminToken(token)) {
    return Response.json({ error: 'Token inválido' }, { status: 401 })
  }
  if (!email) return Response.json({ error: 'Informe ?email=' }, { status: 400 })
  if (!ALLOWED_PLANS.includes(plan)) {
    return Response.json({ error: `Plano inválido. Use um de: ${ALLOWED_PLANS.join(', ')}` }, { status: 400 })
  }

  const tenant = await globalPrisma.tenant.findUnique({ where: { email } })
  if (!tenant) return Response.json({ error: 'Tenant não encontrado para esse email' }, { status: 404 })

  const updated = await globalPrisma.tenant.update({
    where: { id: tenant.id },
    data: { plan },
    select: { id: true, email: true, plan: true, status: true }
  })

  return Response.json({ ok: true, message: `Plano atualizado para ${plan}.`, tenant: updated })
}
