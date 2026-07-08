import { auth } from '@/lib/auth'
import { getTenantPrisma } from '@/lib/prisma-tenant'
import Link from 'next/link'
import { ConversationsList, type ConversationItem } from '@/components/ui/conversations-list'

export default async function ConversationsPage() {
  const session = await auth()
  const schemaName = (session!.user as any).schemaName

  let messages: {
    id: string
    contact_id: string
    content: string | null
    direction: string
    timestamp: Date
    contact: { name: string | null; phone: string; tags: string[] }
  }[] = []

  if (schemaName) {
    try {
      const db = getTenantPrisma(schemaName)
      messages = await db.message.findMany({
        include: { contact: { select: { name: true, phone: true, tags: true } } },
        orderBy: { timestamp: 'desc' },
        take: 400
      })
    } catch {
      // schema not provisioned
    }
  }

  const grouped = messages.reduce<Record<string, typeof messages>>((acc, m) => {
    if (!acc[m.contact_id]) acc[m.contact_id] = []
    acc[m.contact_id].push(m)
    return acc
  }, {})

  const conversations: ConversationItem[] = Object.entries(grouped).map(([contactId, msgs]) => ({
    contactId,
    name: msgs[0].contact.name,
    phone: msgs[0].contact.phone,
    tags: msgs[0].contact.tags || [],
    lastContent: msgs[0].content,
    lastDirection: msgs[0].direction,
    lastTimestamp: msgs[0].timestamp.toISOString(),
    unread: msgs.filter((m) => m.direction === 'inbound').length
  }))

  const allTags = Array.from(new Set(conversations.flatMap((c) => c.tags))).sort()

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-fg">Conversas</h1>
      </div>

      {conversations.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface p-16 text-center">
          <div className="mb-4 text-5xl">💬</div>
          <h2 className="mb-2 text-lg font-semibold text-fg">Nenhuma conversa ainda</h2>
          <p className="text-sm text-muted">
            As conversas aparecem aqui quando você receber mensagens no WhatsApp.
          </p>
          {!schemaName && (
            <Link
              href="/onboarding/connect-whatsapp"
              className="mt-4 inline-block rounded-xl bg-brand px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600"
            >
              Conectar WhatsApp
            </Link>
          )}
        </div>
      ) : (
        <ConversationsList conversations={conversations} allTags={allTags} />
      )}
    </div>
  )
}
