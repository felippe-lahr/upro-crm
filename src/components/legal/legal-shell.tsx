import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

// Dados da empresa detentora (controladora) — usados nas páginas legais.
export const COMPANY = {
  legalName: 'Studio44 Vendas e Marketing No Digital LTDA',
  tradeName: 'S44 Digital',
  cnpj: '23.192.161/0001-20',
  product: 'UProCRM',
  email: 'contato@uprocrm.com.br',
  site: 'uprocrm.com.br',
  updated: '4 de julho de 2026'
}

export function LegalShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-fg">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="UProCRM" className="h-8 w-8 rounded-lg" />
            <span className="font-bold">UProCRM</span>
          </Link>
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-brand">
            <ArrowLeft className="h-4 w-4" /> Voltar ao site
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted">Última atualização: {COMPANY.updated}</p>
        <div className="legal mt-8 space-y-6 text-[15px] leading-relaxed text-muted">
          {children}
        </div>
      </main>

      <footer className="border-t border-line py-8">
        <div className="mx-auto max-w-3xl px-6 text-sm text-faint">
          <p>{COMPANY.product} é operado por {COMPANY.legalName} ({COMPANY.tradeName}) — CNPJ {COMPANY.cnpj}.</p>
          <div className="mt-2 flex gap-4">
            <Link href="/privacidade" className="hover:text-brand">Privacidade</Link>
            <Link href="/termos" className="hover:text-brand">Termos</Link>
            <a href={`mailto:${COMPANY.email}`} className="hover:text-brand">{COMPANY.email}</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

// Título de seção padronizado.
export function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-8 text-xl font-semibold text-fg">{children}</h2>
}
