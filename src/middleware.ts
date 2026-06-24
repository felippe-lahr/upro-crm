import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const pathname = req.nextUrl.pathname

  const publicPrefixes = ['/', '/login', '/signup', '/checkout', '/api/webhooks', '/api/billing', '/api/auth']
  const isPublic = publicPrefixes.some((p) =>
    p === '/' ? pathname === '/' : pathname.startsWith(p)
  )

  if (isPublic) {
    return NextResponse.next()
  }

  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (pathname.startsWith('/admin') && token.role !== 'superadmin') {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  const headers = new Headers(req.headers)
  headers.set('x-tenant-id', token.tenantId as string)
  headers.set('x-tenant-schema', token.schemaName as string)
  headers.set('x-user-role', token.role as string)

  return NextResponse.next({ request: { headers } })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
}
