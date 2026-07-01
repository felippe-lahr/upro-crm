export const dynamic = 'force-dynamic'

import { Resend } from 'resend'

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

  const from = `UProCRM (teste) <${process.env.EMAIL_FROM_ADDRESS || 'noreply@uprocrm.com.br'}>`
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const result = await resend.emails.send({
      from,
      to,
      subject: 'Teste de e-mail — UProCRM',
      html: '<p>Se você recebeu este e-mail, o Resend está funcionando. ✅</p>'
    })
    // O SDK do Resend retorna { data, error } — o erro NÃO é lançado.
    return Response.json({
      ok: !result.error,
      from,
      sent_to: to,
      resend_id: result.data?.id || null,
      resend_error: result.error || null,
      has_api_key: !!process.env.RESEND_API_KEY
    }, { status: result.error ? 502 : 200 })
  } catch (e: any) {
    return Response.json({ ok: false, from, error: e?.message || String(e), has_api_key: !!process.env.RESEND_API_KEY }, { status: 500 })
  }
}
