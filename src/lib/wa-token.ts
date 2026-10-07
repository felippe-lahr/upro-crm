/**
 * Saúde do token do WhatsApp (Meta Graph API).
 *
 * Tokens de USUÁRIO expiram (horas ou ~60 dias). Tokens de integração/sistema
 * (troca do código do Embedded Signup, Usuário do Sistema) não expiram.
 */

const GRAPH = 'https://graph.facebook.com/v21.0'

function appToken() {
  return `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`
}

export interface TokenInfo {
  valid: boolean
  type: string | null // USER | SYSTEM_USER | ...
  expires_at: Date | null // null = não expira
  error?: string
}

/** Pergunta à Meta se o token é válido, de que tipo é e quando vence. */
export async function inspectToken(token: string): Promise<TokenInfo> {
  try {
    const r = await fetch(`${GRAPH}/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(appToken())}`)
    const d = await r.json()
    const data = d?.data
    if (!data) return { valid: false, type: null, expires_at: null, error: d?.error?.message || 'sem resposta da Meta' }
    const exp = Number(data.expires_at || 0) // 0 = nunca expira
    return {
      valid: !!data.is_valid,
      type: data.type || null,
      expires_at: exp > 0 ? new Date(exp * 1000) : null,
      error: data.is_valid ? undefined : (data.error?.message || 'token inválido')
    }
  } catch (e: any) {
    return { valid: false, type: null, expires_at: null, error: e?.message || String(e) }
  }
}

/** Troca um token de usuário curto por um de longa duração (~60 dias). */
export async function extendUserToken(token: string): Promise<string | null> {
  try {
    const url = `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token` +
      `&client_id=${encodeURIComponent(process.env.META_APP_ID || '')}` +
      `&client_secret=${encodeURIComponent(process.env.META_APP_SECRET || '')}` +
      `&fb_exchange_token=${encodeURIComponent(token)}`
    const d = await (await fetch(url)).json()
    return d?.access_token || null
  } catch {
    return null
  }
}

/** Erro da Meta de token inválido/expirado (OAuthException 190). */
export function isTokenError(message: string | undefined | null): boolean {
  const m = String(message || '')
  return /"code"\s*:\s*190\b|OAuthException.*190|code 190|Error validating access token|Session has expired/i.test(m)
}
