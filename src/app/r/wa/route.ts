export const dynamic = 'force-dynamic'

import { globalPrisma } from '@/lib/prisma-tenant'
import { embedAdMarker } from '@/lib/ad-marker'

/**
 * Redirecionamento rastreável de anúncio → WhatsApp.
 *
 * Uso no anúncio (URL final do Google Ads, com auto-tagging ligado o Google
 * anexa o ?gclid=... automaticamente):
 *   https://SEU-DOMINIO/r/wa?t=<slug-do-tenant>&utm_source=google&utm_campaign=...
 *
 * O que faz:
 *  - lê gclid + UTMs da URL;
 *  - cria um AdClick com um código curto;
 *  - redireciona (302) para wa.me/<numero> com o texto pré-preenchido + marcador
 *    "#GAD:<code>", que o webhook do WhatsApp casa com a 1ª mensagem para atribuir
 *    a origem (Google Ads + gclid) ao lead.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const slug = url.searchParams.get('t') || url.searchParams.get('slug')
  const fallback = 'https://uprocrm.com.br'

  if (!slug) return Response.redirect(fallback, 302)

  const tenant = await globalPrisma.tenant.findUnique({
    where: { slug },
    select: { id: true, ads_wa_number: true }
  }).catch(() => null)

  const number = (tenant?.ads_wa_number || '').replace(/\D/g, '')
  if (!tenant || !number) return Response.redirect(fallback, 302)

  // Código curto e único para casar depois com a mensagem.
  const code = Math.random().toString(36).slice(2, 10)

  await globalPrisma.adClick.create({
    data: {
      code,
      tenant_id: tenant.id,
      gclid: url.searchParams.get('gclid') || null,
      utm_source: url.searchParams.get('utm_source') || null,
      utm_medium: url.searchParams.get('utm_medium') || null,
      utm_campaign: url.searchParams.get('utm_campaign') || null,
      utm_term: url.searchParams.get('utm_term') || null,
      utm_content: url.searchParams.get('utm_content') || null
    }
  }).catch(() => {})

  // Texto que o cliente enviará. O marcador vai EMBUTIDO de forma invisível
  // (caracteres zero-width) — o cliente vê só a frase natural, sem código à mostra.
  const baseText = url.searchParams.get('text') || 'Olá! Vim pelo Google e gostaria de mais informações.'
  const text = embedAdMarker(baseText, code)
  const target = `https://wa.me/${number}?text=${encodeURIComponent(text)}`

  return Response.redirect(target, 302)
}
