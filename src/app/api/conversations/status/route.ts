export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { getTenantPrisma } from '@/lib/prisma-tenant'

const VALID = ['open', 'pending', 'closed']

export async function POST(req: Request) {
  const session = await auth()
  const schemaName = (session?.user as any)?.schemaName
  if (!schemaName) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { contactId, status } = await req.json()
  if (!contactId || !VALID.includes(status)) {
    return Response.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  const db = getTenantPrisma(schemaName)
  const existing = await db.conversation.findFirst({
    where: { contact_id: contactId },
    orderBy: { created_at: 'desc' }
  })

  if (existing) {
    await db.conversation.update({ where: { id: existing.id }, data: { status } })
  } else {
    await db.conversation.create({ data: { contact_id: contactId, status } })
  }

  return Response.json({ ok: true })
}
