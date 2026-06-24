import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { SignOutButton } from '@/components/ui/sign-out-button'

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

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-100 flex flex-col">
        <div className="p-6 border-b border-gray-100">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">W</span>
            </div>
            <span className="font-bold text-gray-900">WaCRM</span>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <NavItem href="/dashboard" icon="📊" label="Dashboard" />
          <NavItem href="/funnel" icon="🗂️" label="Funil de Vendas" />
          <NavItem href="/conversations" icon="💬" label="Conversas" />
          <NavItem href="/contacts" icon="👥" label="Contatos" />
          <NavItem href="/settings" icon="⚙️" label="Configurações" />
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">
              {session.user.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">
                {session.user.name}
              </div>
              <div className="text-xs text-gray-400 truncate">{session.user.email}</div>
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
  icon,
  label
}: {
  href: string
  icon: string
  label: string
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-50 hover:text-gray-900 text-sm transition-colors"
    >
      <span>{icon}</span>
      <span>{label}</span>
    </Link>
  )
}
