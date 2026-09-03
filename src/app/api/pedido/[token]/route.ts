export const dynamic = 'force-dynamic'

import { globalPrisma, getTenantPrisma } from '@/lib/prisma-tenant'
import { generateOrderPdf, type OrderItem } from '@/lib/order-pdf'

/**
 * Serve o PDF do resumo de pedido por um token opaco. Público por design (o link
 * é enviado ao cliente pelo WhatsApp e usado pelo vendedor no CRM); o token é
 * imprevisível e só expõe o próprio pedido. Gerado sob demanda (sem armazenar o PDF).
 */
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const token = (params?.token || '').replace(/[^a-zA-Z0-9]/g, '')
  if (!token) return new Response('Not found', { status: 404 })

  const ref = await globalPrisma.orderRef.findUnique({ where: { token } }).catch(() => null)
  if (!ref) return new Response('Not found', { status: 404 })

  const tenant = await globalPrisma.tenant.findUnique({
    where: { id: ref.tenant_id },
    select: { name: true }
  }).catch(() => null)

  const db = getTenantPrisma(ref.schema_name)
  const order = await db.order.findUnique({ where: { id: ref.order_id } }).catch(() => null)
  if (!order) return new Response('Not found', { status: 404 })

  const items = (Array.isArray(order.items) ? order.items : []) as unknown as OrderItem[]

  const pdf = await generateOrderPdf({
    businessName: tenant?.name || 'Pedido',
    orderId: order.id,
    createdAt: order.created_at,
    customerName: order.customer_name,
    customerPhone: order.customer_phone,
    items,
    total: Number(order.total),
    notes: order.notes
  })

  return new Response(Buffer.from(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="pedido-${order.id.slice(0, 8)}.pdf"`,
      'Cache-Control': 'private, max-age=60'
    }
  })
}
