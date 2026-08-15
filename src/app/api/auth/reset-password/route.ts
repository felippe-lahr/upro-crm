export const dynamic = 'force-dynamic'

import { globalPrisma } from '@/lib/prisma-tenant'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

/**
 * Efetiva a redefinição de senha a partir do token do e-mail.
 * POST { token, password }. Valida hash + expiração + uso único e atualiza a
 * senha de TODOS os logins com aquele e-mail (normalmente 1).
 */
export async function POST(req: Request) {
  const { token, password } = await req.json().catch(() => ({}))

  if (!token || typeof token !== 'string') {
    return Response.json({ error: 'Token inválido.' }, { status: 400 })
  }
  if (!password || String(password).length < 8) {
    return Response.json({ error: 'A senha deve ter ao menos 8 caracteres.' }, { status: 400 })
  }

  const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex')
  const reset = await globalPrisma.passwordReset.findUnique({ where: { token_hash: tokenHash } }).catch(() => null)

  if (!reset || reset.used || reset.expires_at < new Date()) {
    return Response.json({ error: 'Link expirado ou já utilizado. Solicite um novo.' }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(String(password), 12)
  await globalPrisma.tenantUser.updateMany({
    where: { email: reset.email },
    data: { password_hash: passwordHash }
  })
  await globalPrisma.passwordReset.update({ where: { id: reset.id }, data: { used: true } })

  // Invalida quaisquer outros tokens pendentes do mesmo e-mail.
  await globalPrisma.passwordReset.updateMany({
    where: { email: reset.email, used: false },
    data: { used: true }
  }).catch(() => {})

  return Response.json({ ok: true })
}
