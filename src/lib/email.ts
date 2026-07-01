import { Resend } from 'resend'

function getResend(): Resend {
  return new Resend(process.env.RESEND_API_KEY)
}

export async function sendWelcomeEmail({
  to,
  name,
  loginUrl
}: {
  to: string
  name: string
  loginUrl: string
}) {
  await getResend().emails.send({
    from: 'UProCRM <noreply@uprocrm.com.br>',
    to,
    subject: 'Bem-vindo ao UProCRM! Seu CRM está pronto.',
    html: `
      <h1>Olá, ${name}!</h1>
      <p>Seu CRM WhatsApp está pronto para uso.</p>
      <p>
        <a href="${loginUrl}" style="
          background:#25D366;color:#fff;padding:12px 24px;
          border-radius:6px;text-decoration:none;font-weight:bold;
        ">Acessar meu CRM</a>
      </p>
      <p>Próximo passo: conecte seu número WhatsApp Business no painel de configurações.</p>
      <hr/>
      <small>UProCRM — CRM para WhatsApp Business</small>
    `
  })
}

/**
 * E-mail de confirmação de agendamento, enviado em nome do negócio (tenant).
 * kind: 'created' (acabou de agendar) | 'confirmed' (cliente confirmou presença).
 */
export async function sendAppointmentEmail({
  to,
  businessName,
  replyTo,
  serviceName,
  whenLabel,
  kind
}: {
  to: string
  businessName: string
  replyTo?: string | null
  serviceName: string
  whenLabel: string
  kind: 'created' | 'confirmed'
}) {
  const title = kind === 'confirmed' ? 'Agendamento confirmado ✅' : 'Agendamento realizado 📅'
  const intro = kind === 'confirmed'
    ? 'Seu horário está confirmado. Esperamos por você!'
    : 'Recebemos seu agendamento. Veja os detalhes abaixo.'

  await getResend().emails.send({
    from: `${businessName} <noreply@uprocrm.com.br>`,
    to,
    replyTo: replyTo || undefined,
    subject: `${title} — ${businessName}`,
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#0f172a">
        <h1 style="font-size:20px;margin:0 0 8px">${title}</h1>
        <p style="margin:0 0 16px;color:#334155">${intro}</p>
        <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:8px">
          <tr><td style="padding:12px 16px;color:#64748b">Serviço</td><td style="padding:12px 16px;font-weight:bold;text-align:right">${serviceName}</td></tr>
          <tr><td style="padding:12px 16px;color:#64748b;border-top:1px solid #e2e8f0">Data e horário</td><td style="padding:12px 16px;font-weight:bold;text-align:right;border-top:1px solid #e2e8f0">${whenLabel}</td></tr>
        </table>
        <p style="margin:16px 0 0;color:#64748b;font-size:13px">Você receberá um lembrete um dia antes e no dia do agendamento.</p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0"/>
        <small style="color:#94a3b8">${businessName} — enviado via UProCRM</small>
      </div>
    `
  })
}

export async function sendPasswordResetEmail({
  to,
  resetUrl
}: {
  to: string
  resetUrl: string
}) {
  await getResend().emails.send({
    from: 'UProCRM <noreply@uprocrm.com.br>',
    to,
    subject: 'Redefinir senha — UProCRM',
    html: `
      <p>Clique no link abaixo para redefinir sua senha:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>Este link expira em 1 hora.</p>
    `
  })
}
