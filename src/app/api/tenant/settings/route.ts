export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { globalPrisma } from '@/lib/prisma-tenant'
import { encrypt } from '@/lib/crypto'

export async function GET() {
  const session = await auth()
  if (!(session?.user as any)?.tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId = (session!.user as any).tenantId
  const tenant = await globalPrisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true, name: true, email: true, plan: true, status: true,
      whatsapp_connected: true, phone_number_id: true, waba_id: true,
      bot_enabled: true, bot_prompt: true, trial_ends_at: true,
      menu_bot_enabled: true, menu_bot_greeting: true, menu_bot_options: true,
      handoff_pause: true, keep_responding_after_human: true,
      products_feed_url: true, products_synced_at: true, products_count: true,
      mp_access_token: true
    }
  })

  // Nunca devolve o token; apenas se está conectado.
  const { mp_access_token, ...rest } = tenant || {}
  return Response.json({ ...rest, mp_connected: !!mp_access_token })
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!(session?.user as any)?.tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId = (session!.user as any).tenantId
  const body = await req.json()
  const { bot_enabled, bot_prompt, menu_bot_enabled, menu_bot_greeting, menu_bot_options,
    handoff_pause, keep_responding_after_human, mp_access_token, products_feed_url } = body

  // Token do Mercado Pago do lojista (recebe os sinais). '' limpa; undefined mantém.
  let mpTokenData: { mp_access_token?: string | null } = {}
  if (mp_access_token !== undefined) {
    mpTokenData = { mp_access_token: mp_access_token ? encrypt(String(mp_access_token).trim()) : null }
  }

  // Bot com IA é exclusivo dos planos Pro e Promaster
  if (bot_enabled === true || products_feed_url !== undefined) {
    const current = await globalPrisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true }
    })
    if (bot_enabled === true && !['pro', 'promaster'].includes(current?.plan || '')) {
      return Response.json(
        { error: 'O Bot com IA está disponível apenas nos planos Pro e Promaster.' },
        { status: 403 }
      )
    }
    // O feed de produtos é exclusivo do Promaster.
    if (products_feed_url !== undefined && current?.plan !== 'promaster') {
      return Response.json(
        { error: 'O catálogo de produtos está disponível apenas no plano Promaster.' },
        { status: 403 }
      )
    }
  }

  // Normaliza as opções do menu (id estável, no máximo 3 botões)
  let normalizedOptions
  if (menu_bot_options !== undefined) {
    normalizedOptions = (Array.isArray(menu_bot_options) ? menu_bot_options : [])
      .filter((o: any) => o && typeof o.label === 'string' && o.label.trim())
      .slice(0, 3)
      .map((o: any, i: number) => ({
        id: o.id || `opt_${i + 1}`,
        label: String(o.label).slice(0, 20),
        response: String(o.response || '')
      }))
  }

  const updated = await globalPrisma.tenant.update({
    where: { id: tenantId },
    data: {
      ...(bot_enabled !== undefined && { bot_enabled }),
      ...(bot_prompt !== undefined && { bot_prompt }),
      ...(menu_bot_enabled !== undefined && { menu_bot_enabled }),
      ...(menu_bot_greeting !== undefined && { menu_bot_greeting }),
      ...(normalizedOptions !== undefined && { menu_bot_options: normalizedOptions }),
      ...(handoff_pause !== undefined && { handoff_pause }),
      ...(keep_responding_after_human !== undefined && { keep_responding_after_human }),
      ...(products_feed_url !== undefined && { products_feed_url: products_feed_url ? String(products_feed_url).trim() : null }),
      ...mpTokenData
    },
    select: {
      id: true, bot_enabled: true, bot_prompt: true,
      menu_bot_enabled: true, menu_bot_greeting: true, menu_bot_options: true,
      handoff_pause: true, keep_responding_after_human: true
    }
  })

  return Response.json(updated)
}
