import type { NextAuthConfig } from 'next-auth'

/**
 * Config base do Auth.js — edge-safe (sem prisma/bcrypt).
 * Usada tanto no middleware (edge) quanto na config completa em auth.ts.
 */
export const authConfig = {
  trustHost: true,
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/login',
    error: '/login'
  },
  session: { strategy: 'jwt' },
  providers: [],
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
  }
} satisfies NextAuthConfig
