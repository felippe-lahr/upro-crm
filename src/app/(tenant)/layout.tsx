import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/ui/app-shell'
import { getTenantPrisma } from '@/lib/prisma-tenant'

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
  let unread = 0
  if (schemaName) {
    try {
      const db = getTenantPrisma(schemaName)
      unread = await db.conversation.count({ where: { status: 'open' } })
    } catch {
      // schema not provisioned yet
    }
  }

  return (
    <AppShell
      unread={unread}
      isSuperadmin={(session.user as any).role === 'superadmin'}
      userName={session.user.name}
      userEmail={session.user.email}
    >
      {children}
    </AppShell>
  )
}
