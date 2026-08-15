import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { globalPrisma } from './prisma-tenant'
import { authConfig } from './auth.config'

// Proteção contra força bruta: trava o e-mail após muitas tentativas falhas
// numa janela curta (em memória — suficiente para o servidor persistente do Railway).
const MAX_FAILS = 6
const LOCK_WINDOW_MS = 15 * 60 * 1000
const loginFails = new Map<string, { count: number; first: number }>()

function isLocked(email: string): boolean {
  const rec = loginFails.get(email)
  if (!rec) return false
  if (Date.now() - rec.first > LOCK_WINDOW_MS) { loginFails.delete(email); return false }
  return rec.count >= MAX_FAILS
}
function registerFail(email: string) {
  const rec = loginFails.get(email)
  if (!rec || Date.now() - rec.first > LOCK_WINDOW_MS) loginFails.set(email, { count: 1, first: Date.now() })
  else rec.count++
}
function clearFails(email: string) { loginFails.delete(email) }

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const email = String(credentials.email).trim().toLowerCase()

        // Trava por força bruta: após muitas falhas, recusa por 15 min.
        if (isLocked(email)) return null

        const user = await globalPrisma.tenantUser.findFirst({
          where: { email },
          include: { tenant: true }
        })

        if (!user) { registerFail(email); return null }

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.password_hash
        )
        if (!valid) { registerFail(email); return null }

        clearFails(email)

        if (['suspended', 'cancelled'].includes(user.tenant.status) && user.role !== 'superadmin') {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenant_id,
          schemaName: user.tenant.schema_name,
          tenantStatus: user.tenant.status
        } as any
      }
    })
  ]
})
