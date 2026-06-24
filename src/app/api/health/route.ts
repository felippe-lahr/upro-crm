export const dynamic = 'force-dynamic'

import { globalPrisma } from '@/lib/prisma-tenant'

export async function GET() {
  const result: Record<string, unknown> = {
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    databaseHost: process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || null
  }

  const start = Date.now()
  try {
    await globalPrisma.$queryRaw`SELECT 1`
    result.db = 'ok'
    result.dbLatencyMs = Date.now() - start
  } catch (error) {
    result.db = 'error'
    result.dbLatencyMs = Date.now() - start
    result.error = error instanceof Error ? error.message : String(error)
  }

  // contar tenants existentes
  try {
    result.tenantCount = await globalPrisma.tenant.count()
  } catch (error) {
    result.tenantCountError = error instanceof Error ? error.message : String(error)
  }

  return Response.json(result)
}
