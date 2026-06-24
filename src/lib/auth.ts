import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { globalPrisma } from './prisma-tenant'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await globalPrisma.tenantUser.findFirst({
          where: { email: credentials.email as string },
          include: { tenant: true }
        })

        if (!user) return null

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.password_hash
        )
        if (!valid) return null

        if (user.tenant.status === 'suspended') return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenant_id,
          schemaName: user.tenant.schema_name,
          tenantStatus: user.tenant.status
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
        token.tenantId = (user as any).tenantId
        token.schemaName = (user as any).schemaName
        token.tenantStatus = (user as any).tenantStatus
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        ;(session.user as any).role = token.role
        ;(session.user as any).tenantId = token.tenantId
        ;(session.user as any).schemaName = token.schemaName
        ;(session.user as any).tenantStatus = token.tenantStatus
      }
      return session
    }
  },
  pages: {
    signIn: '/login',
    error: '/login'
  },
  session: { strategy: 'jwt' }
})
