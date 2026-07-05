export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { globalPrisma } from '@/lib/prisma-tenant'
import { encrypt } from '@/lib/crypto'

// Desconecta o WhatsApp do tenant (limpa credenciais) para reconectar do zero.
export async function DELETE() {
  const session = await auth()
  const tenantId = (session?.user as any)?.tenantId
  if (!tenantId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await globalPrisma.tenant.findUnique({ where: { id: tenantId } })
  // Best-effort: remove a inscrição do webhook na WABA antes de limpar.
  if (tenant?.waba_id && tenant.whatsapp_token) {
    try {
      const token = (await import('@/lib/crypto')).decrypt(tenant.whatsapp_token)
      await fetch(`https://graph.facebook.com/v21.0/${tenant.waba_id}/subscribed_apps?access_token=${token}`, { method: 'DELETE' })
    } catch { /* ignora */ }
  }

  await globalPrisma.tenant.update({
    where: { id: tenantId },
    data: { waba_id: null, phone_number_id: null, whatsapp_token: null, whatsapp_connected: false }
  })
  return Response.json({ ok: true })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!(session?.user as any)?.tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId = (session!.user as any).tenantId
  const { code } = await req.json()

  try {
    // O SDK JS às vezes vincula um redirect_uri ao código do Embedded Signup.
    // Tentamos sem redirect_uri (fluxo canônico) e, se falhar, com as variações mais prováveis.
    const base = process.env.NEXT_PUBLIC_URL || 'https://uprocrm.com.br'
    const redirectCandidates: (string | null)[] = [
      null,
      `${base}/onboarding/connect-whatsapp`,
      `${base}/`,
      base
    ]
    const appId = encodeURIComponent(process.env.META_APP_ID || '')
    const appSecret = encodeURIComponent(process.env.META_APP_SECRET || '')
    const codeEnc = encodeURIComponent(code || '')

    let tokenData: any = null
    let accessToken: string | undefined
    for (const ru of redirectCandidates) {
      const url = `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&code=${codeEnc}` +
        (ru ? `&redirect_uri=${encodeURIComponent(ru)}` : '')
      const r = await fetch(url, { method: 'GET' })
      tokenData = await r.json()
      if (tokenData?.access_token) {
        accessToken = tokenData.access_token
        console.log('[whatsapp connect] token OK with redirect_uri =', ru ?? '(none)')
        break
      }
      // Se o erro NÃO for de redirect_uri (36008), não adianta tentar as outras variações.
      if (tokenData?.error?.error_subcode !== 36008) break
    }

    if (!accessToken) {
      console.error('[whatsapp connect] token exchange failed', JSON.stringify(tokenData))
      const e = tokenData?.error
      const detail = e
        ? `${e.message} [code ${e.code}/${e.error_subcode}] appid=${(process.env.META_APP_ID || '').slice(-4)}`
        : JSON.stringify(tokenData)
      return Response.json({ error: `Falha ao obter token: ${detail}` }, { status: 400 })
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
