export const dynamic = 'force-dynamic'

import { globalPrisma } from '@/lib/prisma-tenant'
import { sendPasswordResetEmail } from '@/lib/email'
import crypto from 'crypto'

/**
 * Solicita a redefinição de senha. Sempre responde sucesso (não revela se o
 * e-mail existe). Se existir um usuário, gera um token de uso único (válido 1h),
 * guarda só o HASH e envia o link por e-mail.
 */
export async function POST(req: Request) {
  const { email } = await req.json().catch(() => ({}))
  const normalized = String(email || '').trim().toLowerCase()

  if (normalized) {
    const user = await globalPrisma.tenantUser.findFirst({ where: { email: normalized } }).catch(() => null)
    if (user) {
      const token = crypto.randomBytes(32).toString('hex')
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
      const expires = new Date(Date.now() + 60 * 60 * 1000) // 1h

      await globalPrisma.passwordReset.create({
        data: { email: normalized, token_hash: tokenHash, expires_at: expires }
      }).catch(() => {})

      const base = process.env.NEXT_PUBLIC_URL || 'https://uprocrm.com.br'
      const resetUrl = `${base}/reset-password?token=${token}`
      await sendPasswordResetEmail({ to: normalized, resetUrl }).catch((e) =>
        console.error('[forgot-password] envio de e-mail falhou', e)
      )
    }
  }

  // Resposta genérica — não vaza se o e-mail existe ou não.
  return Response.json({ ok: true })
}
