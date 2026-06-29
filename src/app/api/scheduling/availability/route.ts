export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { getTenantPrisma } from '@/lib/prisma-tenant'

async function db() {
  const session = await auth()
  const schemaName = (session?.user as any)?.schemaName
  if (!schemaName) return null
  return getTenantPrisma(schemaName)
}

export async function GET() {
  const prisma = await db()
  if (!prisma) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const rules = await prisma.availability.findMany({ orderBy: [{ weekday: 'asc' }, { start_min: 'asc' }] })
  return Response.json(rules)
}

// Substitui todas as regras de uma vez: { rules: [{ weekday, start_min, end_min }] }
export async function PUT(req: Request) {
  const prisma = await db()
  if (!prisma) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { rules } = await req.json()
  if (!Array.isArray(rules)) return Response.json({ error: 'rules deve ser array' }, { status: 400 })

  const clean = rules
    .filter((r: any) => r && r.weekday >= 0 && r.weekday <= 6 && r.end_min > r.start_min)
    .map((r: any) => ({ weekday: Number(r.weekday), start_min: Number(r.start_min), end_min: Number(r.end_min) }))

  await prisma.availability.deleteMany({})
  if (clean.length) await prisma.availability.createMany({ data: clean })
  return Response.json({ ok: true })
}
