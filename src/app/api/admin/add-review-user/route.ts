export const dynamic = 'force-dynamic'

import { globalPrisma } from '@/lib/prisma-tenant'
import bcrypt from 'bcryptjs'

/**
 * Cria um usuário de login ADICIONAL (sem superadmin) dentro de um tenant existente.
 * Serve para dar ao revisor da Meta acesso a uma conta real (com número conectado e
 * conversas), sem expor o painel /admin (que exige role 'superadmin').
 *
 * Protegido pelo NEXTAUTH_SECRET.
 * Uso (navegador):
 *   /api/admin/add-review-user?token=<SECRET>&tenantEmail=<email-do-tenant>&email=<novo-login>&password=<senha>
 *
 * - tenantEmail: email do tenant DONO (ex.: a conta master que tem o WhatsApp conectado)
 * - email: o novo email de login para o revisor (precisa ser único no sistema)
 * - O usuário é criado com role 'admin' (NUNCA superadmin).
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  const tenantEmail = url.searchParams.get('tenantEmail')
  const email = url.searchParams.get('email')
  const password = url.searchParams.get('password')

  if (!token || token !== process.env.NEXTAUTH_SECRET) {
    return Response.json({ error: 'Token inválido' }, { status: 401 })
  }
  if (!tenantEmail || !email || !password) {
    return Response.json({ error: 'Informe ?tenantEmail= &email= &password=' }, { status: 400 })
  }
  if (password.length < 8) {
    return Response.json({ error: 'A senha deve ter ao menos 8 caracteres' }, { status: 400 })
  }

  const tenant = await globalPrisma.tenant.findUnique({ where: { email: tenantEmail } })
  if (!tenant) {
    return Response.json({ error: 'Tenant não encontrado para tenantEmail' }, { status: 404 })
  }

  // O email de login precisa ser único no sistema (o login busca por email).
  const clash = await globalPrisma.tenantUser.findFirst({ where: { email } })
  if (clash) {
    return Response.json({ error: 'Já existe um usuário com esse email. Escolha outro.' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 12)
  await globalPrisma.tenantUser.create({
    data: {
      tenant_id: tenant.id,
      email,
      name: 'Meta Reviewer',
      role: 'admin', // nunca superadmin → sem acesso ao /admin
      password_hash: passwordHash
    }
  })

  return Response.json({
    ok: true,
    message: 'Usuário de revisão criado dentro do tenant. Faz login com esse email/senha.',
    tenant: tenant.email,
    reviewerEmail: email,
    role: 'admin',
    loginUrl: `${process.env.NEXT_PUBLIC_URL}/login`
  })
}
