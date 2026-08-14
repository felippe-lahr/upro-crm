import { auth } from '@/lib/auth'
import { getTenantPrisma, globalPrisma } from '@/lib/prisma-tenant'
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
  if (contact) {
    // Marca a conversa como vista ao abrir (zera o badge de não vistas desta conversa).
    await db.contact.update({ where: { id: contactId }, data: { last_read_at: new Date() } }).catch(() => {})
  }
  if (!contact) {
    return (
      <div className="p-8">
        <p className="text-muted">Contato não encontrado.</p>
        <Link href="/conversations" className="text-brand">← Voltar</Link>
      </div>
    )
  }

  const tenantId = (session!.user as any).tenantId
  const [messages, conversation, quickReplies, tenant] = await Promise.all([
    db.message.findMany({
      where: { contact_id: contactId },
      orderBy: { timestamp: 'asc' },
      take: 200
    }),
    db.conversation.findFirst({
      where: { contact_id: contactId },
      orderBy: { created_at: 'desc' }
    }),
    db.quickReply.findMany({ orderBy: { shortcut: 'asc' } }),
    tenantId ? globalPrisma.tenant.findUnique({ where: { id: tenantId }, select: { lead_tags: true } }) : Promise.resolve(null)
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
        deal_value: contact.deal_value ? String(contact.deal_value) : null,
        lead_source: (contact.lead_source as any) || null
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
      availableTags={(tenant?.lead_tags as string[]) || []}
    />
  )
}
