export const dynamic = 'force-dynamic'

import { globalPrisma } from '@/lib/prisma-tenant'
import { auth } from '@/lib/auth'
import bcrypt from 'bcryptjs'

const ALLOWED_PLANS = ['trial', 'basic', 'pro', 'promaster']
const ALLOWED_STATUS = ['active', 'suspended', 'pending_payment', 'trial', 'cancelled']

/**
 * Edição de um tenant pelo superadmin (painel do admin).
 * POST { tenantId, name?, email?, status?, plan?, trialDays?, newPassword? }
 * - email: atualiza também o e-mail do usuário de login (mantém o acesso consistente).
 * - trialDays: define trial_ends_at para hoje + N dias (0/negativo limpa o trial).
 * - newPassword: (re)define a senha do login (mín. 8 caracteres).
 */
export async function POST(req: Request) {
  const session = await auth()
  if ((session?.user as any)?.role !== 'superadmin') {
    return Response.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const body = await req.json()
  const { tenantId, name, email, status, plan, trialDays, newPassword, featureSummaryForward } = body
  if (!tenantId) return Response.json({ error: 'tenantId obrigatório' }, { status: 400 })

  const tenant = await globalPrisma.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant) return Response.json({ error: 'Tenant não encontrado' }, { status: 404 })

  if (plan !== undefined && !ALLOWED_PLANS.includes(plan)) {
    return Response.json({ error: `Plano inválido (${ALLOWED_PLANS.join(', ')})` }, { status: 400 })
  }
  if (status !== undefined && !ALLOWED_STATUS.includes(status)) {
    return Response.json({ error: `Status inválido (${ALLOWED_STATUS.join(', ')})` }, { status: 400 })
  }

  const newEmail = typeof email === 'string' ? email.trim().toLowerCase() : undefined
  if (newEmail && newEmail !== tenant.email) {
    const taken = await globalPrisma.tenant.findFirst({ where: { email: newEmail, id: { not: tenantId } } })
    if (taken) return Response.json({ error: 'Já existe um tenant com esse e-mail' }, { status: 409 })
  }

  const data: Record<string, unknown> = {}
  if (typeof name === 'string' && name.trim()) data.name = name.trim()
  if (newEmail) data.email = newEmail
  if (status !== undefined) data.status = status
  if (plan !== undefined) data.plan = plan
  if (trialDays !== undefined && trialDays !== null && trialDays !== '') {
    const days = Number(trialDays)
    data.trial_ends_at = days > 0 ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null
  }
  if (featureSummaryForward !== undefined) data.feature_summary_forward = !!featureSummaryForward

  const updated = await globalPrisma.tenant.update({
    where: { id: tenantId },
    data,
    select: { id: true, name: true, email: true, status: true, plan: true, trial_ends_at: true }
  })

  // Mantém o e-mail do login em sincronia com o e-mail do tenant.
  if (newEmail && newEmail !== tenant.email) {
    await globalPrisma.tenantUser.updateMany({
      where: { tenant_id: tenantId, email: tenant.email },
      data: { email: newEmail }
    }).catch((e: unknown) => console.error('[tenant update] sync login email falhou', e))
  }

  // (Re)define a senha do login, se enviada.
  if (typeof newPassword === 'string' && newPassword.length > 0) {
    if (newPassword.length < 8) {
      return Response.json({ error: 'A senha deve ter ao menos 8 caracteres', tenant: updated }, { status: 400 })
    }
    const passwordHash = await bcrypt.hash(newPassword, 12)
    const loginEmail = updated.email
    const existing = await globalPrisma.tenantUser.findFirst({ where: { tenant_id: tenantId, email: loginEmail } })
    if (existing) {
      await globalPrisma.tenantUser.update({ where: { id: existing.id }, data: { password_hash: passwordHash } })
    } else {
      await globalPrisma.tenantUser.create({
        data: { tenant_id: tenantId, email: loginEmail, name: updated.name, role: 'admin', password_hash: passwordHash }
      })
    }
  }

  return Response.json({ ok: true, tenant: updated })
}
