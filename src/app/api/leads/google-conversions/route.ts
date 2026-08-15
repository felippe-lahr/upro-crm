export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { getTenantPrisma } from '@/lib/prisma-tenant'

/**
 * Exporta um CSV no formato de Importação de Conversões Offline do Google Ads
 * (baseado em GCLID), para os leads que vieram do Google Ads (capturados via /r/wa).
 *
 * Query:
 *  - conversion: nome da ação de conversão criada no Google Ads (default "WhatsApp Lead")
 *  - value: valor por conversão (default 0)
 *  - all=1: inclui todos os leads com gclid; por padrão inclui só os que avançaram
 *           no funil (stage != novo_lead e != perdido) — a "conversão" de verdade.
 *
 * O lojista baixa este CSV e importa em: Google Ads → Metas → Conversões →
 * Importar → Cliques (Offline). O Google credita a conversão à campanha do gclid.
 */
export async function GET(req: Request) {
  const session = await auth()
  const schemaName = (session?.user as any)?.schemaName
  if (!schemaName) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const conversionName = (url.searchParams.get('conversion') || 'WhatsApp Lead').replace(/[",\n]/g, ' ').trim()
  const value = Number(url.searchParams.get('value') || '0') || 0
  const includeAll = url.searchParams.get('all') === '1'

  const db = getTenantPrisma(schemaName)
  const contacts = await db.contact.findMany({
    where: { lead_source: { not: undefined } },
    orderBy: { updated_at: 'desc' },
    take: 5000
  })

  // Formata a data no fuso de São Paulo: "AAAA-MM-DD HH:mm:ss".
  const fmt = (d: Date) => {
    const date = d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) // AAAA-MM-DD
    const time = d.toLocaleTimeString('en-GB', { timeZone: 'America/Sao_Paulo', hour12: false }) // HH:mm:ss
    return `${date} ${time}`
  }

  const rows: string[] = []
  for (const c of contacts as any[]) {
    const src = c.lead_source
    if (!src || src.kind !== 'google_ads' || !src.gclid) continue
    if (!includeAll && (c.stage === 'novo_lead' || c.stage === 'perdido')) continue
    const when = fmt(c.updated_at || c.created_at || new Date())
    // gclid,Conversion Name,Conversion Time,Conversion Value,Conversion Currency
    rows.push([src.gclid, conversionName, when, String(value), 'BRL'].map(csv).join(','))
  }

  const body =
    'Parameters:TimeZone=-0300\n' +
    'Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency\n' +
    rows.join('\n') + (rows.length ? '\n' : '')

  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="google-conversions-${new Date().toISOString().slice(0, 10)}.csv"`
    }
  })
}

function csv(v: string): string {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
