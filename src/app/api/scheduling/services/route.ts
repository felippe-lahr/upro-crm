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
  const { name, duration_min, price, gap_min, min_notice_min } = await req.json()
  if (!name?.trim()) return Response.json({ error: 'Nome obrigatório' }, { status: 400 })
  const service = await prisma.service.create({
    data: {
      name: name.trim(),
      duration_min: Number(duration_min) || 60,
      price: price !== undefined && price !== '' ? Number(price) : null,
      gap_min: Math.max(0, Math.min(240, Number(gap_min) || 0)),
      min_notice_min: Math.max(0, Math.min(43200, Number(min_notice_min) || 0))
    }
  })
  return Response.json(service)
}

export async function PATCH(req: Request) {
  const prisma = await db()
  if (!prisma) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, name, duration_min, price, active, gap_min, min_notice_min, charge_mode, charge_value, hold_minutes } = await req.json()
  if (!id) return Response.json({ error: 'id obrigatório' }, { status: 400 })

  // Edita o serviço; afeta apenas agendamentos futuros (os existentes já têm start/end gravados).
  const data: any = {}
  if (name !== undefined) {
    if (!String(name).trim()) return Response.json({ error: 'Nome obrigatório' }, { status: 400 })
    data.name = String(name).trim()
  }
  if (duration_min !== undefined) data.duration_min = Number(duration_min) || 60
  if (price !== undefined) data.price = price !== '' && price !== null ? Number(price) : null
  if (active !== undefined) data.active = !!active
  if (gap_min !== undefined) data.gap_min = Math.max(0, Math.min(240, Number(gap_min) || 0))
  if (min_notice_min !== undefined) data.min_notice_min = Math.max(0, Math.min(43200, Number(min_notice_min) || 0))
  if (charge_mode !== undefined) data.charge_mode = ['none', 'fixed', 'percent', 'full'].includes(charge_mode) ? charge_mode : 'none'
  if (charge_value !== undefined) data.charge_value = charge_value !== '' && charge_value !== null ? Number(charge_value) : null
  if (hold_minutes !== undefined) data.hold_minutes = Math.max(5, Math.min(1440, Number(hold_minutes) || 30))
  if (Object.keys(data).length === 0) return Response.json({ error: 'Nada para atualizar' }, { status: 400 })

  const service = await prisma.service.update({ where: { id }, data })
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
