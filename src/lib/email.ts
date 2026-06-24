import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendWelcomeEmail({
  to,
  name,
  loginUrl
}: {
  to: string
  name: string
  loginUrl: string
}) {
  await resend.emails.send({
    from: 'WaCRM <noreply@wacrm.com.br>',
    to,
    subject: 'Bem-vindo ao WaCRM! Seu CRM está pronto.',
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
      <small>WaCRM — CRM para WhatsApp Business</small>
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
  await resend.emails.send({
    from: 'WaCRM <noreply@wacrm.com.br>',
    to,
    subject: 'Redefinir senha — WaCRM',
    html: `
      <p>Clique no link abaixo para redefinir sua senha:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>Este link expira em 1 hora.</p>
    `
  })
}
