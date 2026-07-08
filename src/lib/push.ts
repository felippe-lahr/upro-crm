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
export async function sendPushToTenant(tenantId: string, payload: PushPayload) {
  const webpush = getWebPush()
  if (!webpush) return

  const subs = await globalPrisma.pushSubscription.findMany({ where: { tenant_id: tenantId } })
  if (subs.length === 0) return

  const data = JSON.stringify(payload)

  await Promise.all(
    subs.map(async (s: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          data
        )
      } catch (err: any) {
        // Inscrição expirada/removida no dispositivo → limpa do banco.
        const code = err?.statusCode
        if (code === 404 || code === 410) {
          await globalPrisma.pushSubscription.delete({ where: { endpoint: s.endpoint } }).catch(() => {})
        } else {
          console.error('[push] send failed', code || err?.message || err)
        }
      }
    })
  )
}
