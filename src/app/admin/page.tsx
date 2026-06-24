import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { globalPrisma } from '@/lib/prisma-tenant'

export default async function AdminPage() {
  const session = await auth()

  if ((session?.user as any)?.role !== 'superadmin') {
    redirect('/dashboard')
  }

  const tenants = await globalPrisma.tenant.findMany({
    orderBy: { created_at: 'desc' },
    include: { users: { where: { role: 'admin' }, take: 1 } }
  })

  const stats = {
    total: tenants.length,
    active: tenants.filter((t: any) => t.status === 'active').length,
    trial: tenants.filter((t: any) => t.plan === 'trial').length,
    connected: tenants.filter((t: any) => t.whatsapp_connected).length,
    mrr: tenants.filter((t: any) => t.status === 'active' && t.plan !== 'trial').length * 97
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-green-500 rounded-md flex items-center justify-center">
            <span className="text-white font-bold text-xs">W</span>
          </div>
          <span className="font-bold text-gray-900">WaCRM Admin</span>
        </div>
        <span className="text-xs text-gray-400">Painel do SaaS</span>
      </div>

      <div className="p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Dashboard Admin</h1>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="text-xs text-gray-400 mb-1">MRR</div>
            <div className="text-xl font-bold text-gray-900">R$ {stats.mrr.toLocaleString('pt-BR')}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="text-xs text-gray-400 mb-1">Total tenants</div>
            <div className="text-xl font-bold text-gray-900">{stats.total}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="text-xs text-gray-400 mb-1">Ativos</div>
            <div className="text-xl font-bold text-green-600">{stats.active}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="text-xs text-gray-400 mb-1">Trial</div>
            <div className="text-xl font-bold text-blue-600">{stats.trial}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="text-xs text-gray-400 mb-1">WA conectado</div>
            <div className="text-xl font-bold text-gray-900">{stats.connected}</div>
          </div>
        </div>

        {/* Tenants table */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50">
            <h2 className="font-semibold text-gray-900">Todos os tenants</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-50">
                  {['Empresa', 'Email', 'Plano', 'Status', 'WhatsApp', 'Criado em'].map((h) => (
                    <th
                      key={h}
                      className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-3"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tenants.map((t: any) => (
                  <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{t.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{t.email}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                          t.plan === 'pro'
                            ? 'bg-purple-100 text-purple-700'
                            : t.plan === 'basic'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {t.plan}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          t.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : t.status === 'suspended'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          t.whatsapp_connected
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {t.whatsapp_connected ? 'Conectado' : 'Pendente'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400">
                      {new Date(t.created_at).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
