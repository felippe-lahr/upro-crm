export const dynamic = 'force-dynamic'

import { isValidAdminToken } from '@/lib/admin-auth'
import { chatComplete } from '@/lib/ai'

/**
 * Diagnóstico da IA do bot. Faz uma chamada real de teste e devolve o
 * resultado ou o erro exato (billing, modelo inválido, auth, etc.).
 * Uso: /api/admin/ai-health?token=<NEXTAUTH_SECRET>
 */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token')
  if (!isValidAdminToken(token)) {
    return Response.json({ error: 'Token inválido' }, { status: 401 })
  }

  const provider =
    (process.env.AI_PROVIDER || '').toLowerCase() ||
    ((process.env.ANTHROPIC_API_KEY || '').startsWith('sk-ant') ? 'anthropic (auto)' : 'groq (auto)')
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5'
  const hasAnthropicKey = (process.env.ANTHROPIC_API_KEY || '').startsWith('sk-ant')
  const hasGroqKey = !!process.env.GROQ_API_KEY

  const started = Date.now()
  try {
    const reply = await chatComplete({
      maxTokens: 16,
      system: 'Responda apenas com a palavra OK.',
      messages: [{ role: 'user', content: 'ping' }]
    })
    return Response.json({
      ok: true,
      provider, model, hasAnthropicKey, hasGroqKey,
      ms: Date.now() - started,
      reply
    })
  } catch (e: any) {
    // Extrai o máximo de detalhe do erro do SDK/HTTP para diagnóstico.
    return Response.json({
      ok: false,
      provider, model, hasAnthropicKey, hasGroqKey,
      ms: Date.now() - started,
      error: e?.message || String(e),
      status: e?.status ?? e?.statusCode ?? null,
      type: e?.error?.type ?? e?.type ?? null
    }, { status: 200 })
  }
}
