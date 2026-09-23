import { auth } from '@/lib/auth'
import { getTenantPrisma, globalPrisma } from '@/lib/prisma-tenant'
import { ImportContacts } from '@/components/ui/import-contacts'
import { ContactsTable } from './contacts-table'

export default async function ContactsPage() {
  const session = await auth()
  const schemaName = (session!.user as any).schemaName
  const tenantId = (session!.user as any).tenantId

  let contacts: {
    id: string
    name: string | null
    phone: string
    tags: string[]
    created_at: Date
  }[] = []

  if (schemaName) {
    try {
      const db = getTenantPrisma(schemaName)
      contacts = await db.contact.findMany({
        orderBy: { created_at: 'desc' },
        take: 200
      })
    } catch {
      // schema not provisioned
    }
  }

  // Etiquetas já criadas (taxonomia do tenant) para o dropdown de etiquetagem.
  let existingTags: string[] = []
  if (tenantId) {
    try {
      const t = await globalPrisma.tenant.findUnique({ where: { id: tenantId }, select: { lead_tags: true } })
      existingTags = ((t?.lead_tags as string[]) || []).slice().sort()
    } catch { /* ignore */ }
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-fg">Contatos</h1>
          <p className="mt-1 text-sm text-muted">
            {contacts.length} contato{contacts.length !== 1 ? 's' : ''}
          </p>
        </div>
        <ImportContacts existingTags={existingTags} />
      </div>

      {contacts.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface p-16 text-center">
          <div className="mb-4 text-5xl">👥</div>
          <h2 className="mb-2 text-lg font-semibold text-fg">Nenhum contato ainda</h2>
          <p className="text-sm text-muted">
            Os contatos aparecem automaticamente quando alguém te envia uma mensagem — ou
            importe uma lista em CSV.
          </p>
        </div>
      ) : (
        <ContactsTable
          existingTags={existingTags}
          contacts={contacts.map((c) => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
            tags: c.tags || [],
            created_at: c.created_at.toISOString()
          }))}
        />
      )}
    </div>
  )
}
