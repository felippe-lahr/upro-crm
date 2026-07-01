export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { getTenantPrisma } from '@/lib/prisma-tenant'

async function db() {
  const session = await auth()
  const schemaName = (session?.user as any)?.schemaName
  if (!schemaName) return null
  return getTenantPrisma(schemaName)
}

// GET ?service_id=<id> -> regras daquele serviço (ou padrão do tenant se omitido)
export async function GET(req: Request) {
  const prisma = await db()
  if (!prisma) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const serviceId = new URL(req.url).searchParams.get('service_id')
  const rules = await prisma.availability.findMany({
    where: { service_id: serviceId || null },
    orderBy: [{ weekday: 'asc' }, { start_min: 'asc' }]
  })
  return Response.json(rules)
}

// Substitui todas as regras de um serviço de uma vez: { service_id, rules: [{ weekday, start_min, end_min }] }
export async function PUT(req: Request) {
  const prisma = await db()
  if (!prisma) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { rules, service_id } = await req.json()
  if (!Array.isArray(rules)) return Response.json({ error: 'rules deve ser array' }, { status: 400 })

  const clean = rules
    .filter((r: any) => r && r.weekday >= 0 && r.weekday <= 6 && r.end_min > r.start_min)
    .map((r: any) => ({ service_id: service_id || null, weekday: Number(r.weekday), start_min: Number(r.start_min), end_min: Number(r.end_min) }))

  await prisma.availability.deleteMany({ where: { service_id: service_id || null } })
  if (clean.length) await prisma.availability.createMany({ data: clean })
  return Response.json({ ok: true })
}
