import { globalPrisma } from './prisma-tenant'
import { sendWelcomeEmail } from './email'

export async function provisionTenant(tenantId: string) {
  const tenant = await globalPrisma.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant) throw new Error('Tenant not found')

  const schemaName = `tenant_${tenant.slug.replace(/-/g, '_')}`

  await globalPrisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`)

  await runMigrationsForSchema(schemaName)

  await globalPrisma.tenant.update({
    where: { id: tenantId },
    data: {
      schema_name: schemaName,
      status: 'active',
      // preserva o plano escolhido no checkout (basic/pro); só normaliza 'trial'
      ...(tenant.plan === 'trial' || !tenant.plan ? { plan: 'basic' } : {}),
      trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  })

  try {
    await sendWelcomeEmail({
      to: tenant.email,
      name: tenant.name,
      loginUrl: `${process.env.NEXT_PUBLIC_URL}/login`
    })
  } catch (error) {
    console.error('[provisionTenant] welcome email failed (non-fatal):', error)
  }
}

async function runMigrationsForSchema(schemaName: string) {
  const { execSync } = await import('child_process')
  execSync(
    `npx prisma db push --skip-generate`,
    {
      env: {
        ...process.env,
        DATABASE_URL: `${process.env.DATABASE_URL}?schema=${schemaName}`
      },
      cwd: process.cwd()
    }
  )
}
