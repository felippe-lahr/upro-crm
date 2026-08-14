import { auth } from '@/lib/auth'
import { getTenantPrisma, globalPrisma } from '@/lib/prisma-tenant'
import { KanbanBoard, type LeadCard } from '@/components/ui/kanban-board'
import { resolveStages } from '@/lib/funnel'

export default async function FunnelPage() {
  const session = await auth()
  const schemaName = (session!.user as any).schemaName
  const tenantId = (session!.user as any).tenantId

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
        email: c.email || null,
        notes: c.notes || null,
        stage: c.stage || 'novo_lead',
        deal_value: c.deal_value ? String(c.deal_value) : null,
        lastMessage: c.messages?.[0]?.content || null,
        tags: c.tags || [],
        lossReason: c.loss_reason || null,
        createdAt: c.created_at.toISOString()
      }))
    } catch {
      // schema não provisionado
    }
  }

  const tenant = tenantId
    ? await globalPrisma.tenant.findUnique({ where: { id: tenantId }, select: { plan: true, funnel_labels: true, loss_reasons: true } })
    : null
  const isPro = tenant?.plan === 'pro'
  const stages = resolveStages(tenant?.funnel_labels as Record<string, string> | null)
  const lossReasons = Array.isArray(tenant?.loss_reasons) ? (tenant!.loss_reasons as string[]) : []

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-fg">Funil de Vendas</h1>
        <p className="mt-1 text-sm text-muted">
          Arraste os cards ou use o botão de mover para acompanhar o pipeline.
        </p>
      </div>

      <KanbanBoard initialLeads={leads} stages={stages} lossReasons={lossReasons} isPro={isPro} />
      {leads.length === 0 && (
        <p className="mt-4 text-center text-sm text-faint">
          Os contatos do WhatsApp aparecem aqui automaticamente como leads.
        </p>
      )}
    </div>
  )
}
