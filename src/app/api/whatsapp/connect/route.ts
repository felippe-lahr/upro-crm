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
    data: { waba_id: null, phone_number_id: null, whatsapp_token: null, whatsapp_connected: false, display_phone_number: null, verified_name: null }
  })
  return Response.json({ ok: true })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!(session?.user as any)?.tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId = (session!.user as any).tenantId
  const body = await req.json()
  const authResponse = body?.authResponse || {}
  const code = authResponse.code || body?.code
  const directToken = authResponse.accessToken

  try {
    console.log('[whatsapp connect] authResponse keys:', Object.keys(authResponse), 'hasToken:', !!directToken, 'hasCode:', !!code)
    // O SDK JS pode vincular um redirect_uri ao código. Usamos o domínio REAL da
    // requisição (uprocrm.com.br) — não NEXT_PUBLIC_URL, que pode estar errado.
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'uprocrm.com.br'
    const origin = `https://${host}`
    // null = sem redirect_uri; '' = redirect_uri vazio; demais = variações de URL.
    const redirectCandidates: (string | null)[] = [
      null,
      '',
      `${origin}/onboarding/connect-whatsapp`,
      `${origin}/`,
      origin
    ]
    const appId = encodeURIComponent(process.env.META_APP_ID || '')
    const appSecret = encodeURIComponent(process.env.META_APP_SECRET || '')
    const codeEnc = encodeURIComponent(code || '')

    let tokenData: any = null
    let accessToken: string | undefined = directToken || undefined

    // Só faz a troca de código quando o SDK NÃO devolveu um token direto.
    if (!accessToken && code) {
      for (const ru of redirectCandidates) {
        const rp = ru === null ? '' : `&redirect_uri=${encodeURIComponent(ru)}`
        const url = `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&code=${codeEnc}${rp}`
        const r = await fetch(url, { method: 'GET' })
        tokenData = await r.json()
        if (tokenData?.access_token) {
          accessToken = tokenData.access_token
          console.log('[whatsapp connect] token OK with redirect_uri =', ru === null ? '(none)' : `"${ru}"`)
          break
        }
        console.warn('[whatsapp connect] try redirect_uri', ru === null ? '(none)' : `"${ru}"`, '->', tokenData?.error?.message)
      }
    }

    // ── Fallback: session info do Embedded Signup + token de sistema ──
    // O popup envia waba_id/phone_number_id via postMessage; com um token de
    // sistema permanente (META_SYSTEM_USER_TOKEN) registramos direto, sem OAuth.
    const sessionInfo = body?.sessionInfo || null
    const sysToken = process.env.META_SYSTEM_USER_TOKEN
    if (!accessToken && sessionInfo && sysToken) {
      const wabaId = sessionInfo.waba_id || sessionInfo.wabaId || sessionInfo?.data?.waba_id
      const phoneNumberId = sessionInfo.phone_number_id || sessionInfo.phoneNumberId || sessionInfo?.data?.phone_number_id
      console.log('[whatsapp connect] fallback session info', { wabaId, phoneNumberId })
      if (wabaId && phoneNumberId) {
        const reg = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messaging_product: 'whatsapp', pin: '000000', access_token: sysToken })
        }).then(r => r.json()).catch(e => ({ error: { message: String(e) } }))
        if (reg?.error) console.warn('[whatsapp connect] register warn:', reg.error.message)

        const sub = await fetch(`https://graph.facebook.com/v21.0/${wabaId}/subscribed_apps`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: sysToken })
        }).then(r => r.json()).catch(e => ({ error: { message: String(e) } }))
        if (sub?.error) {
          console.error('[whatsapp connect] subscribe failed:', JSON.stringify(sub.error))
          return Response.json({ error: `Falha ao inscrever webhook: ${sub.error.message}` }, { status: 400 })
        }

        await globalPrisma.tenant.update({
          where: { id: tenantId },
          data: { waba_id: wabaId, phone_number_id: phoneNumberId, whatsapp_token: encrypt(sysToken), whatsapp_connected: true }
        })
        console.log('[whatsapp connect] connected via session info + system token')
        return Response.json({ success: true })
      }
    }

    if (!accessToken) {
      console.error('[whatsapp connect] token exchange failed', JSON.stringify(tokenData),
        'sessionInfo:', JSON.stringify(sessionInfo), 'hasSysToken:', !!sysToken)
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
