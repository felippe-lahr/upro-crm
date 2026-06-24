import { auth } from '@/lib/auth'
import { globalPrisma, getTenantPrisma } from '@/lib/prisma-tenant'
import Link from 'next/link'

export default async function DashboardPage() {
  const session = await auth()
  const user = session?.user as any
  const tenantId = user?.tenantId
  const schemaName = user?.schemaName

  const tenant = await globalPrisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      name: true, plan: true, status: true,
      whatsapp_connected: true, trial_ends_at: true
    }
  })

  let stats = { contacts: 0, messages: 0, conversations: 0 }

  if (tenant?.status === 'active' && schemaName) {
    try {
      const db = getTenantPrisma(schemaName)
      const [contacts, messages, conversations]: [number, number, number] = await Promise.all([
        db.contact.count(),
        db.message.count(),
        db.conversation.count()
      ])
      stats = { contacts, messages, conversations }
    } catch {
      // schema not yet provisioned
    }
  }

  const trialDays = tenant?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(tenant.trial_ends_at).getTime() - Date.now()) / 86400000))
    : 0

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Bem-vindo, {String(user?.name || '').split(' ')[0]}!
        </h1>
        <p className="text-gray-500 text-sm mt-1">{tenant?.name}</p>
      </div>

      {/* Alerts */}
      {!tenant?.whatsapp_connected && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div>
            <p className="font-medium text-amber-800 text-sm">WhatsApp não conectado</p>
            <p className="text-amber-600 text-xs mt-0.5">
              Conecte seu número para começar a receber mensagens
            </p>
          </div>
          <Link
            href="/onboarding/connect-whatsapp"
            className="bg-amber-500 hover:bg-amber-600 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Conectar agora
          </Link>
        </div>
      )}

      {tenant?.plan === 'trial' && trialDays > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <p className="text-blue-800 text-sm">
            <strong>Trial:</strong> {trialDays} dia{trialDays !== 1 ? 's' : ''} restante{trialDays !== 1 ? 's' : ''}.
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard label="Contatos" value={stats.contacts} icon="👥" />
        <StatCard label="Mensagens" value={stats.messages} icon="💬" />
        <StatCard label="Conversas" value={stats.conversations} icon="🗂️" />
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Ações rápidas</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link
            href="/conversations"
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors text-center"
          >
            <span className="text-2xl">💬</span>
            <span className="text-sm text-gray-700">Ver conversas</span>
          </Link>
          <Link
            href="/contacts"
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors text-center"
          >
            <span className="text-2xl">👥</span>
            <span className="text-sm text-gray-700">Ver contatos</span>
          </Link>
          <Link
            href="/settings"
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors text-center"
          >
            <span className="text-2xl">🤖</span>
            <span className="text-sm text-gray-700">Configurar bot</span>
          </Link>
          <Link
            href="/onboarding/connect-whatsapp"
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors text-center"
          >
            <span className="text-2xl">🔌</span>
            <span className="text-sm text-gray-700">WhatsApp</span>
          </Link>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon
}: {
  label: string
  value: number
  icon: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-400 text-sm">{label}</span>
        <span className="text-2xl">{icon}</span>
      </div>
      <div className="text-3xl font-bold text-gray-900">{value.toLocaleString('pt-BR')}</div>
    </div>
  )
}
