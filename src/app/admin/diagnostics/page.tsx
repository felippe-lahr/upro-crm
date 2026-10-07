import { auth } from '@/lib/auth'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { globalPrisma } from '@/lib/prisma-tenant'
import { DiagnosticsPanel } from './diagnostics-panel'

export default async function DiagnosticsPage() {
  const session = await auth()
  if ((session?.user as any)?.role !== 'superadmin') redirect('/login')

  const tenants = await globalPrisma.tenant.findMany({
    orderBy: { name: 'asc' },
    select: { name: true, email: true, plan: true, whatsapp_connected: true, whatsapp_needs_reconnect: true }
  })

  return (
    <div className="min-h-screen bg-background">
      <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-4 sm:px-8">
        <span className="font-bold text-fg">UProCRM Admin · Diagnósticos</span>
        <Link href="/admin" className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm text-muted hover:border-brand/40 hover:text-brand">
          <ArrowLeft className="h-4 w-4" /> Voltar ao admin
        </Link>
      </div>
      <div className="mx-auto max-w-5xl p-4 sm:p-8">
        <h1 className="text-2xl font-bold text-fg">Diagnósticos</h1>
        <p className="mt-1 text-sm text-muted">
          Verificações e correções que antes eram feitas por URL. Usam o seu login de superadmin — nenhuma chave na URL.
        </p>
        <DiagnosticsPanel tenants={tenants} />
      </div>
    </div>
  )
}
