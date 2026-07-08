export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { sendPushToTenant } from '@/lib/push'

// Dispara uma notificação de teste para os dispositivos do tenant do usuário logado.
// Útil para diagnosticar o push. Retorna quantas inscrições, quantas enviadas e erros.
export async function GET() {
  const session = await auth()
  const tenantId = (session?.user as any)?.tenantId
  if (!tenantId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await sendPushToTenant(tenantId, {
      title: 'UProCRM — Teste',
      body: 'Se você recebeu isto, as notificações estão funcionando! 🔔',
      url: '/conversations'
    })
    return Response.json(result)
  } catch (e: any) {
    // Surface the real server-side error (ex.: web-push init, tabela ausente).
    return Response.json(
      { configured: true, subs: 0, sent: 0, errors: [`server: ${e?.message || String(e)}`] },
      { status: 200 }
    )
  }
}
