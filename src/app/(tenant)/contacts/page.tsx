import { auth } from '@/lib/auth'
import { getTenantPrisma } from '@/lib/prisma-tenant'
import Link from 'next/link'
import { ImportContacts } from '@/components/ui/import-contacts'

export default async function ContactsPage() {
  const session = await auth()
  const schemaName = (session!.user as any).schemaName

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

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-fg">Contatos</h1>
          <p className="mt-1 text-sm text-muted">
            {contacts.length} contato{contacts.length !== 1 ? 's' : ''}
          </p>
        </div>
        <ImportContacts />
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
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="border-b border-line bg-surface2">
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-faint">Nome</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-faint">Telefone</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-faint">Etiquetas</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-faint">Desde</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {contacts.map((c) => (
                <tr key={c.id} className="transition-colors hover:bg-surface2">
                  <td className="px-6 py-4">
                    <Link href={`/conversations/${c.id}`} className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/15 text-sm font-medium text-brand">
                        {(c.name || c.phone)[0].toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-fg">
                        {c.name || 'Sem nome'}
                      </span>
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted">{c.phone}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {(c.tags || []).map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-brand/15 px-2 py-0.5 text-xs text-brand"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-faint">
                    {new Date(c.created_at).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
