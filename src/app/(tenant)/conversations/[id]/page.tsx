import { auth } from '@/lib/auth'
import { getTenantPrisma } from '@/lib/prisma-tenant'
import Link from 'next/link'
import { ConversationThread } from '@/components/ui/conversation-thread'

export default async function ConversationPage({
  params
}: {
  params: { id: string }
}) {
  const session = await auth()
  const schemaName = (session!.user as any).schemaName
  const contactId = params.id

  const db = getTenantPrisma(schemaName)

  const contact = await db.contact.findUnique({ where: { id: contactId } })
  if (!contact) {
    return (
      <div className="p-8">
        <p className="text-muted">Contato não encontrado.</p>
        <Link href="/conversations" className="text-green-400">← Voltar</Link>
      </div>
    )
  }

  const [messages, conversation, quickReplies] = await Promise.all([
    db.message.findMany({
      where: { contact_id: contactId },
      orderBy: { timestamp: 'asc' },
      take: 200
    }),
    db.conversation.findFirst({
      where: { contact_id: contactId },
      orderBy: { created_at: 'desc' }
    }),
    db.quickReply.findMany({ orderBy: { shortcut: 'asc' } })
  ])

  return (
    <ConversationThread
      contact={{
        id: contact.id,
        name: contact.name,
        phone: contact.phone,
        email: contact.email,
        notes: contact.notes,
        ai_summary: contact.ai_summary,
        tags: contact.tags || [],
        stage: contact.stage,
        deal_value: contact.deal_value ? String(contact.deal_value) : null
      }}
      messages={messages.map((m: any) => ({
        id: m.id,
        direction: m.direction,
        content: m.content,
        sent_by_bot: m.sent_by_bot,
        timestamp: m.timestamp.toISOString()
      }))}
      conversationStatus={conversation?.status || 'open'}
      quickReplies={quickReplies.map((q: any) => ({ shortcut: q.shortcut, content: q.content }))}
    />
  )
}
