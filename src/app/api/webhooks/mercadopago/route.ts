export const dynamic = 'force-dynamic'

import { provisionTenant } from '@/lib/provision-tenant'
import { globalPrisma, getTenantPrisma } from '@/lib/prisma-tenant'
import { generateAffiliateCommission } from '@/lib/affiliate'
import { decrypt } from '@/lib/crypto'
import { getPixPaymentStatus } from '@/lib/pix'
import { sendAppointmentEmail } from '@/lib/email'
import { sendWhatsAppMessage } from '@/lib/bot'
import crypto from 'crypto'

// Confirma (ou expira) uma pré-reserva de agendamento a partir de um pagamento Pix.
async function handleAppointmentPayment(paymentId: string) {
  const map = await globalPrisma.appointmentPayment.findUnique({ where: { payment_id: paymentId } })
  if (!map || map.status === 'approved') return

  const tenant = await globalPrisma.tenant.findUnique({ where: { id: map.tenant_id } })
  if (!tenant?.mp_access_token) return

  let status = 'pending'
  try {
    status = await getPixPaymentStatus(decrypt(tenant.mp_access_token), paymentId)
  } catch (e) {
    console.error('[MP webhook] failed to fetch pix payment', e)
    return
  }
  if (status !== 'approved') return

  const db = getTenantPrisma(map.schema_name)
  const appt: any = await db.appointment.findUnique({ where: { id: map.appointment_id }, include: { service: true } }).catch(() => null)
  if (!appt || appt.status === 'confirmed') return

  await db.appointment.update({ where: { id: map.appointment_id }, data: { status: 'confirmed', payment_status: 'approved', hold_expires_at: null } })
  await globalPrisma.appointmentPayment.update({ where: { payment_id: paymentId }, data: { status: 'approved' } })

  const whenLabel = new Date(appt.start_at).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
  const serviceName = appt.service?.name || appt.title || 'Atendimento'

  // Avisa o cliente no WhatsApp.
  const to = (appt.customer_phone || '').replace(/\D/g, '')
  if (to && tenant.phone_number_id && tenant.whatsapp_token) {
    await sendWhatsAppMessage(
      { phone_number_id: tenant.phone_number_id, whatsapp_token: tenant.whatsapp_token },
      to,
      `Pagamento confirmado! ✅ Seu horário (${serviceName} — ${whenLabel}) está *garantido*. Até lá! 🙌`
    ).catch((e) => console.error('[MP webhook] wa confirm failed', e))
  }
  // E-mail de confirmação.
  if (appt.customer_email) {
    sendAppointmentEmail({
      to: appt.customer_email, businessName: tenant.name, replyTo: tenant.email,
      serviceName, whenLabel, kind: 'confirmed', attendeeName: appt.customer_name, bookedBy: appt.booked_by
    }).catch((e) => console.error('[MP webhook] email confirm failed', e))
  }
}

// Pagamento único do plano ANUAL (12x) na conta da plataforma → ativa o tenant.
// external_reference = tenantId (os pagamentos de agendamento usam "appt:...").
async function handleSubscriptionPayment(paymentId: string) {
  const { MercadoPagoConfig, Payment } = await import('mercadopago')
  const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! })

  let pay: any
  try {
    pay = await new Payment(client).get({ id: paymentId })
  } catch {
    // Pagamento não pertence à conta da plataforma (ex.: Pix de agendamento no MP do lojista).
    return
  }

  const extRef: string | undefined = pay?.external_reference
  if (!extRef || extRef.startsWith('appt:')) return // não é um pagamento de plano
  if (pay.status !== 'approved') return

  const tenant = await globalPrisma.tenant.findUnique({ where: { id: extRef } })
  if (!tenant || tenant.status === 'active') return // inexistente ou já ativado

  await provisionTenant(extRef)
  const amount = Number(pay.transaction_amount || 0)
  if (amount > 0) await generateAffiliateCommission(extRef, amount)
  console.log('[MP webhook] annual plan activated', { tenantId: extRef, amount })
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function verifyMPSignature(req: Request, body: string): boolean {
  const xSignature = req.headers.get('x-signature')
  const xRequestId = req.headers.get('x-request-id')
  const dataId = new URL(req.url).searchParams.get('data.id') || ''

  if (!xSignature) return false

  const parts = Object.fromEntries(
    xSignature.split(',').map((p) => p.trim().split('=') as [string, string])
  )

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${parts['ts']};`
  const expected = crypto
    .createHmac('sha256', process.env.MP_WEBHOOK_SECRET || process.env.MP_ACCESS_TOKEN!)
    .update(manifest)
    .digest('hex')

  return parts['v1'] === expected
}

export async function POST(req: Request) {
  const rawBody = await req.text()
  const body = JSON.parse(rawBody)

  console.log('[MP webhook]', JSON.stringify(body))

  if (body.type === 'subscription_preapproval') {
    const subscriptionId = body.data?.id
    if (!subscriptionId) return Response.json({ ok: true })

    // Fetch full subscription details from MP (webhook only sends the ID)
    const { MercadoPagoConfig, PreApproval } = await import('mercadopago')
    const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! })
    const preApproval = new PreApproval(client)

    let subscription: any
    try {
      subscription = await preApproval.get({ id: subscriptionId })
    } catch (err) {
      console.error('[MP webhook] failed to fetch subscription', err)
      return Response.json({ ok: true })
    }

    console.log('[MP webhook] subscription', JSON.stringify({ status: subscription.status, external_reference: subscription.external_reference }))

    const tenantId = subscription.external_reference
    if (!tenantId) return Response.json({ ok: true })

    if (subscription.status === 'authorized') {
      await globalPrisma.tenant.update({
        where: { id: tenantId },
        data: { mp_subscription_id: subscriptionId }
      })
      await provisionTenant(tenantId)
      // Primeira comissão do afiliado (mês da ativação)
      const amount = Number(subscription.auto_recurring?.transaction_amount || 0)
      if (amount > 0) await generateAffiliateCommission(tenantId, amount)
    } else if (['cancelled', 'paused'].includes(subscription.status)) {
      await globalPrisma.tenant.update({
        where: { id: tenantId },
        data: { status: subscription.status === 'paused' ? 'suspended' : 'cancelled' }
      })
    }
  }

  // Pagamento único → pode ser sinal de agendamento (Pix) OU plano anual (12x).
  if (body.type === 'payment' && body.data?.id) {
    const paymentId = String(body.data.id)
    try { await handleAppointmentPayment(paymentId) }
    catch (err) { console.error('[MP webhook] appointment payment failed', err) }
    try { await handleSubscriptionPayment(paymentId) }
    catch (err) { console.error('[MP webhook] annual plan payment failed', err) }
  }

  // Pagamento recorrente mensal da assinatura → comissão do mês
  if (body.type === 'subscription_authorized_payment') {
    const paymentId = body.data?.id
    if (!paymentId) return Response.json({ ok: true })
    try {
      const { MercadoPagoConfig, PreApproval } = await import('mercadopago')
      const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! })
      // O evento traz o preapproval_id; resolvemos o tenant por ele
      const preapprovalId = body.data?.preapproval_id || body.preapproval_id
      if (preapprovalId) {
        const subscription: any = await new PreApproval(client).get({ id: preapprovalId })
        const tenantId = subscription.external_reference
        const amount = Number(subscription.auto_recurring?.transaction_amount || 0)
        if (tenantId && amount > 0) await generateAffiliateCommission(tenantId, amount)
      }
    } catch (err) {
      console.error('[MP webhook] recurring commission failed', err)
    }
  }

  return Response.json({ ok: true })
}
