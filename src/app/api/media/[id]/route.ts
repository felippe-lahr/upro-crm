export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { getTenantPrisma } from '@/lib/prisma-tenant'
import { signedMediaUrl } from '@/lib/storage'

/**
 * Exibe uma mídia guardada (imagem/documento) de uma mensagem.
 * O tenant vem SEMPRE da sessão: só quem está logado na empresa dona vê o arquivo.
 * Redireciona para um link temporário (5 min) do armazenamento.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  const schemaName = (session?.user as any)?.schemaName
  if (!schemaName) return new Response('Não autorizado', { status: 401 })

  const db = getTenantPrisma(schemaName)
  const msg = await db.message.findUnique({ where: { id: params.id }, select: { media_url: true } }).catch(() => null)
  if (!msg?.media_url?.startsWith('r2:')) return new Response('Arquivo não disponível', { status: 404 })

  const url = await signedMediaUrl(msg.media_url).catch(() => null)
  if (!url) return new Response('Arquivo não disponível', { status: 404 })
  return Response.redirect(url, 302)
}
