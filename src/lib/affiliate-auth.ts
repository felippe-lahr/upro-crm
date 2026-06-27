import crypto from 'crypto'
import { cookies } from 'next/headers'

const COOKIE = 'aff_session'
const MAX_AGE = 60 * 60 * 24 * 30 // 30 dias

function secret() {
  return process.env.NEXTAUTH_SECRET || 'dev-secret'
}

function b64url(s: string) {
  return Buffer.from(s).toString('base64url')
}

export function signAffiliateToken(affiliateId: string): string {
  const payload = b64url(JSON.stringify({ id: affiliateId, exp: Date.now() + MAX_AGE * 1000 }))
  const sig = crypto.createHmac('sha256', secret()).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export function verifyAffiliateToken(token: string): string | null {
  try {
    const [payload, sig] = token.split('.')
    if (!payload || !sig) return null
    const expected = crypto.createHmac('sha256', secret()).update(payload).digest('base64url')
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString())
    if (!data.exp || data.exp < Date.now()) return null
    return data.id as string
  } catch {
    return null
  }
}

export function setAffiliateSession(affiliateId: string) {
  cookies().set(COOKIE, signAffiliateToken(affiliateId), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE
  })
}

export function clearAffiliateSession() {
  cookies().set(COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
}

export function getAffiliateId(): string | null {
  const token = cookies().get(COOKIE)?.value
  if (!token) return null
  return verifyAffiliateToken(token)
}
