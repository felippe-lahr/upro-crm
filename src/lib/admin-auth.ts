/**
 * Autenticação dos endpoints administrativos/diagnóstico.
 *
 * Usa um segredo DEDICADO (`ADMIN_API_SECRET`), separado do `NEXTAUTH_SECRET`
 * (que passa a servir só para assinar as sessões de login). Enquanto o
 * `ADMIN_API_SECRET` não estiver configurado, cai de volta para o `NEXTAUTH_SECRET`
 * como transição — assim que a variável for criada no ambiente, o secret de
 * sessão deixa de valer para administração.
 */
export function adminSecret(): string | undefined {
  return process.env.ADMIN_API_SECRET || process.env.NEXTAUTH_SECRET
}

export function isValidAdminToken(token: string | null | undefined): boolean {
  const expected = adminSecret()
  return !!expected && !!token && token === expected
}

/**
 * Acesso aos endpoints de diagnóstico: aceita o token de administração (uso por
 * URL) OU a sessão de um superadmin logado (uso pelo painel /admin, sem expor a
 * chave na URL).
 */
export async function isAdminRequest(token: string | null | undefined): Promise<boolean> {
  if (isValidAdminToken(token)) return true
  try {
    const { auth } = await import('./auth')
    const session = await auth()
    return (session?.user as any)?.role === 'superadmin'
  } catch {
    return false
  }
}
