import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { globalPrisma } from '@/lib/prisma-tenant'
import { CouponsPanel } from './coupons-panel'
import { PricingPanel } from './pricing-panel'
import { AffiliatesPanel } from './affiliates-panel'

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
          <div className="w-7 h-7 bg-brand rounded-md flex items-center justify-center">
            <span className="text-white font-bold text-xs">UP</span>
          </div>
          <span className="font-bold text-white">UProCRM Admin</span>
        </div>
        <span className="text-xs text-faint">Painel do SaaS</span>
      </div>

      <div className="p-8 space-y-8">
        <h1 className="text-2xl font-bold text-white">Dashboard Admin</h1>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'MRR', value: `R$ ${stats.mrr.toLocaleString('pt-BR')}`, color: 'text-brand' },
            { label: 'Total tenants', value: stats.total, color: 'text-white' },
            { label: 'Ativos', value: stats.active, color: 'text-brand' },
            { label: 'Pendentes', value: stats.pending, color: 'text-yellow-400' },
            { label: 'WA conectado', value: stats.connected, color: 'text-white' }
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
          annual_discount: saasConfig.annual_discount
        }} />

        {/* Cupons */}
        <CouponsPanel initialCoupons={coupons as any[]} />

        {/* Afiliados */}
        <AffiliatesPanel baseUrl={process.env.NEXT_PUBLIC_URL || 'https://uprocrm.com.br'} />

        {/* Tenants table */}
        <div className="rounded-2xl border border-line bg-surface overflow-hidden">
          <div className="px-6 py-4 border-b border-line">
            <h2 className="font-semibold text-white">Todos os tenants</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line">
                  {['Empresa', 'Email', 'Plano', 'Status', 'WhatsApp', 'Criado em'].map((h) => (
                    <th key={h} className="text-left text-xs font-medium text-faint uppercase tracking-wider px-6 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1b222c]">
                {tenants.map((t: any) => (
                  <tr key={t.id} className="hover:bg-surface2 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-white">{t.name}</td>
                    <td className="px-6 py-4 text-sm text-muted">{t.email}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                        t.plan === 'pro' ? 'bg-purple-500/20 text-purple-400' :
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
