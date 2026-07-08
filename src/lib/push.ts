import { globalPrisma } from './prisma-tenant'

// Configuração VAPID (definida via env). Sem as chaves, o push fica desativado.
function getWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return null
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const webpush = require('web-push')
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:contato@uprocrm.com.br',
    publicKey,
    privateKey
  )
  return webpush
}

export interface PushPayload {
  title: string
  body: string
  url?: string // rota a abrir ao clicar (ex.: /conversations/<id>)
  tag?: string // agrupa notificações (ex.: por contato)
}

/**
 * Envia uma notificação push para todos os dispositivos inscritos de um tenant.
 * Best-effort: falhas não quebram o fluxo; inscrições inválidas (410/404) são removidas.
 */
export async function sendPushToTenant(tenantId: string, payload: PushPayload): Promise<{ configured: boolean; subs: number; sent: number; errors: string[] }> {
  const webpush = getWebPush()
  if (!webpush) return { configured: false, subs: 0, sent: 0, errors: ['VAPID não configurado no servidor'] }

  const subs = await globalPrisma.pushSubscription.findMany({ where: { tenant_id: tenantId } })
  if (subs.length === 0) return { configured: true, subs: 0, sent: 0, errors: [] }

  const data = JSON.stringify(payload)
  let sent = 0
  const errors: string[] = []

  await Promise.all(
    subs.map(async (s: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          data
        )
        sent++
      } catch (err: any) {
        const code = err?.statusCode
        if (code === 404 || code === 410) {
          await globalPrisma.pushSubscription.delete({ where: { endpoint: s.endpoint } }).catch(() => {})
          errors.push(`sub removida (${code})`)
        } else {
          const m = `${code || ''} ${err?.body || err?.message || err}`.trim()
          console.error('[push] send failed', m)
          errors.push(m)
        }
      }
    })
  )
  return { configured: true, subs: subs.length, sent, errors }
}
