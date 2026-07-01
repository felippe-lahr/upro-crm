export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { getTenantPrisma, globalPrisma } from '@/lib/prisma-tenant'
import { sendAppointmentEmail } from '@/lib/email'

async function db() {
  const session = await auth()
  const schemaName = (session?.user as any)?.schemaName
  if (!schemaName) return null
  return getTenantPrisma(schemaName)
}

export async function GET(req: Request) {
  const prisma = await db()
  if (!prisma) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const where: any = {}
  if (from || to) {
    where.start_at = {}
    if (from) where.start_at.gte = new Date(from)
    if (to) where.start_at.lte = new Date(to)
  }
  const appointments = await prisma.appointment.findMany({
    where,
    orderBy: { start_at: 'asc' },
    include: { service: true, contact: { select: { name: true, phone: true } } }
  })
  return Response.json(appointments)
}

export async function POST(req: Request) {
  const prisma = await db()
  if (!prisma) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { contact_id, service_id, customer_name, customer_phone, customer_email, title, start_at, notes } = body
  if (!start_at) return Response.json({ error: 'start_at obrigatório' }, { status: 400 })

  // Duração e intervalo (gap): do serviço, ou explícito, ou padrão
  let duration = Number(body.duration_min) || 60
  let gapMin = 0
  if (service_id) {
    const svc = await prisma.service.findUnique({ where: { id: service_id } })
    if (svc) { duration = svc.duration_min; gapMin = svc.gap_min || 0 }
  }
  const start = new Date(start_at)
  const end = new Date(start.getTime() + duration * 60 * 1000)

  // Conflito: agendamento que se sobrepõe, considerando o intervalo (gap) do serviço.
  const gapMs = gapMin * 60 * 1000
  const conflict = await prisma.appointment.findFirst({
    where: {
      status: { notIn: ['cancelled', 'no_show'] },
      start_at: { lt: new Date(end.getTime() + gapMs) },
      end_at: { gt: new Date(start.getTime() - gapMs) }
    }
  })
  if (conflict) {
    return Response.json({ error: 'Já existe um agendamento nesse horário.' }, { status: 409 })
  }

  const appointment = await prisma.appointment.create({
    data: {
      contact_id: contact_id || null,
      service_id: service_id || null,
      customer_name: customer_name || null,
      customer_phone: customer_phone || null,
      customer_email: customer_email || null,
      title: title || null,
      start_at: start,
      end_at: end,
      notes: notes || null
    },
    include: { service: true }
  })

  // E-mail de confirmação para agendamentos manuais com e-mail informado.
  if (customer_email) {
    const session = await auth()
    const tenantId = (session?.user as any)?.tenantId
    const tenant = tenantId ? await globalPrisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, email: true } }) : null
    const whenLabel = start.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    })
    sendAppointmentEmail({
      to: customer_email,
      businessName: tenant?.name || 'Agendamento',
      replyTo: tenant?.email,
      serviceName: appointment.service?.name || appointment.title || 'Atendimento',
      whenLabel,
      kind: 'created'
    }).catch((e) => console.error('[appointment email] manual failed', e))
  }
  return Response.json(appointment)
}

export async function PATCH(req: Request) {
  const prisma = await db()
  if (!prisma) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, status, start_at, notes } = await req.json()
  if (!id) return Response.json({ error: 'id obrigatório' }, { status: 400 })

  const data: any = {}
  if (status && ['scheduled', 'confirmed', 'cancelled', 'done', 'no_show'].includes(status)) data.status = status
  if (typeof notes === 'string') data.notes = notes
  if (start_at) {
    const current = await prisma.appointment.findUnique({ where: { id }, include: { service: true } })
    const duration = current?.service?.duration_min
      || (current ? Math.round((current.end_at.getTime() - current.start_at.getTime()) / 60000) : 60)
    const start = new Date(start_at)
    data.start_at = start
    data.end_at = new Date(start.getTime() + duration * 60 * 1000)
  }
  if (Object.keys(data).length === 0) return Response.json({ error: 'Nada para atualizar' }, { status: 400 })

  await prisma.appointment.update({ where: { id }, data })
  return Response.json({ ok: true })
}

export async function DELETE(req: Request) {
  const prisma = await db()
  if (!prisma) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json()
  if (!id) return Response.json({ error: 'id obrigatório' }, { status: 400 })
  await prisma.appointment.delete({ where: { id } })
  return Response.json({ ok: true })
}
