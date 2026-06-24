import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { globalPrisma } from '@/lib/prisma-tenant'
import { encrypt } from '@/lib/crypto'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!(session?.user as any)?.tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId = (session!.user as any).tenantId
  const { code } = await req.json()

  try {
    const tokenRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?` +
        `client_id=${process.env.META_APP_ID}&` +
        `client_secret=${process.env.META_APP_SECRET}&` +
        `code=${code}`,
      { method: 'GET' }
    )
    const tokenData = await tokenRes.json()
    const accessToken = tokenData.access_token

    if (!accessToken) {
      return Response.json({ error: 'Failed to get access token', detail: tokenData }, { status: 400 })
    }

    const debugRes = await fetch(
      `https://graph.facebook.com/v21.0/debug_token?` +
        `input_token=${accessToken}&` +
        `access_token=${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`
    )
    const debugData = await debugRes.json()
    const wabaId = debugData.data?.granular_scopes
      ?.find((s: any) => s.scope === 'whatsapp_business_management')
      ?.target_ids?.[0]

    if (!wabaId) {
      return Response.json({ error: 'Could not find WABA ID' }, { status: 400 })
    }

    const phoneRes = await fetch(
      `https://graph.facebook.com/v21.0/${wabaId}/phone_numbers?access_token=${accessToken}`
    )
    const phoneData = await phoneRes.json()
    const phoneNumberId = phoneData.data?.[0]?.id

    if (!phoneNumberId) {
      return Response.json({ error: 'No phone number found in WABA' }, { status: 400 })
    }

    await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        pin: '000000',
        access_token: accessToken
      })
    })

    await fetch(`https://graph.facebook.com/v21.0/${wabaId}/subscribed_apps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: accessToken })
    })

    await globalPrisma.tenant.update({
      where: { id: tenantId },
      data: {
        waba_id: wabaId,
        phone_number_id: phoneNumberId,
        whatsapp_token: encrypt(accessToken),
        whatsapp_connected: true
      }
    })

    return Response.json({ success: true })
  } catch (error) {
    console.error('WhatsApp connect error:', error)
    return Response.json({ error: 'Failed to connect WhatsApp' }, { status: 500 })
  }
}
