export const dynamic = 'force-dynamic'

import { isValidAdminToken } from '@/lib/admin-auth'
import { globalPrisma } from '@/lib/prisma-tenant'
import bcrypt from 'bcryptjs'

/**
 * Define (ou redefine) a senha de login de um tenant — atalho de teste/admin.
 * Protegido pelo NEXTAUTH_SECRET. Cria o usuário de login se ainda não existir.
 *
 * Uso (navegador):
 *   /api/admin/set-password?token=<NEXTAUTH_SECRET>&email=<email>&password=<nova-senha>
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  const email = url.searchParams.get('email')
  const password = url.searchParams.get('password')

  if (!isValidAdminToken(token)) {
    return Response.json({ error: 'Token inválido' }, { status: 401 })
  }
  if (!email || !password) {
    return Response.json({ error: 'Informe ?email= e ?password=' }, { status: 400 })
  }
  if (password.length < 8) {
    return Response.json({ error: 'A senha deve ter ao menos 8 caracteres' }, { status: 400 })
  }

  const tenant = await globalPrisma.tenant.findUnique({ where: { email } })
  if (!tenant) {
    return Response.json({ error: 'Tenant não encontrado para esse email' }, { status: 404 })
  }

  const passwordHash = await bcrypt.hash(password, 12)

  // Cria ou atualiza o usuário de login do tenant (por tenant_id + email).
  const existing = await globalPrisma.tenantUser.findFirst({
    where: { tenant_id: tenant.id, email }
  })
  if (existing) {
    await globalPrisma.tenantUser.update({
      where: { id: existing.id },
      data: { password_hash: passwordHash }
    })
  } else {
    await globalPrisma.tenantUser.create({
      data: {
        tenant_id: tenant.id,
        email,
        name: tenant.name,
        role: 'admin',
        password_hash: passwordHash
      }
    })
  }

  return Response.json({
    ok: true,
    message: 'Senha definida. Faça login com esse email e a nova senha.',
    loginUrl: `${process.env.NEXT_PUBLIC_URL}/login`,
    email
  })
}
