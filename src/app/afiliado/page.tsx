import { redirect } from 'next/navigation'
import { getAffiliateId } from '@/lib/affiliate-auth'
import { globalPrisma } from '@/lib/prisma-tenant'
import { DashboardHeader } from './dashboard-header'

export const dynamic = 'force-dynamic'

const RECUR_LABEL: Record<string, string> = { lifetime: 'vitalícia', '12m': '12 meses', first: '1ª venda' }

export default async function AffiliateDashboard() {
  const affiliateId = getAffiliateId()
  if (!affiliateId) redirect('/afiliado/login')

  const affiliate = await globalPrisma.affiliate.findUnique({ where: { id: affiliateId } })
  if (!affiliate) redirect('/afiliado/login')

  const [referred, commissions] = await Promise.all([
    globalPrisma.tenant.findMany({
      where: { referred_by: affiliateId },
      select: { name: true, status: true, plan: true, created_at: true },
      orderBy: { created_at: 'desc' }
    }),
    globalPrisma.affiliateCommission.findMany({
      where: { affiliate_id: affiliateId },
      orderBy: { created_at: 'desc' },
      take: 100
    })
  ])

  const tenantNames = await globalPrisma.tenant.findMany({
    where: { id: { in: Array.from(new Set(commissions.map((c: any) => c.tenant_id))) } },
    select: { id: true, name: true }
  })
  const nameById: Record<string, string> = Object.fromEntries(tenantNames.map((t: any) => [t.id, t.name]))

  const pending = commissions.filter((c: any) => c.status === 'pending').reduce((s: number, c: any) => s + Number(c.amount), 0)
  const paid = commissions.filter((c: any) => c.status === 'paid').reduce((s: number, c: any) => s + Number(c.amount), 0)
  const activeCount = referred.filter((t: any) => t.status === 'active').length

  const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://uprocrm.com.br'
  const link = `${baseUrl}/?ref=${affiliate.code}`

  const brl = (n: number) => `R$ ${n.toFixed(2).replace('.', ',')}`

  return (
    <div className="min-h-screen bg-background text-fg">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <DashboardHeader name={affiliate.name} link={link} />

        {/* Stats */}
        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Indicados" value={String(referred.length)} />
          <Stat label="Clientes ativos" value={String(activeCount)} />
          <Stat label="A receber" value={brl(pending)} highlight />
          <Stat label="Total recebido" value={brl(paid)} />
        </div>

        {/* Comissão configurada */}
        <div className="mt-4 rounded-xl border border-line bg-surface px-5 py-3 text-sm text-muted">
          Sua comissão: <strong className="text-fg">
            {affiliate.commission_type === 'percent' ? `${Number(affiliate.commission_value)}%` : brl(Number(affiliate.commission_value))}
          </strong> por venda · recorrência <strong className="text-fg">{RECUR_LABEL[affiliate.recurrence]}</strong>
          {affiliate.pix_key && <> · Pix: <strong className="text-fg">{affiliate.pix_key}</strong></>}
        </div>

        {/* Indicados */}
        <section className="mt-8">
          <h2 className="mb-3 font-semibold">Seus indicados</h2>
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            {referred.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-muted">
                Você ainda não tem indicados. Compartilhe seu link para começar.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-line text-xs uppercase tracking-wider text-faint">
                  <th className="px-5 py-3 text-left">Cliente</th><th className="text-left">Plano</th><th className="text-left">Status</th><th className="px-5 text-right">Desde</th>
                </tr></thead>
                <tbody className="divide-y divide-line">
                  {referred.map((t: any, i: number) => (
                    <tr key={i}>
                      <td className="px-5 py-3 font-medium">{t.name}</td>
                      <td className="capitalize text-muted">{t.plan}</td>
                      <td>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${t.status === 'active' ? 'bg-brand/15 text-brand' : 'bg-surface2 text-muted'}`}>
                          {t.status === 'active' ? 'Ativo' : t.status === 'pending_payment' ? 'Aguardando' : t.status}
                        </span>
                      </td>
                      <td className="px-5 text-right text-faint">{new Date(t.created_at).toLocaleDateString('pt-BR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Comissões */}
        <section className="mt-8">
          <h2 className="mb-3 font-semibold">Histórico de comissões</h2>
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            {commissions.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-muted">Nenhuma comissão registrada ainda.</div>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-line text-xs uppercase tracking-wider text-faint">
                  <th className="px-5 py-3 text-left">Cliente</th><th className="text-left">Mês</th><th className="text-right">Valor</th><th className="px-5 text-right">Status</th>
                </tr></thead>
                <tbody className="divide-y divide-line">
                  {commissions.map((c: any) => (
                    <tr key={c.id}>
                      <td className="px-5 py-3 font-medium">{nameById[c.tenant_id] || '—'}</td>
                      <td className="text-muted">{c.reference_month}</td>
                      <td className="text-right font-medium">{brl(Number(c.amount))}</td>
                      <td className="px-5 text-right">
                        <span className={c.status === 'paid' ? 'text-brand' : 'text-yellow-500'}>{c.status === 'paid' ? 'Pago' : 'Pendente'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="text-xs text-faint">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${highlight ? 'text-brand' : 'text-fg'}`}>{value}</div>
    </div>
  )
}
