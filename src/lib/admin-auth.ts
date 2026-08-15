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
