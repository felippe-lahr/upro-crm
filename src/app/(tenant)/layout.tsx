import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard, KanbanSquare, MessageSquare, Users, Megaphone, Settings, ShieldCheck,
  CalendarDays, type LucideIcon
} from 'lucide-react'
import { SignOutButton } from '@/components/ui/sign-out-button'
import { ThemeToggle } from '@/components/ui/theme-toggle'
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
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col border-r border-line bg-sidebar">
        <div className="border-b border-line p-6">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="UProCRM" className="h-8 w-8 rounded-lg" />
            <span className="font-bold tracking-tight text-fg">UProCRM</span>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          <NavItem href="/dashboard" icon={LayoutDashboard} label="Dashboard" />
          <NavItem href="/funnel" icon={KanbanSquare} label="Funil de Vendas" />
          <NavItem href="/conversations" icon={MessageSquare} label="Conversas" badge={unread} />
          <NavItem href="/agenda" icon={CalendarDays} label="Agenda" />
          <NavItem href="/contacts" icon={Users} label="Contatos" />
          <NavItem href="/broadcasts" icon={Megaphone} label="Disparos" />
          <NavItem href="/settings" icon={Settings} label="Configurações" />

          {(session.user as any).role === 'superadmin' && (
            <>
              <div className="my-2 border-t border-line" />
              <NavItem href="/admin" icon={ShieldCheck} label="Admin" />
            </>
          )}
        </nav>

        <div className="border-t border-line p-4">
          <ThemeToggle />
          <div className="mt-2 flex items-center gap-3 px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface2 text-sm font-medium text-muted">
              {session.user.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-fg">
                {session.user.name}
              </div>
              <div className="truncate text-xs text-faint">{session.user.email}</div>
            </div>
          </div>
          <SignOutButton />
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}

function NavItem({
  href,
  icon: Icon,
  label,
  badge
}: {
  href: string
  icon: LucideIcon
  label: string
  badge?: number
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-brand/5 hover:text-brand"
    >
      <Icon className="h-[18px] w-[18px]" />
      <span className="flex-1">{label}</span>
      {badge && badge > 0 ? (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-xs font-semibold text-white">
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
    </Link>
  )
}
