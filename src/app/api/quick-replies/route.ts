export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { getTenantPrisma } from '@/lib/prisma-tenant'

async function db() {
  const session = await auth()
  const schemaName = (session?.user as any)?.schemaName
  if (!schemaName) return null
  return getTenantPrisma(schemaName)
}

export async function GET() {
  const client = await db()
  if (!client) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const replies = await client.quickReply.findMany({ orderBy: { shortcut: 'asc' } })
  return Response.json(replies)
}

export async function POST(req: Request) {
  const client = await db()
  if (!client) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { shortcut, content } = await req.json()
  if (!shortcut?.trim() || !content?.trim()) {
    return Response.json({ error: 'Atalho e conteúdo obrigatórios' }, { status: 400 })
  }

  const slug = String(shortcut).trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
  try {
    const reply = await client.quickReply.upsert({
      where: { shortcut: slug },
      update: { content: content.trim() },
      create: { shortcut: slug, content: content.trim() }
    })
    return Response.json(reply)
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'Erro' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: Request) {
  const client = await db()
  if (!client) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json()
  if (!id) return Response.json({ error: 'id obrigatório' }, { status: 400 })
  await client.quickReply.delete({ where: { id } }).catch(() => {})
  return Response.json({ ok: true })
}
