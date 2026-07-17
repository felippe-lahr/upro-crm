export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { getTenantPrisma } from '@/lib/prisma-tenant'

/**
 * Número de conversas (= contatos) não vistas: têm mensagem recebida mais nova
 * do que a última vez que o atendente abriu a conversa. Usado pelo badge ao vivo.
 */
export async function GET() {
  const session = await auth()
  const schemaName = (session?.user as any)?.schemaName
  if (!schemaName) return Response.json({ unread: 0 })

  try {
    const db = getTenantPrisma(schemaName)
    const rows: { count: bigint }[] = await db.$queryRaw`
      SELECT COUNT(*)::bigint AS count
      FROM contacts c
      WHERE EXISTS (
        SELECT 1 FROM messages m
        WHERE m.contact_id = c.id
          AND m.direction = 'inbound'
          AND m.timestamp > COALESCE(c.last_read_at, to_timestamp(0))
      )`
    return Response.json({ unread: Number(rows?.[0]?.count ?? 0) })
  } catch {
    return Response.json({ unread: 0 })
  }
}
