export const dynamic = 'force-dynamic'

import bcrypt from 'bcryptjs'
import { auth } from '@/lib/auth'
import { globalPrisma } from '@/lib/prisma-tenant'

const ROLES = ['admin', 'agent']

/** Sessão + checagem de admin do tenant. O tenant vem SEMPRE da sessão. */
async function ctx() {
  const session = await auth()
  const u = session?.user as any
  const tenantId = u?.tenantId as string | undefined
  const isAdmin = ['admin', 'superadmin'].includes(u?.role)
  return { tenantId, isAdmin, userId: u?.id as string | undefined }
}

/** Lista a equipe do tenant (qualquer usuário logado pode ver). */
export async function GET() {
  const { tenantId, isAdmin, userId } = await ctx()
  if (!tenantId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const members = await globalPrisma.tenantUser.findMany({
    where: { tenant_id: tenantId },
    select: { id: true, name: true, email: true, role: true, created_at: true },
    orderBy: { created_at: 'asc' }
  })
  return Response.json({ members, me: userId, canManage: isAdmin })
}

/** Cria um acesso para a equipe. POST { name, email, password, role } — só admin. */
export async function POST(req: Request) {
  const { tenantId, isAdmin } = await ctx()
  if (!tenantId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin) return Response.json({ error: 'Só o administrador da conta pode adicionar pessoas.' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const name = String(body.name || '').trim().slice(0, 80)
  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')
  const role = ROLES.includes(body.role) ? body.role : 'agent'

  if (!name) return Response.json({ error: 'Informe o nome.' }, { status: 400 })
  if (!/^\S+@\S+\.\S+$/.test(email)) return Response.json({ error: 'E-mail inválido.' }, { status: 400 })
  if (password.length < 8) return Response.json({ error: 'A senha precisa ter pelo menos 8 caracteres.' }, { status: 400 })

  // O login busca o usuário só pelo e-mail, então o e-mail precisa ser único na plataforma.
  const taken = await globalPrisma.tenantUser.findFirst({ where: { email } })
  if (taken) return Response.json({ error: 'Este e-mail já tem um acesso no UProCRM.' }, { status: 409 })

  const member = await globalPrisma.tenantUser.create({
    data: { tenant_id: tenantId, name, email, role, password_hash: await bcrypt.hash(password, 12) },
    select: { id: true, name: true, email: true, role: true, created_at: true }
  })
  return Response.json({ member })
}

/** Redefine senha ou papel. PATCH { id, password?, role? } — só admin. */
export async function PATCH(req: Request) {
  const { tenantId, isAdmin, userId } = await ctx()
  if (!tenantId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin) return Response.json({ error: 'Só o administrador da conta pode alterar acessos.' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const target = await globalPrisma.tenantUser.findFirst({ where: { id: String(body.id || ''), tenant_id: tenantId } })
  if (!target) return Response.json({ error: 'Pessoa não encontrada.' }, { status: 404 })

  const data: any = {}
  if (body.password !== undefined) {
    if (String(body.password).length < 8) return Response.json({ error: 'A senha precisa ter pelo menos 8 caracteres.' }, { status: 400 })
    data.password_hash = await bcrypt.hash(String(body.password), 12)
  }
  if (body.role !== undefined) {
    if (!ROLES.includes(body.role)) return Response.json({ error: 'Papel inválido.' }, { status: 400 })
    if (target.id === userId && body.role !== 'admin') {
      return Response.json({ error: 'Você não pode tirar o seu próprio acesso de administrador.' }, { status: 400 })
    }
    if (target.role === 'superadmin') return Response.json({ error: 'Este acesso não pode ser alterado aqui.' }, { status: 403 })
    data.role = body.role
  }
  if (!Object.keys(data).length) return Response.json({ error: 'Nada para alterar.' }, { status: 400 })

  await globalPrisma.tenantUser.update({ where: { id: target.id }, data })
  return Response.json({ ok: true })
}

/** Remove um acesso. DELETE ?id= — só admin, não pode remover a si mesmo. */
export async function DELETE(req: Request) {
  const { tenantId, isAdmin, userId } = await ctx()
  if (!tenantId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin) return Response.json({ error: 'Só o administrador da conta pode remover pessoas.' }, { status: 403 })

  const id = new URL(req.url).searchParams.get('id') || ''
  if (id === userId) return Response.json({ error: 'Você não pode remover o seu próprio acesso.' }, { status: 400 })

  const target = await globalPrisma.tenantUser.findFirst({ where: { id, tenant_id: tenantId } })
  if (!target) return Response.json({ error: 'Pessoa não encontrada.' }, { status: 404 })
  if (target.role === 'superadmin') return Response.json({ error: 'Este acesso não pode ser removido aqui.' }, { status: 403 })

  await globalPrisma.tenantUser.delete({ where: { id: target.id } })
  return Response.json({ ok: true })
}
