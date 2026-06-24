export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { getTenantPrisma } from '@/lib/prisma-tenant'
import { STAGE_IDS } from '@/lib/funnel'

export async function POST(req: Request) {
  const session = await auth()
  const schemaName = (session?.user as any)?.schemaName
  if (!schemaName) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { contactId, stage } = await req.json()

  if (!contactId || !STAGE_IDS.includes(stage)) {
    return Response.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  try {
    const db = getTenantPrisma(schemaName)
    await db.contact.update({
      where: { id: contactId },
      data: { stage }
    })
    return Response.json({ ok: true })
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Erro ao mover lead' },
      { status: 500 }
    )
  }
}
