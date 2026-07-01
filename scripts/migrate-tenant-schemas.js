/**
 * Aplica o schema atual do Prisma em TODOS os schemas de tenants.
 * Roda no start do deploy, logo após o `prisma db push` do schema público.
 *
 * É resiliente: erros em um tenant são logados mas NÃO interrompem o boot
 * (sempre sai com código 0), para que um schema problemático não derrube o app.
 */
const { execSync } = require('child_process')
const { PrismaClient } = require('@prisma/client')

async function main() {
  const baseUrl = process.env.DATABASE_URL
  if (!baseUrl) {
    console.log('[migrate-tenants] DATABASE_URL ausente — pulando.')
    return
  }

  const prisma = new PrismaClient({ datasources: { db: { url: `${baseUrl}?schema=public` } } })
  let tenants = []
  try {
    tenants = await prisma.tenant.findMany({
      where: { schema_name: { not: '' } },
      select: { slug: true, schema_name: true }
    })
  } catch (e) {
    console.error('[migrate-tenants] falha ao listar tenants:', e && e.message)
    await prisma.$disconnect().catch(() => {})
    return
  }

  console.log(`[migrate-tenants] aplicando schema em ${tenants.length} tenant(s)…`)
  let ok = 0
  for (const t of tenants) {
    if (!t.schema_name) continue
    try {
      await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${t.schema_name}"`)
      execSync('npx prisma db push --skip-generate', {
        env: { ...process.env, DATABASE_URL: `${baseUrl}?schema=${t.schema_name}` },
        stdio: 'pipe'
      })
      ok++
    } catch (e) {
      console.error(`[migrate-tenants] ${t.slug}: ${(e && e.message ? e.message : 'erro').slice(0, 200)}`)
    }
  }
  console.log(`[migrate-tenants] concluído: ${ok}/${tenants.length} ok`)
  await prisma.$disconnect().catch(() => {})
}

main().catch((e) => {
  console.error('[migrate-tenants] erro inesperado:', e && e.message)
}).finally(() => process.exit(0))
