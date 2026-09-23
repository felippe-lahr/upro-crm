import { auth } from '@/lib/auth'
import { getTenantPrisma } from '@/lib/prisma-tenant'
import Link from 'next/link'
import { ConversationsList, type ConversationItem } from '@/components/ui/conversations-list'

export default async function ConversationsPage() {
  const session = await auth()
  const schemaName = (session!.user as any).schemaName

  // Uma linha por conversa (contato): a ÚLTIMA mensagem de cada contato, ordenada
  // pela atividade mais recente. Antes a lista pegava as últimas 400 MENSAGENS e
  // agrupava — o que escondia conversas antigas (só apareciam os contatos das 400
  // mensagens recentes) e quebrava os filtros de período. Aqui o DISTINCT ON pega
  // o último de CADA contato, cobrindo todas as conversas (com um teto de segurança).
  const CONVERSATION_CAP = 2000
  let lastRows: {
    contact_id: string
    content: string | null
    direction: string
    ts: Date
    name: string | null
    phone: string
    tags: string[]
  }[] = []
  const unreadByContact = new Map<string, number>()

  if (schemaName) {
    const db = getTenantPrisma(schemaName)
    try {
      lastRows = await db.$queryRawUnsafe(`
        SELECT t.contact_id, t.content, t.direction, t.ts, t.name, t.phone, t.tags
        FROM (
          SELECT DISTINCT ON (m.contact_id)
            m.contact_id, m.content, m.direction, m.timestamp AS ts,
            c.name, c.phone, c.tags
          FROM messages m
          JOIN contacts c ON c.id = m.contact_id
          ORDER BY m.contact_id, m.timestamp DESC
        ) t
        ORDER BY t.ts DESC
        LIMIT ${CONVERSATION_CAP}
      `)
    } catch {
      // schema not provisioned
    }
    try {
      // Não vistas por conversa: mensagens recebidas depois da última abertura.
      const rows: { contact_id: string; unread: number }[] = await db.$queryRawUnsafe(`
        SELECT m.contact_id, COUNT(*)::int AS unread
        FROM messages m
        JOIN contacts c ON c.id = m.contact_id
        WHERE m.direction = 'inbound'
          AND m.timestamp > COALESCE(c.last_read_at, to_timestamp(0))
        GROUP BY m.contact_id
      `)
      for (const r of rows) unreadByContact.set(r.contact_id, Number(r.unread) || 0)
    } catch {
      // coluna last_read_at ainda não migrada — trata tudo como visto (não quebra a lista)
    }
  }

  const conversations: ConversationItem[] = lastRows.map((r) => ({
    contactId: r.contact_id,
    name: r.name,
    phone: r.phone,
    tags: r.tags || [],
    lastContent: r.content,
    lastDirection: r.direction,
    lastTimestamp: new Date(r.ts).toISOString(),
    unread: unreadByContact.get(r.contact_id) ?? 0
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
