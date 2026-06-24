export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { globalPrisma, getTenantPrisma } from '@/lib/prisma-tenant'
import { sendWhatsAppMessage } from '@/lib/bot'

export async function POST(req: Request) {
  const session = await auth()
  const user = session?.user as any
  const schemaName = user?.schemaName
  const tenantId = user?.tenantId
  if (!schemaName) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { contactId, text } = await req.json()
  if (!contactId || !text?.trim()) {
    return Response.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  const db = getTenantPrisma(schemaName)
  const contact = await db.contact.findUnique({ where: { id: contactId } })
  if (!contact) {
    return Response.json({ error: 'Contato não encontrado' }, { status: 404 })
  }

  const tenant = await globalPrisma.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant?.whatsapp_connected || !tenant.phone_number_id || !tenant.whatsapp_token) {
    return Response.json({ error: 'WhatsApp não conectado' }, { status: 400 })
  }

  try {
    await sendWhatsAppMessage(
      { phone_number_id: tenant.phone_number_id, whatsapp_token: tenant.whatsapp_token },
      contact.phone,
      text.trim()
    )
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'Falha no envio' },
      { status: 502 }
    )
  }

  const message = await db.message.create({
    data: {
      contact_id: contactId,
      direction: 'outbound',
      type: 'text',
      content: text.trim(),
      sent_by_bot: false,
      timestamp: new Date()
    }
  })

  return Response.json({ ok: true, id: message.id })
}
