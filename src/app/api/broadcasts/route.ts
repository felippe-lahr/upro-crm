export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { globalPrisma, getTenantPrisma } from '@/lib/prisma-tenant'
import { sendWhatsAppMessage } from '@/lib/bot'

export async function GET() {
  const session = await auth()
  const schemaName = (session?.user as any)?.schemaName
  if (!schemaName) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const db = getTenantPrisma(schemaName)
  const broadcasts = await db.broadcast.findMany({ orderBy: { created_at: 'desc' }, take: 50 })
  return Response.json(broadcasts)
}

export async function POST(req: Request) {
  const session = await auth()
  const user = session?.user as any
  const schemaName = user?.schemaName
  const tenantId = user?.tenantId
  if (!schemaName) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { message, filter_tag } = await req.json()
  if (!message?.trim()) {
    return Response.json({ error: 'Mensagem obrigatória' }, { status: 400 })
  }

  const tenant = await globalPrisma.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant?.whatsapp_connected || !tenant.phone_number_id || !tenant.whatsapp_token) {
    return Response.json({ error: 'WhatsApp não conectado' }, { status: 400 })
  }

  const db = getTenantPrisma(schemaName)
  const where = filter_tag ? { tags: { has: String(filter_tag) } } : {}
  const contacts = await db.contact.findMany({ where })

  let sent = 0
  let failed = 0
  const creds = {
    phone_number_id: tenant.phone_number_id,
    whatsapp_token: tenant.whatsapp_token
  }

  for (const c of contacts) {
    try {
      await sendWhatsAppMessage(creds, c.phone, message.trim())
      await db.message.create({
        data: {
          contact_id: c.id,
          direction: 'outbound',
          type: 'text',
          content: message.trim(),
          sent_by_bot: false,
          timestamp: new Date()
        }
      })
      sent++
    } catch {
      failed++
    }
  }

  const broadcast = await db.broadcast.create({
    data: {
      message: message.trim(),
      status: 'sent',
      total: contacts.length,
      sent_count: sent,
      failed_count: failed,
      filter_tag: filter_tag || null,
      sent_at: new Date()
    }
  })

  return Response.json(broadcast)
}
