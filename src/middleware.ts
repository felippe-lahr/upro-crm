import NextAuth from 'next-auth'
import { NextResponse } from 'next/server'
import { authConfig } from '@/lib/auth.config'

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const pathname = req.nextUrl.pathname
  const session = req.auth
  const user = session?.user as any

  const publicPrefixes = ['/login', '/signup', '/checkout']
  const isPublic =
    pathname === '/' || publicPrefixes.some((p) => pathname.startsWith(p))

  if (isPublic) {
    return NextResponse.next()
  }

  if (!session) {
    return NextResponse.redirect(new URL('/login', req.nextUrl))
  }

  if (pathname.startsWith('/admin') && user?.role !== 'superadmin') {
    return NextResponse.redirect(new URL('/dashboard', req.nextUrl))
  }

  return NextResponse.next()
})

export const config = {
  // /api fica de fora — cada rota valida auth internamente
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)']
}
