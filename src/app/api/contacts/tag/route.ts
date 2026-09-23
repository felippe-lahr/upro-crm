export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { getTenantPrisma, globalPrisma } from '@/lib/prisma-tenant'

/**
 * Etiquetagem em lote de contatos existentes.
 * POST { contactIds: string[], tag: string, action?: 'add' | 'remove' }
 * O schema vem SEMPRE da sessão (nunca do cliente).
 */
export async function POST(req: Request) {
  const session = await auth()
  const schemaName = (session?.user as any)?.schemaName
  const tenantId = (session?.user as any)?.tenantId
  if (!schemaName || !tenantId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

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

    // Ao ADICIONAR, registra a etiqueta na taxonomia do tenant (lead_tags) para
    // que ela apareça nas Configurações e nos dropdowns — se ainda não existir.
    let taxonomy_added = false
    if (!remove) {
      const t = await globalPrisma.tenant.findUnique({ where: { id: tenantId }, select: { lead_tags: true } })
      const current = (t?.lead_tags as string[]) || []
      if (!current.includes(cleanTag)) {
        await globalPrisma.tenant.update({
          where: { id: tenantId },
          data: { lead_tags: [...current, cleanTag].slice(0, 100) }
        }).catch(() => {})
        taxonomy_added = true
      }
    }

    return Response.json({ ok: true, affected: Number(affected) || 0, tag: cleanTag, action: remove ? 'remove' : 'add', taxonomy_added })
  } catch (e: any) {
    return Response.json({ error: e?.message || 'Falha ao etiquetar' }, { status: 500 })
  }
}
