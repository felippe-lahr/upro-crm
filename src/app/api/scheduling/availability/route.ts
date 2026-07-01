export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { getTenantPrisma, globalPrisma } from '@/lib/prisma-tenant'

async function ctx() {
  const session = await auth()
  const schemaName = (session?.user as any)?.schemaName
  const tenantId = (session?.user as any)?.tenantId
  if (!schemaName || !tenantId) return null
  return { prisma: getTenantPrisma(schemaName), tenantId }
}

export async function GET() {
  const c = await ctx()
  if (!c) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const rules = await c.prisma.availability.findMany({ orderBy: [{ weekday: 'asc' }, { start_min: 'asc' }] })
  const tenant = await globalPrisma.tenant.findUnique({ where: { id: c.tenantId }, select: { booking_gap_min: true } })
  return Response.json({ rules, gap_min: tenant?.booking_gap_min ?? 0 })
}

// Substitui todas as regras de uma vez: { rules: [{ weekday, start_min, end_min }], gap_min }
export async function PUT(req: Request) {
  const c = await ctx()
  if (!c) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { rules, gap_min } = await req.json()
  if (!Array.isArray(rules)) return Response.json({ error: 'rules deve ser array' }, { status: 400 })

  const clean = rules
    .filter((r: any) => r && r.weekday >= 0 && r.weekday <= 6 && r.end_min > r.start_min)
    .map((r: any) => ({ weekday: Number(r.weekday), start_min: Number(r.start_min), end_min: Number(r.end_min) }))

  await c.prisma.availability.deleteMany({})
  if (clean.length) await c.prisma.availability.createMany({ data: clean })

  if (gap_min !== undefined) {
    const gap = Math.max(0, Math.min(240, Number(gap_min) || 0))
    await globalPrisma.tenant.update({ where: { id: c.tenantId }, data: { booking_gap_min: gap } })
  }
  return Response.json({ ok: true })
}
