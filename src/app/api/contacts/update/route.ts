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

  const { contactId, notes, tags, stage, deal_value, name } = await req.json()
  if (!contactId) {
    return Response.json({ error: 'contactId obrigatório' }, { status: 400 })
  }

  const data: Record<string, unknown> = {}
  if (typeof notes === 'string') data.notes = notes
  if (Array.isArray(tags)) data.tags = tags.map((t: unknown) => String(t))
  if (typeof name === 'string') data.name = name
  if (typeof stage === 'string' && STAGE_IDS.includes(stage)) data.stage = stage
  if (deal_value !== undefined) data.deal_value = deal_value === null ? null : Number(deal_value)

  if (Object.keys(data).length === 0) {
    return Response.json({ error: 'Nada para atualizar' }, { status: 400 })
  }

  try {
    const db = getTenantPrisma(schemaName)
    await db.contact.update({ where: { id: contactId }, data })
    return Response.json({ ok: true })
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'Erro ao atualizar' },
      { status: 500 }
    )
  }
}
