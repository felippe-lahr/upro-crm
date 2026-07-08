'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, KanbanSquare, MessageSquare, Users, Megaphone, Settings, ShieldCheck,
  CalendarDays, Menu, X, type LucideIcon
} from 'lucide-react'
import { SignOutButton } from './sign-out-button'
import { ThemeToggle } from './theme-toggle'

interface NavDef {
  href: string
  icon: LucideIcon
  label: string
  badge?: number
}

/**
 * Shell responsivo do painel: sidebar fixa no desktop e drawer (hambúrguer) no
 * mobile. Recebe apenas dados serializáveis do layout (server component).
 */
export function AppShell({
  children,
  unread,
  isSuperadmin,
  userName,
  userEmail
}: {
  children: React.ReactNode
  unread: number
  isSuperadmin: boolean
  userName?: string | null
  userEmail?: string | null
}) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  const nav: NavDef[] = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/funnel', icon: KanbanSquare, label: 'Funil de Vendas' },
    { href: '/conversations', icon: MessageSquare, label: 'Conversas', badge: unread },
    { href: '/agenda', icon: CalendarDays, label: 'Agenda' },
    { href: '/contacts', icon: Users, label: 'Contatos' },
    { href: '/broadcasts', icon: Megaphone, label: 'Disparos' },
    { href: '/settings', icon: Settings, label: 'Configurações' }
  ]

  const initial = userName?.[0]?.toUpperCase() || 'U'

  const NavList = (
    <nav className="flex-1 space-y-1 overflow-y-auto p-4">
      {nav.map((item) => (
        <NavItem key={item.href} {...item} active={isActive(pathname, item.href)} onClick={() => setOpen(false)} />
      ))}
      {isSuperadmin && (
        <>
          <div className="my-2 border-t border-line" />
          <NavItem href="/admin" icon={ShieldCheck} label="Admin" active={isActive(pathname, '/admin')} onClick={() => setOpen(false)} />
        </>
      )}
    </nav>
  )

  const Footer = (
    <div className="border-t border-line p-4">
      <ThemeToggle />
      <div className="mt-2 flex items-center gap-3 px-3 py-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface2 text-sm font-medium text-muted">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-fg">{userName}</div>
          <div className="truncate text-xs text-faint">{userEmail}</div>
        </div>
      </div>
      <SignOutButton />
    </div>
  )

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-64 flex-shrink-0 flex-col border-r border-line bg-sidebar lg:flex">
        <div className="border-b border-line p-6">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="UProCRM" className="h-8 w-8 rounded-lg" />
            <span className="font-bold tracking-tight text-fg">UProCRM</span>
          </Link>
        </div>
        {NavList}
        {Footer}
      </aside>

      {/* Drawer (mobile) */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col border-r border-line bg-sidebar shadow-xl">
            <div className="flex items-center justify-between border-b border-line p-4">
              <Link href="/dashboard" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.svg" alt="UProCRM" className="h-8 w-8 rounded-lg" />
                <span className="font-bold tracking-tight text-fg">UProCRM</span>
              </Link>
              <button onClick={() => setOpen(false)} className="rounded-lg p-2 text-muted hover:bg-brand/5 hover:text-brand" aria-label="Fechar menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            {NavList}
            {Footer}
          </aside>
        </div>
      )}

      {/* Conteúdo */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar (mobile) */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-surface px-4 py-3 lg:hidden">
          <button onClick={() => setOpen(true)} className="rounded-lg p-1.5 text-fg hover:bg-brand/5" aria-label="Abrir menu">
            <Menu className="h-6 w-6" />
          </button>
          <Link href="/dashboard" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="UProCRM" className="h-7 w-7 rounded-lg" />
            <span className="font-bold tracking-tight text-fg">UProCRM</span>
          </Link>
          {unread > 0 && (
            <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-xs font-semibold text-white">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </header>

        <main className="min-w-0 flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false
  return pathname === href || pathname.startsWith(href + '/')
}

function NavItem({
  href,
  icon: Icon,
  label,
  badge,
  active,
  onClick
}: NavDef & { active?: boolean; onClick?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
        active ? 'bg-brand/10 text-brand' : 'text-muted hover:bg-brand/5 hover:text-brand'
      }`}
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
