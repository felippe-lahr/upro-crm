export const dynamic = 'force-dynamic'

import { globalPrisma } from '@/lib/prisma-tenant'
import { setAffiliateSession } from '@/lib/affiliate-auth'
import bcrypt from 'bcryptjs'

export async function POST(req: Request) {
  const { email, password } = await req.json()
  if (!email || !password) return Response.json({ error: 'Informe e-mail e senha' }, { status: 400 })

  const affiliate = await globalPrisma.affiliate.findUnique({ where: { email } })
  if (!affiliate || !(await bcrypt.compare(password, affiliate.password_hash))) {
    return Response.json({ error: 'E-mail ou senha inválidos' }, { status: 401 })
  }
  if (affiliate.status === 'pending') return Response.json({ error: 'Sua candidatura ainda está em análise.' }, { status: 403 })
  if (affiliate.status !== 'active') return Response.json({ error: 'Conta de afiliado indisponível.' }, { status: 403 })

  setAffiliateSession(affiliate.id)
  return Response.json({ ok: true })
}
