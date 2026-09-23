export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { getTenantPrisma } from '@/lib/prisma-tenant'

/**
 * Etiquetagem em lote de contatos existentes.
 * POST { contactIds: string[], tag: string, action?: 'add' | 'remove' }
 * O schema vem SEMPRE da sessão (nunca do cliente).
 */
export async function POST(req: Request) {
  const session = await auth()
  const schemaName = (session?.user as any)?.schemaName
  if (!schemaName) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { contactIds, tag, action } = await req.json().catch(() => ({}))
  const ids = Array.isArray(contactIds) ? contactIds.map((x: any) => String(x)).filter(Boolean) : []
  const cleanTag = typeof tag === 'string' ? tag.trim().slice(0, 40) : ''
  const remove = action === 'remove'

  if (!ids.length) return Response.json({ error: 'Selecione ao menos um contato.' }, { status: 400 })
  if (!cleanTag) return Response.json({ error: 'Informe a etiqueta.' }, { status: 400 })

  const db = getTenantPrisma(schemaName)
  try {
    const affected = remove
      ? await db.$executeRawUnsafe(
          `UPDATE contacts SET tags = array_remove(tags, $1) WHERE id = ANY($2::uuid[])`,
          cleanTag, ids
        )
      : await db.$executeRawUnsafe(
          `UPDATE contacts SET tags = array_append(tags, $1) WHERE id = ANY($2::uuid[]) AND NOT ($1 = ANY(tags))`,
          cleanTag, ids
        )
    return Response.json({ ok: true, affected: Number(affected) || 0, tag: cleanTag, action: remove ? 'remove' : 'add' })
  } catch (e: any) {
    return Response.json({ error: e?.message || 'Falha ao etiquetar' }, { status: 500 })
  }
}
