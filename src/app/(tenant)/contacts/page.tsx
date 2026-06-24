import { auth } from '@/lib/auth'
import { getTenantPrisma } from '@/lib/prisma-tenant'

export default async function ContactsPage() {
  const session = await auth()
  const schemaName = (session!.user as any).schemaName

  let contacts: { id: string; name: string | null; phone: string; created_at: Date }[] = []

  if (schemaName) {
    try {
      const db = getTenantPrisma(schemaName)
      contacts = await db.contact.findMany({
        orderBy: { created_at: 'desc' },
        take: 100
      })
    } catch {
      // schema not provisioned
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contatos</h1>
          <p className="text-gray-500 text-sm mt-1">{contacts.length} contato{contacts.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {contacts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
          <div className="text-5xl mb-4">👥</div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Nenhum contato ainda</h2>
          <p className="text-gray-500 text-sm">
            Os contatos aparecem automaticamente quando alguém te envia uma mensagem no WhatsApp.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-50 bg-gray-50">
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-3">Nome</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-3">Telefone</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-3">Desde</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {contacts.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-medium text-sm">
                        {(c.name || c.phone)[0].toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {c.name || 'Sem nome'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{c.phone}</td>
                  <td className="px-6 py-4 text-sm text-gray-400">
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
