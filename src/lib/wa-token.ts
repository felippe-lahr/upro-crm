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

/**
 * O token pode ATENDER este número (enviar mensagens e baixar mídia)?
 * Ler os dados do número não basta: o token da plataforma consegue ler e mesmo
 * assim recebe "Authorization Error (100)" ao enviar/baixar áudio. Por isso
 * conferimos a permissão whatsapp_business_messaging para a WABA do número.
 */
async function canAccessNumber(token: string, phoneNumberId: string, wabaId?: string | null): Promise<boolean> {
  try {
    const r = await fetch(`${GRAPH}/${phoneNumberId}?fields=id`, { headers: { Authorization: `Bearer ${token}` } })
    if (!r.ok) return false
    if (!wabaId) return false // sem WABA não dá para confirmar a permissão de mensagens
    const d = await (await fetch(`${GRAPH}/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(appToken())}`)).json()
    const scopes: any[] = d?.data?.granular_scopes || []
    const msg = scopes.find((s) => s.scope === 'whatsapp_business_messaging')
    if (!msg) return false
    // Sem target_ids = vale para todas as contas às quais o usuário do sistema tem acesso.
    return !Array.isArray(msg.target_ids) || msg.target_ids.includes(String(wabaId))
  } catch {
    return false
  }
}

/**
 * Tenta usar o token PERMANENTE da plataforma (META_SYSTEM_USER_TOKEN) para este
 * número. Se ainda não tiver acesso e houver META_SYSTEM_USER_ID, usa o token do
 * cliente para atribuir a WABA ao usuário do sistema da plataforma e tenta de novo.
 * Retorna o token permanente quando funcionou; senão, null.
 */
export async function tryPlatformToken(opts: {
  wabaId: string | null | undefined
  phoneNumberId: string
  clientToken?: string | null
}): Promise<{ token: string | null; detail: string }> {
  const sys = (process.env.META_SYSTEM_USER_TOKEN || '').trim()
  if (!sys) return { token: null, detail: 'META_SYSTEM_USER_TOKEN não configurado' }

  if (await canAccessNumber(sys, opts.phoneNumberId, opts.wabaId)) return { token: sys, detail: 'token da plataforma tem permissão de mensagens nesta conta' }

  const sysUserId = (process.env.META_SYSTEM_USER_ID || '').trim()
  if (opts.wabaId && opts.clientToken && sysUserId) {
    try {
      await fetch(`${GRAPH}/${opts.wabaId}/assigned_users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: sysUserId, tasks: ['MANAGE'], access_token: opts.clientToken })
      })
    } catch { /* tenta checar mesmo assim */ }
    if (await canAccessNumber(sys, opts.phoneNumberId, opts.wabaId)) return { token: sys, detail: 'acesso concedido ao token da plataforma' }
    return { token: null, detail: 'não foi possível dar acesso ao token da plataforma' }
  }
  return { token: null, detail: 'token da plataforma sem permissão de mensagens nesta conta (defina META_SYSTEM_USER_ID para atribuir automaticamente no próximo cadastro)' }
}
