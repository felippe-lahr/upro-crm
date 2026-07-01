export const dynamic = 'force-dynamic'

import { sendAppointmentEmail } from '@/lib/email'

/**
 * Teste de envio de e-mail via Resend.
 * Uso: GET /api/admin/test-email?token=<NEXTAUTH_SECRET>&to=voce@exemplo.com
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  if (!token || token !== process.env.NEXTAUTH_SECRET) {
    return Response.json({ error: 'Token inválido' }, { status: 401 })
  }
  const to = searchParams.get('to')
  if (!to) return Response.json({ error: 'Informe ?to=email' }, { status: 400 })

  try {
    await sendAppointmentEmail({
      to,
      businessName: 'UProCRM (teste)',
      replyTo: null,
      serviceName: 'Aula Experimental',
      whenLabel: 'quinta-feira, 03/07/2026 15:00',
      kind: 'created'
    })
    return Response.json({
      ok: true,
      sent_to: to,
      from_address: process.env.EMAIL_FROM_ADDRESS || 'noreply@uprocrm.com.br',
      has_api_key: !!process.env.RESEND_API_KEY
    })
  } catch (e: any) {
    return Response.json({
      ok: false,
      error: e?.message || String(e),
      from_address: process.env.EMAIL_FROM_ADDRESS || 'noreply@uprocrm.com.br',
      has_api_key: !!process.env.RESEND_API_KEY
    }, { status: 500 })
  }
}
