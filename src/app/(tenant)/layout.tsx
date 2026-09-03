import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/ui/app-shell'
import { getTenantPrisma, globalPrisma } from '@/lib/prisma-tenant'

export default async function TenantLayout({
  children
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  const tenantStatus = (session.user as any).tenantStatus
  if (tenantStatus === 'pending_payment') {
    redirect('/checkout')
  }

  const schemaName = (session.user as any).schemaName
  const tenantId = (session.user as any).tenantId
  let ordersEnabled = false
  if (tenantId) {
    try {
      const t = await globalPrisma.tenant.findUnique({ where: { id: tenantId }, select: { feature_orders: true } })
      ordersEnabled = !!t?.feature_orders
    } catch { /* ignore */ }
  }
  let unread = 0
  if (schemaName) {
    try {
      const db = getTenantPrisma(schemaName)
      // Conversas (= contatos) com mensagem recebida mais nova do que a última vez
      // que o atendente abriu a conversa. Conta conversas, não mensagens.
      const rows: { count: bigint }[] = await db.$queryRaw`
        SELECT COUNT(*)::bigint AS count
        FROM contacts c
        WHERE EXISTS (
          SELECT 1 FROM messages m
          WHERE m.contact_id = c.id
            AND m.direction = 'inbound'
            AND m.timestamp > COALESCE(c.last_read_at, to_timestamp(0))
        )`
      unread = Number(rows?.[0]?.count ?? 0)
    } catch {
      // schema not provisioned yet
    }
  }

  return (
    <AppShell
      unread={unread}
      ordersEnabled={ordersEnabled}
      isSuperadmin={(session.user as any).role === 'superadmin'}
      userName={session.user.name}
      userEmail={session.user.email}
    >
      {children}
    </AppShell>
  )
}
