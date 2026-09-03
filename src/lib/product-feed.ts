/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Ingestão do catálogo de produtos do plano Promaster.
 *
 * Baixa um feed XML no padrão Google Merchant / RSS 2.0
 * (<rss xmlns:g> → <channel> → <item>), faz o parse tolerante (sem dependência
 * externa: o feed é plano e consistente) e sincroniza os produtos no schema do
 * tenant. Chamado pelo cron de sincronização e pelo botão "Sincronizar agora".
 */

import { globalPrisma } from './prisma-tenant'

export interface ParsedProduct {
  feed_id: string
  title: string
  description: string | null
  brand: string | null
  category: string | null
  price: number | null
  sale_price: number | null
  in_stock: boolean
  url: string | null
  image: string | null
  gtin: string | null
  sku: string | null
  installments: { months: number; amount: number } | null
}

/** Decodifica as entidades HTML mais comuns e limpa ruído do feed. */
function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/_x000D_/g, '')
    .replace(/&bull;/g, '•')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)))
    .trim()
}

/** Extrai o conteúdo da primeira ocorrência de uma tag dentro de um bloco. */
function tag(block: string, name: string): string | null {
  // name pode conter ':' (ex.: g:price) — escapa para o regex.
  const esc = name.replace(/[:]/g, '\\:')
  const m = block.match(new RegExp(`<${esc}(?:\\s[^>]*)?>([\\s\\S]*?)</${esc}>`, 'i'))
  return m ? decodeEntities(m[1]) : null
}

/** "R$ 189,90" | "189.90" → 189.9 (ou null). */
export function parsePrice(raw: string | null): number | null {
  if (!raw) return null
  const cleaned = raw.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
}

/** Faz o parse de um feed XML inteiro em uma lista de produtos. */
export function parseProductFeed(xml: string): ParsedProduct[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || []
  const products: ParsedProduct[] = []
  for (const block of items) {
    const feed_id = tag(block, 'g:id')
    const title = tag(block, 'title')
    if (!feed_id || !title) continue

    const months = tag(block, 'g:months')
    const amount = parsePrice(tag(block, 'g:amount'))
    const installments = months && amount != null ? { months: parseInt(months, 10) || 0, amount } : null

    products.push({
      feed_id,
      title,
      description: tag(block, 'description') || null,
      brand: tag(block, 'g:brand'),
      category: tag(block, 'g:product_type'),
      price: parsePrice(tag(block, 'g:price')),
      sale_price: parsePrice(tag(block, 'g:sale_price')),
      in_stock: (tag(block, 'g:availability') || 'in stock').toLowerCase() !== 'out of stock',
      url: tag(block, 'link'),
      image: tag(block, 'g:image_link'),
      gtin: tag(block, 'g:gtin'),
      sku: tag(block, 'g:mpn'),
      installments
    })
  }
  return products
}

export interface SyncResult {
  ok: boolean
  total: number
  upserted: number
  outOfStock: number
  error?: string
}

/**
 * Baixa o feed do tenant e sincroniza a tabela `products` do seu schema.
 * Faz upsert dos itens presentes e marca como fora de estoque os que sumiram.
 */
export async function syncTenantProducts(tenant: {
  id: string
  schema_name: string
  products_feed_url?: string | null
}): Promise<SyncResult> {
  const url = tenant.products_feed_url?.trim()
  if (!url) return { ok: false, total: 0, upserted: 0, outOfStock: 0, error: 'Feed não configurado' }

  let xml: string
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'UProCRM/1.0 (+https://uprocrm.com.br)' } })
    if (!res.ok) return { ok: false, total: 0, upserted: 0, outOfStock: 0, error: `HTTP ${res.status} ao baixar o feed` }
    xml = await res.text()
  } catch (e: any) {
    return { ok: false, total: 0, upserted: 0, outOfStock: 0, error: `Falha ao baixar o feed: ${e?.message || e}` }
  }

  const parsed = parseProductFeed(xml)
  if (!parsed.length) return { ok: false, total: 0, upserted: 0, outOfStock: 0, error: 'Nenhum produto encontrado no feed (formato inválido?)' }

  const { getTenantPrisma } = await import('./prisma-tenant')
  const db = getTenantPrisma(tenant.schema_name)
  const now = new Date()

  let upserted = 0
  let firstError: string | null = null
  // Upsert em lotes pequenos para não estourar o pool de conexões.
  const BATCH = 20
  for (let i = 0; i < parsed.length; i += BATCH) {
    const chunk = parsed.slice(i, i + BATCH)
    await Promise.all(
      chunk.map((p) => {
        const data = {
          title: p.title.slice(0, 500),
          description: p.description,
          brand: p.brand,
          category: p.category,
          price: p.price,
          sale_price: p.sale_price,
          in_stock: p.in_stock,
          url: p.url,
          image: p.image,
          gtin: p.gtin,
          sku: p.sku,
          installments: p.installments ?? undefined,
          synced_at: now
        }
        return db.product
          .upsert({ where: { feed_id: p.feed_id }, create: { feed_id: p.feed_id, ...data }, update: data })
          .then(() => { upserted++ })
          .catch((e: any) => {
            if (!firstError) firstError = e?.message || String(e)
            console.error('[product-feed] upsert falhou', p.feed_id, e?.message)
          })
    })
    )
  }

  // O feed tinha itens, mas NENHUM foi gravado → não é sucesso: quase sempre a
  // tabela `products` não existe no schema do tenant (schema não migrado) ou
  // houve erro de banco. Reporta o erro real em vez de fingir "0 produtos".
  if (upserted === 0) {
    const missingTable = /does not exist|relation .* does not exist|P2021|não existe/i.test(firstError || '')
    return {
      ok: false, total: 0, upserted: 0, outOfStock: 0,
      error: missingTable
        ? 'O catálogo deste tenant ainda não foi provisionado (tabela de produtos ausente). Rode a migração dos schemas e tente novamente.'
        : `Feed lido (${parsed.length} itens), mas nenhum produto pôde ser salvo${firstError ? `: ${String(firstError).slice(0, 180)}` : '.'}`
    }
  }

  // Itens que não vieram no feed desta vez → fora de estoque.
  const feedIds = parsed.map((p) => p.feed_id)
  const stale = await db.product
    .updateMany({ where: { feed_id: { notIn: feedIds }, in_stock: true }, data: { in_stock: false } })
    .catch(() => ({ count: 0 }))

  const total = await db.product.count().catch(() => upserted)

  await globalPrisma.tenant
    .update({ where: { id: tenant.id }, data: { products_synced_at: now, products_count: total } })
    .catch(() => {})

  return { ok: true, total, upserted, outOfStock: stale.count || 0 }
}
