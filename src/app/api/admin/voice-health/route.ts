export const dynamic = 'force-dynamic'

import { isValidAdminToken } from '@/lib/admin-auth'

/**
 * Diagnóstico da transcrição de voz (Groq Whisper).
 * Uso: /api/admin/voice-health?token=<ADMIN_API_SECRET>
 * Confirma se a GROQ_API_KEY está presente/limpa e se autentica no Groq.
 */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token')
  if (!isValidAdminToken(token)) {
    return Response.json({ error: 'Token inválido' }, { status: 401 })
  }

  const raw = process.env.GROQ_API_KEY || ''
  const key = raw.trim()
  const hadWhitespace = raw !== key

  if (!key) {
    return Response.json({ ok: false, reason: 'GROQ_API_KEY ausente' })
  }

  // Verifica a autenticação chamando o endpoint de modelos do Groq.
  let auth_ok = false
  let status = 0
  let detail: string | undefined
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${key}` }
    })
    status = res.status
    auth_ok = res.ok
    if (!res.ok) detail = (await res.text()).slice(0, 300)
  } catch (e: any) {
    detail = e?.message || String(e)
  }

  return Response.json({
    ok: auth_ok,
    groq_key_present: true,
    key_had_trailing_whitespace: hadWhitespace, // se true, era essa a causa
    key_length: key.length,
    groq_status: status,
    detail,
    hint: auth_ok
      ? 'Chave OK — a transcrição de áudio deve funcionar.'
      : 'Groq recusou a chave. Verifique o valor no Railway (sem espaços/quebras).'
  })
}
