import { auth } from '@/lib/auth'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { redirect } from 'next/navigation'
import { globalPrisma } from '@/lib/prisma-tenant'
import { CouponsPanel } from './coupons-panel'
import { PricingPanel } from './pricing-panel'
import { AffiliatesPanel } from './affiliates-panel'
import { ConfirmDelete } from './confirm-delete'
import { EditTenant } from './edit-tenant'

export default async function AdminPage() {
  const session = await auth()

  if ((session?.user as any)?.role !== 'superadmin') {
    redirect('/login')
  }

  const [tenants, coupons, saasConfig] = await Promise.all([
    globalPrisma.tenant.findMany({
      orderBy: { created_at: 'desc' },
      include: { users: { where: { role: 'admin' }, take: 1 } }
    }),
    globalPrisma.coupon.findMany({ orderBy: { created_at: 'desc' } }),
    globalPrisma.saasConfig.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton' },
      update: {}
    })
  ])

  const stats = {
    total: tenants.length,
    active: tenants.filter((t: any) => t.status === 'active').length,
    pending: tenants.filter((t: any) => t.status === 'pending_payment').length,
    connected: tenants.filter((t: any) => t.whatsapp_connected).length,
    mrr: tenants.filter((t: any) => t.status === 'active' && t.plan !== 'trial').length * 97
  }

  return (
    <div className="min-h-screen bg-background text-fg">
      <div className="border-b border-line bg-surface px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-upro-novo.png" alt="UProCRM" className="h-7 w-7 rounded-md" />
          <span className="font-bold text-fg">UProCRM Admin</span>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm text-muted transition-colors hover:border-brand/40 hover:text-brand"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar ao dashboard
        </Link>
      </div>

      <div className="p-8 space-y-8">
        <h1 className="text-2xl font-bold text-fg">Dashboard Admin</h1>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'MRR', value: `R$ ${stats.mrr.toLocaleString('pt-BR')}`, color: 'text-brand' },
            { label: 'Total tenants', value: stats.total, color: 'text-fg' },
            { label: 'Ativos', value: stats.active, color: 'text-brand' },
            { label: 'Pendentes', value: stats.pending, color: 'text-yellow-500' },
            { label: 'WA conectado', value: stats.connected, color: 'text-fg' }
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl border border-line bg-surface p-4">
              <div className="text-xs text-faint mb-1">{label}</div>
              <div className={`text-xl font-bold ${color}`}>{value}</div>
            </div>
          ))}
        </div>

        {/* Preços */}
        <PricingPanel initialConfig={{
          price_basic: Number(saasConfig.price_basic),
          price_pro: Number(saasConfig.price_pro),
          price_promaster: Number(saasConfig.price_promaster),
          annual_discount: saasConfig.annual_discount
        }} />

        {/* Cupons */}
        <CouponsPanel initialCoupons={coupons as any[]} />

        {/* Afiliados */}
        <AffiliatesPanel baseUrl={process.env.NEXT_PUBLIC_URL || 'https://uprocrm.com.br'} />

        {/* Tenants table */}
        <div className="rounded-2xl border border-line bg-surface overflow-hidden">
          <div className="px-6 py-4 border-b border-line">
            <h2 className="font-semibold text-fg">Todos os tenants</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line">
                  {['Empresa', 'Email', 'Plano', 'Status', 'WhatsApp', 'Criado em', ''].map((h) => (
                    <th key={h} className="text-left text-xs font-medium text-faint uppercase tracking-wider px-6 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {tenants.map((t: any) => (
                  <tr key={t.id} className="hover:bg-surface2 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-fg">{t.name}</td>
                    <td className="px-6 py-4 text-sm text-muted">{t.email}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                        t.plan === 'promaster' ? 'bg-amber-500/20 text-amber-600' :
                        t.plan === 'pro' ? 'bg-purple-500/20 text-purple-500' :
                        t.plan === 'basic' ? 'bg-brand/20 text-brand' :
                        'bg-surface2 text-muted'
                      }`}>
                        {t.plan}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        t.status === 'active' ? 'bg-brand/20 text-brand' :
                        t.status === 'suspended' ? 'bg-red-500/20 text-red-400' :
                        'bg-surface2 text-muted'
                      }`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        t.whatsapp_connected ? 'bg-brand/20 text-brand' : 'bg-surface2 text-muted'
                      }`}>
                        {t.whatsapp_connected ? 'Conectado' : 'Pendente'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-faint">
                      {new Date(t.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <EditTenant tenant={{ id: t.id, name: t.name, email: t.email, status: t.status, plan: t.plan, feature_summary_forward: t.feature_summary_forward }} />
                        <ConfirmDelete
                          title={`Excluir "${t.name}"?`}
                          description="O tenant, seus usuários, conversas, mensagens e o banco de dados dedicado serão apagados permanentemente."
                          endpoint="/api/admin/tenants/delete"
                          method="POST"
                          payload={{ tenantId: t.id }}
                        />
                      </div>
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
