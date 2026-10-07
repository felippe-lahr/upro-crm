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
  let waNeedsReconnect = false
  let waExpiresSoon: Date | null = null
  if (tenantId) {
    try {
      const t = await globalPrisma.tenant.findUnique({
        where: { id: tenantId },
        select: { feature_orders: true, whatsapp_needs_reconnect: true, whatsapp_token_expires_at: true, whatsapp_connected: true }
      })
      ordersEnabled = !!t?.feature_orders
      waNeedsReconnect = !!t?.whatsapp_needs_reconnect
      const exp = t?.whatsapp_connected ? t?.whatsapp_token_expires_at : null
      if (exp && exp.getTime() - Date.now() < 10 * 24 * 60 * 60 * 1000) waExpiresSoon = exp
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
      {(waNeedsReconnect || waExpiresSoon) && (
        <div className="m-4 mb-0 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm sm:mx-8 sm:mt-6">
          <p className="font-semibold text-red-500">
            {waNeedsReconnect ? 'Seu WhatsApp está desconectado — o bot não consegue responder' : 'A conexão do seu WhatsApp vence em breve'}
          </p>
          <p className="mt-1 text-xs text-muted">
            {waNeedsReconnect
              ? 'A Meta recusou o acesso desta conta (token expirado ou revogado). Reconecte o WhatsApp em Configurações para o atendimento voltar.'
              : `O acesso vence em ${waExpiresSoon!.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}. Reconecte em Configurações para não interromper o atendimento.`}
          </p>
          <a href="/settings" className="mt-2 inline-block rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600">
            Ir para Configurações
          </a>
        </div>
      )}
      {children}
    </AppShell>
  )
}
