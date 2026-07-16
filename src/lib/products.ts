/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Busca no catálogo de produtos do tenant (plano Promaster).
 *
 * Para catálogos de ~1.000 SKUs a busca por termos (ILIKE em título/marca/
 * categoria) + filtros estruturados (marca, preço, estoque) é suficiente e
 * barata. Retorna dados enxutos para o bot montar a resposta com o link.
 */

export interface ProductFilters {
  query?: string
  brand?: string
  priceMax?: number
  inStockOnly?: boolean
  limit?: number
}

export interface ProductCard {
  id: string
  title: string
  brand: string | null
  price: number | null
  sale_price: number | null
  in_stock: boolean
  url: string | null
  image: string | null
  category: string | null
}

function toCard(p: any): ProductCard {
  return {
    id: p.id,
    title: p.title,
    brand: p.brand,
    price: p.price != null ? Number(p.price) : null,
    sale_price: p.sale_price != null ? Number(p.sale_price) : null,
    in_stock: p.in_stock,
    url: p.url,
    image: p.image,
    category: p.category
  }
}

export async function searchProducts(tenantPrisma: any, filters: ProductFilters): Promise<ProductCard[]> {
  const limit = Math.min(Math.max(filters.limit || 6, 1), 12)
  const and: any[] = []

  // Cada termo da busca precisa aparecer em título, marca ou categoria.
  const terms = (filters.query || '').trim().split(/\s+/).filter((t) => t.length > 1).slice(0, 6)
  for (const term of terms) {
    and.push({
      OR: [
        { title: { contains: term, mode: 'insensitive' } },
        { brand: { contains: term, mode: 'insensitive' } },
        { category: { contains: term, mode: 'insensitive' } }
      ]
    })
  }
  if (filters.brand) and.push({ brand: { contains: filters.brand, mode: 'insensitive' } })
  if (filters.priceMax != null) and.push({ price: { lte: filters.priceMax } })
  if (filters.inStockOnly) and.push({ in_stock: true })

  const rows = await tenantPrisma.product.findMany({
    where: and.length ? { AND: and } : undefined,
    orderBy: [{ in_stock: 'desc' }, { price: 'asc' }],
    take: limit
  })
  return rows.map(toCard)
}

export async function getProductById(tenantPrisma: any, id: string): Promise<any | null> {
  return tenantPrisma.product.findUnique({ where: { id } }).catch(() => null)
}
