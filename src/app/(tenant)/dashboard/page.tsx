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

  let stats = {
    contacts: 0,
    messagesToday: 0,
    openConversations: 0,
    pipelineValue: 0,
    wonValue: 0
  }

  if (tenant?.status === 'active' && schemaName) {
    try {
      const db = getTenantPrisma(schemaName)
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)

      const [contacts, messagesToday, openConversations, pipeline, won] = await Promise.all([
        db.contact.count(),
        db.message.count({ where: { timestamp: { gte: startOfDay } } }),
        db.conversation.count({ where: { status: 'open' } }),
        db.contact.aggregate({
          _sum: { deal_value: true },
          where: { stage: { notIn: ['ganho', 'perdido'] } }
        }),
        db.contact.aggregate({
          _sum: { deal_value: true },
          where: { stage: 'ganho' }
        })
      ])
      stats = {
        contacts,
        messagesToday,
        openConversations,
        pipelineValue: Number(pipeline._sum.deal_value || 0),
        wonValue: Number(won._sum.deal_value || 0)
      }
    } catch {
      // schema not yet provisioned
    }
  }

  const trialDays = tenant?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(tenant.trial_ends_at).getTime() - Date.now()) / 86400000))
    : 0

  const brl = (n: number) =>
    n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-fg">
          Bem-vindo, {String(user?.name || '').split(' ')[0]}!
        </h1>
        <p className="mt-1 text-sm text-muted">{tenant?.name}</p>
      </div>

      {/* Alerts */}
      {!tenant?.whatsapp_connected && (
        <div className="mb-6 flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <div>
            <p className="text-sm font-medium text-amber-400">WhatsApp não conectado</p>
            <p className="mt-0.5 text-xs text-amber-500/80">
              Conecte seu número para começar a receber mensagens
            </p>
          </div>
          <Link
            href="/onboarding/connect-whatsapp"
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600"
          >
            Conectar agora
          </Link>
        </div>
      )}

      {tenant?.plan === 'trial' && trialDays > 0 && (
        <div className="mb-6 rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
          <p className="text-sm text-blue-300">
            <strong>Trial:</strong> {trialDays} dia{trialDays !== 1 ? 's' : ''} restante{trialDays !== 1 ? 's' : ''}.
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        <StatCard label="Contatos" value={String(stats.contacts)} icon="👥" />
        <StatCard label="Mensagens hoje" value={String(stats.messagesToday)} icon="💬" />
        <StatCard label="Conversas abertas" value={String(stats.openConversations)} icon="🔔" />
        <StatCard label="Em negociação" value={brl(stats.pipelineValue)} icon="📈" accent />
        <StatCard label="Fechado (ganho)" value={brl(stats.wonValue)} icon="🏆" accent />
      </div>

      {/* Quick actions */}
      <div className="rounded-2xl border border-line bg-surface p-6">
        <h2 className="mb-4 font-semibold text-fg">Ações rápidas</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <QuickAction href="/conversations" icon="💬" label="Ver conversas" />
          <QuickAction href="/funnel" icon="🗂️" label="Funil de vendas" />
          <QuickAction href="/broadcasts" icon="📣" label="Novo disparo" />
          <QuickAction href="/settings" icon="🤖" label="Configurar bot" />
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
  accent
}: {
  label: string
  value: string
  icon: string
  accent?: boolean
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-6">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm text-muted">{label}</span>
        <span className="text-2xl">{icon}</span>
      </div>
      <div className={`text-3xl font-bold ${accent ? 'text-brand' : 'text-fg'}`}>
        {value}
      </div>
    </div>
  )
}

function QuickAction({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 rounded-xl bg-surface2 p-4 text-center transition-colors hover:bg-line"
    >
      <span className="text-2xl">{icon}</span>
      <span className="text-sm text-fg">{label}</span>
    </Link>
  )
}
