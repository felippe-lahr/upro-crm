export const dynamic = 'force-dynamic'

import { globalPrisma } from '@/lib/prisma-tenant'
import bcrypt from 'bcryptjs'

/**
 * Cria ou promove um usuário a superadmin (BOOTSTRAP — uso único de instalação).
 * GET /api/admin/make-superadmin?token=<ADMIN_API_SECRET|NEXTAUTH_SECRET>&email=<email>&password=<senha>
 *
 * SEGURANÇA: desativado por padrão. Só responde quando ENABLE_BOOTSTRAP_ADMIN=true
 * está setado no ambiente. Como já existe um superadmin, mantenha essa variável
 * DESLIGADA em produção e só ligue por alguns minutos se precisar recriar o acesso.
 */
export async function GET(req: Request) {
  // Porta dos fundos lacrada por padrão — evita criação de superadmin caso o token vaze.
  if (process.env.ENABLE_BOOTSTRAP_ADMIN !== 'true') {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  const email = url.searchParams.get('email')
  const password = url.searchParams.get('password')

  // Aceita o segredo administrativo dedicado (preferido) ou o de sessão (legado).
  const adminSecret = process.env.ADMIN_API_SECRET || process.env.NEXTAUTH_SECRET
  if (!token || token !== adminSecret) {
    return Response.json({ error: 'Token inválido' }, { status: 401 })
  }
  if (!email) {
    return Response.json({ error: 'Informe ?email=' }, { status: 400 })
  }

  // Verifica se já existe usuário com esse email
  const existing = await globalPrisma.tenantUser.findFirst({ where: { email } })

  if (existing) {
    await globalPrisma.tenantUser.update({
      where: { id: existing.id },
      data: { role: 'superadmin' }
    })
    return Response.json({ ok: true, action: 'promoted', email })
  }

  if (!password) {
    return Response.json({ error: 'Usuário não existe. Informe ?password= para criar.' }, { status: 400 })
  }

  // Cria tenant system se não existir
  let systemTenant = await globalPrisma.tenant.findUnique({ where: { slug: 'system' } })
  if (!systemTenant) {
    systemTenant = await globalPrisma.tenant.create({
      data: {
        slug: 'system',
        name: 'System',
        email: email,
        schema_name: 'tenant_system',
        status: 'active',
        plan: 'basic'
      }
    })
  }

  const passwordHash = await bcrypt.hash(password, 12)
  await globalPrisma.tenantUser.create({
    data: {
      tenant_id: systemTenant.id,
      email,
      name: 'Admin',
      role: 'superadmin',
      password_hash: passwordHash
    }
  })

  return Response.json({ ok: true, action: 'created', email, loginUrl: '/login' })
}
