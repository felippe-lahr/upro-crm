import { auth } from '@/lib/auth'
import { getTenantPrisma } from '@/lib/prisma-tenant'
import Link from 'next/link'

export default async function ConversationsPage() {
  const session = await auth()
  const schemaName = (session!.user as any).schemaName

  let messages: {
    id: string
    contact_id: string
    content: string | null
    direction: string
    timestamp: Date
    contact: { name: string | null; phone: string }
  }[] = []

  if (schemaName) {
    try {
      const db = getTenantPrisma(schemaName)
      messages = await db.message.findMany({
        include: { contact: { select: { name: true, phone: true } } },
        orderBy: { timestamp: 'desc' },
        take: 200
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

  const conversations = Object.entries(grouped).map(([contactId, msgs]) => ({
    contactId,
    contact: msgs[0].contact,
    lastMessage: msgs[0],
    unread: msgs.filter((m) => m.direction === 'inbound').length
  }))

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-fg">Conversas</h1>
        <p className="mt-1 text-sm text-muted">
          {conversations.length} conversa{conversations.length !== 1 ? 's' : ''}
        </p>
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
              className="mt-4 inline-block rounded-xl bg-green-500 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-green-600"
            >
              Conectar WhatsApp
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          {conversations.map((conv) => (
            <Link
              key={conv.contactId}
              href={`/conversations/${conv.contactId}`}
              className="flex items-center gap-4 border-b border-line px-6 py-4 transition-colors last:border-0 hover:bg-surface2"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-green-500/15 font-medium text-green-400">
                {(conv.contact.name || conv.contact.phone)[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-fg">
                    {conv.contact.name || conv.contact.phone}
                  </span>
                  <span className="text-xs text-faint">
                    {new Date(conv.lastMessage.timestamp).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-sm text-muted">
                  {conv.lastMessage.direction === 'outbound' && (
                    <span className="mr-1 text-green-400">↑</span>
                  )}
                  {conv.lastMessage.content || '[mídia]'}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
