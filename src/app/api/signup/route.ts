export const dynamic = 'force-dynamic'

import { globalPrisma } from '@/lib/prisma-tenant'
import bcrypt from 'bcryptjs'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function POST(req: Request) {
  const { name, email, password } = await req.json()

  if (!name || !email || !password) {
    return Response.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 })
  }

  if (password.length < 8) {
    return Response.json({ error: 'Senha deve ter ao menos 8 caracteres' }, { status: 400 })
  }

  const existing = await globalPrisma.tenant.findUnique({ where: { email } })
  if (existing) {
    return Response.json({ error: 'Email já cadastrado' }, { status: 409 })
  }

  const baseSlug = slugify(name)
  let slug = baseSlug
  let suffix = 1
  while (await globalPrisma.tenant.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${suffix++}`
  }

  const schemaName = `tenant_${slug.replace(/-/g, '_')}`

  const tenant = await globalPrisma.tenant.create({
    data: {
      name,
      email,
      slug,
      schema_name: schemaName,
      status: 'pending_payment',
      plan: 'trial'
    }
  })

  const passwordHash = await bcrypt.hash(password, 12)
  await globalPrisma.tenantUser.create({
    data: {
      tenant_id: tenant.id,
      email,
      name,
      role: 'admin',
      password_hash: passwordHash
    }
  })

  return Response.json({ tenantId: tenant.id })
}
