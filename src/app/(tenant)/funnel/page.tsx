import { auth } from '@/lib/auth'
import { getTenantPrisma } from '@/lib/prisma-tenant'
import { KanbanBoard, type LeadCard } from '@/components/ui/kanban-board'

export default async function FunnelPage() {
  const session = await auth()
  const schemaName = (session!.user as any).schemaName

  let leads: LeadCard[] = []

  if (schemaName) {
    try {
      const db = getTenantPrisma(schemaName)
      const contacts = await db.contact.findMany({
        orderBy: { updated_at: 'desc' },
        include: {
          messages: { orderBy: { timestamp: 'desc' }, take: 1 }
        }
      })
      leads = contacts.map((c: any) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        stage: c.stage || 'novo_lead',
        deal_value: c.deal_value ? String(c.deal_value) : null,
        lastMessage: c.messages?.[0]?.content || null,
        tags: c.tags || [],
        createdAt: c.created_at.toISOString()
      }))
    } catch {
      // schema não provisionado
    }
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-fg">Funil de Vendas</h1>
        <p className="mt-1 text-sm text-muted">
          Arraste os contatos entre os estágios para acompanhar o pipeline.
        </p>
      </div>

      {leads.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface p-16 text-center">
          <div className="mb-4 text-5xl">📊</div>
          <h2 className="mb-2 text-lg font-semibold text-fg">Nenhum lead ainda</h2>
          <p className="text-sm text-muted">
            Os contatos do WhatsApp aparecem aqui automaticamente como leads.
          </p>
        </div>
      ) : (
        <KanbanBoard initialLeads={leads} />
      )}
    </div>
  )
}
