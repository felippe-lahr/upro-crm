export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { globalPrisma } from '@/lib/prisma-tenant'
import { encrypt, decrypt } from '@/lib/crypto'
import { getSummaryTemplateStatus } from '@/lib/whatsapp-templates'

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
      display_phone_number: true, verified_name: true,
      bot_enabled: true, bot_prompt: true, summary_instructions: true, lead_tags: true, auto_tag_enabled: true, ads_wa_number: true, slug: true, trial_ends_at: true,
      menu_bot_enabled: true, menu_bot_greeting: true, menu_bot_options: true,
      handoff_pause: true, keep_responding_after_human: true,
      scheduling_enabled: true,
      feature_summary_forward: true, summary_forward_number: true, summary_forward_template: true,
      whatsapp_token: true,
      products_feed_url: true, products_synced_at: true, products_count: true,
      mp_access_token: true
    }
  })

  // Se o recurso está liberado, consulta o status do template (best-effort).
  let summary_template_status: string | null = null
  let summary_template_rejected: string | undefined
  if (tenant?.feature_summary_forward && tenant.waba_id && tenant.whatsapp_token) {
    const st = await getSummaryTemplateStatus({ waba_id: tenant.waba_id, whatsapp_token: tenant.whatsapp_token })
    summary_template_status = st.status
    summary_template_rejected = st.rejected_reason
  }

  // Backfill preguiçoso do número legível: se está conectado e ainda não temos o
  // display_phone_number salvo, busca na Graph (best-effort) e guarda — assim os
  // tenants já conectados passam a exibir o número sem precisar reconectar.
  let display_phone_number = tenant?.display_phone_number || null
  let verified_name = tenant?.verified_name || null
  if (tenant?.whatsapp_connected && tenant.phone_number_id && tenant.whatsapp_token && !display_phone_number) {
    try {
      const tk = decrypt(tenant.whatsapp_token)
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${tenant.phone_number_id}?fields=display_phone_number,verified_name`,
        { headers: { Authorization: `Bearer ${tk}` } }
      )
      if (res.ok) {
        const data = await res.json()
        display_phone_number = data?.display_phone_number || null
        verified_name = data?.verified_name || null
        if (display_phone_number || verified_name) {
          await globalPrisma.tenant.update({
            where: { id: tenantId },
            data: { display_phone_number, verified_name }
          }).catch(() => {})
        }
      }
    } catch { /* best-effort: se falhar, a UI mostra só o Phone ID */ }
  }

  // Nunca devolve tokens; apenas o que a UI precisa.
  const { mp_access_token, whatsapp_token, ...rest } = tenant || {}
  return Response.json({ ...rest, display_phone_number, verified_name, mp_connected: !!mp_access_token, summary_template_status, summary_template_rejected })
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!(session?.user as any)?.tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId = (session!.user as any).tenantId
  const body = await req.json()
  const { bot_enabled, bot_prompt, menu_bot_enabled, menu_bot_greeting, menu_bot_options,
    handoff_pause, keep_responding_after_human, mp_access_token, products_feed_url,
    scheduling_enabled, summary_instructions, lead_tags, auto_tag_enabled, ads_wa_number,
    summary_forward_number, summary_forward_template } = body

  // Token do Mercado Pago do lojista (recebe os sinais). '' limpa; undefined mantém.
  let mpTokenData: { mp_access_token?: string | null } = {}
  if (mp_access_token !== undefined) {
    mpTokenData = { mp_access_token: mp_access_token ? encrypt(String(mp_access_token).trim()) : null }
  }

  const forwardTouched = summary_forward_number !== undefined || summary_forward_template !== undefined
  // Bot com IA é exclusivo dos planos Pro e Promaster
  if (bot_enabled === true || products_feed_url !== undefined || summary_instructions !== undefined || forwardTouched || lead_tags !== undefined) {
    const current = await globalPrisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true, feature_summary_forward: true }
    })
    // Encaminhar resumo: só quando o superadmin liberou o entitlement para este tenant.
    if (forwardTouched && !current?.feature_summary_forward) {
      return Response.json(
        { error: 'Recurso não habilitado para esta conta.' },
        { status: 403 }
      )
    }
    if (bot_enabled === true && !['pro', 'promaster'].includes(current?.plan || '')) {
      return Response.json(
        { error: 'O Bot com IA está disponível apenas nos planos Pro e Promaster.' },
        { status: 403 }
      )
    }
    // Resumo configurável é exclusivo do Pro/Promaster.
    if (summary_instructions !== undefined && !['pro', 'promaster'].includes(current?.plan || '')) {
      return Response.json(
        { error: 'O resumo configurável está disponível apenas nos planos Pro e Promaster.' },
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
    // Etiquetas automáticas são exclusivas do Pro/Promaster.
    if (lead_tags !== undefined && !['pro', 'promaster'].includes(current?.plan || '')) {
      return Response.json(
        { error: 'As etiquetas automáticas estão disponíveis apenas nos planos Pro e Promaster.' },
        { status: 403 }
      )
    }
  }

  // Normaliza a taxonomia de etiquetas (trim, únicas, sem vazias, limites).
  let normalizedLeadTags
  if (lead_tags !== undefined) {
    normalizedLeadTags = Array.from(new Set(
      (Array.isArray(lead_tags) ? lead_tags : [])
        .map((t: any) => String(t).trim().slice(0, 30))
        .filter(Boolean)
    )).slice(0, 40)
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
      ...(summary_instructions !== undefined && { summary_instructions: summary_instructions ? String(summary_instructions).slice(0, 2000) : null }),
      ...(normalizedLeadTags !== undefined && { lead_tags: normalizedLeadTags }),
      ...(auto_tag_enabled !== undefined && { auto_tag_enabled: !!auto_tag_enabled }),
      ...(ads_wa_number !== undefined && { ads_wa_number: ads_wa_number ? String(ads_wa_number).replace(/\D/g, '').slice(0, 20) : null }),
      ...(menu_bot_enabled !== undefined && { menu_bot_enabled }),
      ...(menu_bot_greeting !== undefined && { menu_bot_greeting }),
      ...(normalizedOptions !== undefined && { menu_bot_options: normalizedOptions }),
      ...(handoff_pause !== undefined && { handoff_pause }),
      ...(keep_responding_after_human !== undefined && { keep_responding_after_human }),
      ...(scheduling_enabled !== undefined && { scheduling_enabled: !!scheduling_enabled }),
      ...(summary_forward_number !== undefined && { summary_forward_number: summary_forward_number ? String(summary_forward_number).replace(/\D/g, '').slice(0, 20) : null }),
      ...(summary_forward_template !== undefined && { summary_forward_template: summary_forward_template ? String(summary_forward_template).trim().slice(0, 120) : null }),
      ...(products_feed_url !== undefined && { products_feed_url: products_feed_url ? String(products_feed_url).trim() : null }),
      ...mpTokenData
    },
    select: {
      id: true, bot_enabled: true, bot_prompt: true, summary_instructions: true,
      menu_bot_enabled: true, menu_bot_greeting: true, menu_bot_options: true,
      handoff_pause: true, keep_responding_after_human: true, scheduling_enabled: true
    }
  })

  return Response.json(updated)
}
