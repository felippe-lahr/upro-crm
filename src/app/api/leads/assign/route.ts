export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { getTenantPrisma, globalPrisma } from '@/lib/prisma-tenant'

/**
 * Atribui (ou solta) o responsável de um lead.
 * POST { contactId, userId: string | null }
 *
 * Regras:
 * - Admin: atribui a qualquer pessoa da equipe ou remove o responsável.
 * - Atendente: pode PUXAR para si um lead sem responsável e SOLTAR um lead que é seu.
 *   Não pode tirar o lead de outra pessoa (isso é com o admin).
 * A conta vem sempre da sessão.
 */
export async function POST(req: Request) {
  const session = await auth()
  const u = session?.user as any
  const tenantId = u?.tenantId as string | undefined
  const schemaName = u?.schemaName as string | undefined
  const me = u?.id as string | undefined
  if (!tenantId || !schemaName || !me) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const isAdmin = ['admin', 'superadmin'].includes(u?.role)

  const body = await req.json().catch(() => ({}))
  const contactId = String(body.contactId || '')
  const userId: string | null = body.userId ? String(body.userId) : null
  if (!contactId) return Response.json({ error: 'Lead inválido.' }, { status: 400 })

  // O responsável precisa ser da mesma conta.
  let assignee: { id: string; name: string | null; email: string } | null = null
  if (userId) {
    assignee = await globalPrisma.tenantUser.findFirst({
      where: { id: userId, tenant_id: tenantId },
      select: { id: true, name: true, email: true }
    })
    if (!assignee) return Response.json({ error: 'Essa pessoa não faz parte da equipe.' }, { status: 400 })
  }

  const db = getTenantPrisma(schemaName)
  const data = { assigned_to: userId, assigned_at: userId ? new Date() : null }

  if (isAdmin) {
    const r = await db.contact.updateMany({ where: { id: contactId }, data })
    if (!r.count) return Response.json({ error: 'Lead não encontrado.' }, { status: 404 })
    return Response.json({ ok: true, assigned_to: userId })
  }

  // Atendente: só para si mesmo (puxar) ou soltar o que é seu.
  if (userId && userId !== me) {
    return Response.json({ error: 'Só o administrador pode passar um lead para outra pessoa.' }, { status: 403 })
  }
  // Atualização condicional evita que dois atendentes puxem o mesmo lead ao mesmo tempo.
  const where = userId
    ? { id: contactId, OR: [{ assigned_to: null }, { assigned_to: me }] }
    : { id: contactId, assigned_to: me }
  const r = await db.contact.updateMany({ where, data })
  if (!r.count) {
    return Response.json(
      { error: userId ? 'Outra pessoa já assumiu este lead. Atualize a página.' : 'Este lead não está com você.' },
      { status: 409 }
    )
  }
  return Response.json({ ok: true, assigned_to: userId })
}
