/* eslint-disable @typescript-eslint/no-explicit-any */

// PrismaClient is available after `prisma generate` which runs during deployment.
// Using dynamic require so TypeScript doesn't fail before generate runs.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require('@prisma/client')

type AnyPrismaClient = any

const tenantClients = new Map<string, AnyPrismaClient>()

export function getTenantPrisma(schemaName: string): AnyPrismaClient {
  if (tenantClients.has(schemaName)) {
    return tenantClients.get(schemaName)!
  }

  const client = new PrismaClient({
    datasources: {
      db: {
        url: `${process.env.DATABASE_URL}?schema=${schemaName}`
      }
    }
  })

  tenantClients.set(schemaName, client)
  return client
}

const globalForPrisma = globalThis as unknown as { globalPrisma: AnyPrismaClient }

export const globalPrisma: AnyPrismaClient =
  globalForPrisma.globalPrisma ||
  new PrismaClient({
    datasources: {
      db: { url: `${process.env.DATABASE_URL}?schema=public` }
    }
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.globalPrisma = globalPrisma
}
