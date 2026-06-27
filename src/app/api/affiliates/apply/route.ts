export const dynamic = 'force-dynamic'

import { globalPrisma } from '@/lib/prisma-tenant'
import bcrypt from 'bcryptjs'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 20)
}

export async function POST(req: Request) {
  const { name, email, password, pix_key } = await req.json()

  if (!name || !email || !password) {
    return Response.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 })
  }
  if (String(password).length < 8) {
    return Response.json({ error: 'Senha deve ter ao menos 8 caracteres' }, { status: 400 })
  }

  const existing = await globalPrisma.affiliate.findUnique({ where: { email } })
  if (existing) {
    return Response.json({ error: 'Já existe uma candidatura com esse e-mail' }, { status: 409 })
  }

  // Gera um código único a partir do nome
  const base = slugify(name) || 'afiliado'
  let code = base
  let suffix = 1
  while (await globalPrisma.affiliate.findUnique({ where: { code } })) {
    code = `${base}${suffix++}`
  }

  const passwordHash = await bcrypt.hash(password, 12)
  await globalPrisma.affiliate.create({
    data: {
      name,
      email,
      code,
      password_hash: passwordHash,
      pix_key: pix_key || null,
      status: 'pending'
    }
  })

  return Response.json({ ok: true })
}
