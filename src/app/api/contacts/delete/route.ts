export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { getTenantPrisma } from '@/lib/prisma-tenant'

export async function POST(req: Request) {
  const session = await auth()
  const schemaName = (session?.user as any)?.schemaName
  if (!schemaName) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { contactId } = await req.json()
  if (!contactId) {
    return Response.json({ error: 'contactId obrigatório' }, { status: 400 })
  }

  try {
    const db = getTenantPrisma(schemaName)
    // Mensagens e conversas são removidas em cascata (onDelete: Cascade)
    await db.contact.delete({ where: { id: contactId } })
    return Response.json({ ok: true })
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'Erro ao excluir' },
      { status: 500 }
    )
  }
}
