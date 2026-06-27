export const dynamic = 'force-dynamic'

import { globalPrisma } from '@/lib/prisma-tenant'
import { auth } from '@/lib/auth'
import bcrypt from 'bcryptjs'

async function requireSuperadmin() {
  const session = await auth()
  return (session?.user as any)?.role === 'superadmin'
}

function slugify(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '').slice(0, 20)
}

export async function GET() {
  if (!(await requireSuperadmin())) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const affiliates = await globalPrisma.affiliate.findMany({
    orderBy: { created_at: 'desc' },
    include: { _count: { select: { tenants: true } } }
  })

  const totals = await globalPrisma.affiliateCommission.groupBy({
    by: ['affiliate_id', 'status'],
    _sum: { amount: true }
  })

  const data = affiliates.map((a: any) => {
    const pending = totals.find((t: any) => t.affiliate_id === a.id && t.status === 'pending')?._sum.amount
    const paid = totals.find((t: any) => t.affiliate_id === a.id && t.status === 'paid')?._sum.amount
    return {
      id: a.id,
      name: a.name,
      email: a.email,
      code: a.code,
      commission_type: a.commission_type,
      commission_value: Number(a.commission_value),
      recurrence: a.recurrence,
      status: a.status,
      pix_key: a.pix_key,
      referred: a._count.tenants,
      pending: Number(pending || 0),
      paid: Number(paid || 0),
      created_at: a.created_at
    }
  })

  return Response.json(data)
}

// Cria afiliado diretamente (já aprovado)
export async function POST(req: Request) {
  if (!(await requireSuperadmin())) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const { name, email, password, commission_type, commission_value, recurrence } = await req.json()
  if (!name || !email || !password) return Response.json({ error: 'Campos obrigatórios' }, { status: 400 })

  if (await globalPrisma.affiliate.findUnique({ where: { email } })) {
    return Response.json({ error: 'E-mail já cadastrado' }, { status: 409 })
  }

  const base = slugify(name) || 'afiliado'
  let code = base
  let i = 1
  while (await globalPrisma.affiliate.findUnique({ where: { code } })) code = `${base}${i++}`

  const affiliate = await globalPrisma.affiliate.create({
    data: {
      name, email, code,
      password_hash: await bcrypt.hash(password, 12),
      commission_type: commission_type === 'fixed' ? 'fixed' : 'percent',
      commission_value: commission_value ?? 30,
      recurrence: ['lifetime', '12m', 'first'].includes(recurrence) ? recurrence : 'lifetime',
      status: 'active'
    }
  })
  return Response.json({ ok: true, id: affiliate.id, code: affiliate.code })
}

// Atualiza status / comissão
export async function PATCH(req: Request) {
  if (!(await requireSuperadmin())) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const { id, status, commission_type, commission_value, recurrence } = await req.json()
  if (!id) return Response.json({ error: 'id obrigatório' }, { status: 400 })

  const data: any = {}
  if (status && ['active', 'pending', 'rejected', 'suspended'].includes(status)) data.status = status
  if (commission_type && ['percent', 'fixed'].includes(commission_type)) data.commission_type = commission_type
  if (commission_value !== undefined) data.commission_value = Number(commission_value)
  if (recurrence && ['lifetime', '12m', 'first'].includes(recurrence)) data.recurrence = recurrence

  if (Object.keys(data).length === 0) return Response.json({ error: 'Nada para atualizar' }, { status: 400 })

  await globalPrisma.affiliate.update({ where: { id }, data })
  return Response.json({ ok: true })
}

// Exclui afiliado (desvincula os tenants indicados; comissões caem em cascata)
export async function DELETE(req: Request) {
  if (!(await requireSuperadmin())) return Response.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return Response.json({ error: 'id obrigatório' }, { status: 400 })

  try {
    await globalPrisma.tenant.updateMany({ where: { referred_by: id }, data: { referred_by: null } })
    await globalPrisma.affiliate.delete({ where: { id } })
    return Response.json({ ok: true })
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'Erro ao excluir' }, { status: 500 })
  }
}
