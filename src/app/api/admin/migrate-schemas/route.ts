export const dynamic = 'force-dynamic'

import { isValidAdminToken } from '@/lib/admin-auth'
import { globalPrisma } from '@/lib/prisma-tenant'

/**
 * Aplica o schema atual do Prisma em TODOS os schemas de tenants existentes.
 * Necessário quando novos modelos tenant-scoped são adicionados (ex: agendamento).
 * Uso: GET /api/admin/migrate-schemas?token=<NEXTAUTH_SECRET>
 */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token')
  if (!isValidAdminToken(token)) {
    return Response.json({ error: 'Token inválido' }, { status: 401 })
  }

  const tenants = await globalPrisma.tenant.findMany({
    where: { schema_name: { not: '' } },
    select: { slug: true, schema_name: true }
  })

  const { execSync } = await import('child_process')
  const results: Record<string, string> = {}

  for (const t of tenants) {
    if (!t.schema_name) continue
    try {
      await globalPrisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${t.schema_name}"`)
      execSync('npx prisma db push --skip-generate', {
        env: { ...process.env, DATABASE_URL: `${process.env.DATABASE_URL}?schema=${t.schema_name}` },
        cwd: process.cwd(),
        stdio: 'pipe'
      })
      results[t.slug] = 'ok'
    } catch (e) {
      results[t.slug] = e instanceof Error ? e.message.slice(0, 200) : 'erro'
    }
  }

  return Response.json({ ok: true, tenants: tenants.length, results })
}
