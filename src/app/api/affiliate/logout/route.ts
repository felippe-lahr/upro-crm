export const dynamic = 'force-dynamic'

import { clearAffiliateSession } from '@/lib/affiliate-auth'

export async function POST() {
  clearAffiliateSession()
  return Response.json({ ok: true })
}
