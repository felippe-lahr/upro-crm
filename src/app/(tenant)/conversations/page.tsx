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
        take: 50
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
        <h1 className="text-2xl font-bold text-gray-900">Conversas</h1>
        <p className="text-gray-500 text-sm mt-1">{conversations.length} conversa{conversations.length !== 1 ? 's' : ''}</p>
      </div>

      {conversations.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
          <div className="text-5xl mb-4">💬</div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Nenhuma conversa ainda</h2>
          <p className="text-gray-500 text-sm">
            As conversas aparecem aqui quando você receber mensagens no WhatsApp.
          </p>
          {!schemaName && (
            <Link
              href="/onboarding/connect-whatsapp"
              className="inline-block mt-4 bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-xl text-sm font-medium transition-colors"
            >
              Conectar WhatsApp
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {conversations.map((conv) => (
            <div
              key={conv.contactId}
              className="flex items-center gap-4 px-6 py-4 border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-medium flex-shrink-0">
                {(conv.contact.name || conv.contact.phone)[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 text-sm">
                    {conv.contact.name || conv.contact.phone}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(conv.lastMessage.timestamp).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
                <p className="text-sm text-gray-500 truncate mt-0.5">
                  {conv.lastMessage.direction === 'outbound' && (
                    <span className="text-green-500 mr-1">↑</span>
                  )}
                  {conv.lastMessage.content || '[mídia]'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
