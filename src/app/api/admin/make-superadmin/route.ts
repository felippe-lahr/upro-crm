export const dynamic = 'force-dynamic'

import { globalPrisma } from '@/lib/prisma-tenant'
import bcrypt from 'bcryptjs'

/**
 * Cria ou promove um usuário a superadmin.
 * GET /api/admin/make-superadmin?token=<NEXTAUTH_SECRET>&email=<email>&password=<senha>
 * Se o usuário já existir no tenant, apenas eleva o role para superadmin.
 * Se não existir, cria um tenant "system" e um TenantUser com role superadmin.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  const email = url.searchParams.get('email')
  const password = url.searchParams.get('password')

  if (!token || token !== process.env.NEXTAUTH_SECRET) {
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
