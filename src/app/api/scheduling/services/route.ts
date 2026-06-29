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
  const services = await prisma.service.findMany({ orderBy: { created_at: 'asc' } })
  return Response.json(services)
}

export async function POST(req: Request) {
  const prisma = await db()
  if (!prisma) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { name, duration_min, price } = await req.json()
  if (!name?.trim()) return Response.json({ error: 'Nome obrigatório' }, { status: 400 })
  const service = await prisma.service.create({
    data: {
      name: name.trim(),
      duration_min: Number(duration_min) || 60,
      price: price !== undefined && price !== '' ? Number(price) : null
    }
  })
  return Response.json(service)
}

export async function DELETE(req: Request) {
  const prisma = await db()
  if (!prisma) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json()
  if (!id) return Response.json({ error: 'id obrigatório' }, { status: 400 })
  await prisma.service.delete({ where: { id } })
  return Response.json({ ok: true })
}
