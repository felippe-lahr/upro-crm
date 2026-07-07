export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { getTenantPrisma } from '@/lib/prisma-tenant'

/**
 * Lista as mensagens de um contato (para atualização em tempo real da conversa).
 * GET /api/conversations/messages?contactId=<id>
 */
export async function GET(req: Request) {
  const session = await auth()
  const schemaName = (session?.user as any)?.schemaName
  if (!schemaName) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const contactId = new URL(req.url).searchParams.get('contactId')
  if (!contactId) return Response.json({ error: 'contactId obrigatório' }, { status: 400 })

  const db = getTenantPrisma(schemaName)
  const messages = await db.message.findMany({
    where: { contact_id: contactId },
    orderBy: { timestamp: 'asc' },
    select: { id: true, direction: true, content: true, sent_by_bot: true, timestamp: true }
  })

  return Response.json({ messages })
}
