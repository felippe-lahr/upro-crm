export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { getTenantPrisma, globalPrisma } from '@/lib/prisma-tenant'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { OrderStatus, OrderPdfLink } from './order-actions'

const money = (n: number) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface OrderItem { nome: string; quantidade: number; preco_unit: number; subtotal: number }

export default async function OrdersPage() {
  const session = await auth()
  const schemaName = (session!.user as any).schemaName
  const tenantId = (session!.user as any).tenantId

  // Guard: página só existe quando o recurso está liberado pelo admin.
  const t = tenantId
    ? await globalPrisma.tenant.findUnique({ where: { id: tenantId }, select: { feature_orders: true } }).catch(() => null)
    : null
  if (!t?.feature_orders) redirect('/dashboard')

  let orders: {
    id: string
    contact_id: string | null
    customer_name: string | null
    customer_phone: string | null
    items: unknown
    total: any
    notes: string | null
    status: string
    public_token: string
    created_at: Date
  }[] = []

  if (schemaName) {
    try {
      const db = getTenantPrisma(schemaName)
      orders = await db.order.findMany({ orderBy: { created_at: 'desc' }, take: 200 }) as any
    } catch { /* schema not provisioned */ }
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-fg">Pedidos</h1>
        <p className="mt-1 text-sm text-muted">
          {orders.length} pedido{orders.length !== 1 ? 's' : ''} — resumos montados pelo atendimento por WhatsApp.
        </p>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface p-16 text-center">
          <div className="mb-4 text-5xl">🧾</div>
          <h2 className="mb-2 text-lg font-semibold text-fg">Nenhum pedido ainda</h2>
          <p className="mx-auto max-w-md text-sm text-muted">
            Quando um cliente montar um pedido pelo atendimento, ele aparece aqui com o resumo
            e o PDF. Nenhuma venda é concluída — é um resumo para você dar sequência.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => {
            const items = (Array.isArray(o.items) ? o.items : []) as unknown as OrderItem[]
            return (
              <div key={o.id} className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-fg">
                        {o.customer_name || o.customer_phone || 'Cliente'}
                      </span>
                      {o.contact_id && (
                        <Link href={`/conversations/${o.contact_id}`} className="text-xs text-brand hover:underline">
                          abrir conversa
                        </Link>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-faint">
                      {o.customer_phone ? `${o.customer_phone} · ` : ''}
                      {new Date(o.created_at).toLocaleString('pt-BR', {
                        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                      {' · '}Nº {o.id.slice(0, 8).toUpperCase()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <OrderStatus orderId={o.id} status={o.status} />
                    <OrderPdfLink token={o.public_token} />
                  </div>
                </div>

                <div className="mt-3 overflow-x-auto rounded-lg border border-line">
                  <table className="w-full min-w-[420px] text-sm">
                    <thead>
                      <tr className="border-b border-line bg-surface2 text-xs uppercase tracking-wider text-faint">
                        <th className="px-3 py-2 text-left">Qtd</th>
                        <th className="px-3 py-2 text-left">Produto</th>
                        <th className="px-3 py-2 text-right">Unitário</th>
                        <th className="px-3 py-2 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {items.map((it, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 text-muted">{it.quantidade}</td>
                          <td className="px-3 py-2 text-fg">{it.nome}</td>
                          <td className="px-3 py-2 text-right text-muted">{money(it.preco_unit)}</td>
                          <td className="px-3 py-2 text-right text-fg">{money(it.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-line">
                        <td colSpan={3} className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-faint">Total</td>
                        <td className="px-3 py-2 text-right font-bold text-brand">{money(Number(o.total))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {o.notes && (
                  <p className="mt-2 text-xs text-muted"><span className="font-medium text-fg">Obs.:</span> {o.notes}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
