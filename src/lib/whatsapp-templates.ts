import { decrypt } from './crypto'

export const SUMMARY_TEMPLATE_NAME = 'resumo_atendimento'
const GRAPH = 'https://graph.facebook.com/v21.0'

type WabaTenant = { waba_id?: string | null; whatsapp_token?: string | null }

/**
 * Cria (na WABA do tenant) o template de encaminhamento de resumo, com a
 * estrutura exata que o envio espera: corpo com 2 variáveis ({{1}} = contato,
 * {{2}} = resumo), idioma pt_BR, categoria UTILITY. Idempotente: se o template
 * já existe, retorna ok mantendo o nome. A APROVAÇÃO é assíncrona (Meta revisa).
 */
export async function createSummaryTemplate(
  tenant: WabaTenant,
  name = SUMMARY_TEMPLATE_NAME
): Promise<{ ok: boolean; name: string; status?: string; error?: string; alreadyExists?: boolean }> {
  if (!tenant.waba_id || !tenant.whatsapp_token) return { ok: false, name, error: 'Tenant sem WABA/token' }
  let token: string
  try { token = decrypt(tenant.whatsapp_token) } catch { return { ok: false, name, error: 'Falha ao ler token' } }

  const res = await fetch(`${GRAPH}/${tenant.waba_id}/message_templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      name,
      language: 'pt_BR',
      category: 'UTILITY',
      components: [
        {
          type: 'BODY',
          text: 'Novo resumo de atendimento ({{1}}):\n\n{{2}}',
          example: { body_text: [['João (5511999998888)', 'Cliente quer projeto de interiores e pediu um orçamento.']] }
        }
      ]
    })
  })
  const data = await res.json().catch(() => ({}))
  if (res.ok) return { ok: true, name, status: data?.status || 'PENDING' }

  // Nome já usado → tratamos como sucesso (o template existe, o envio vai usá-lo).
  const msg: string = data?.error?.message || ''
  if (res.status === 400 && /already exists|nome.*existe|already been used/i.test(msg)) {
    return { ok: true, name, alreadyExists: true }
  }
  return { ok: false, name, error: msg || 'Falha ao criar template' }
}

/**
 * Consulta o status do template do resumo na WABA. Retorna 'APPROVED',
 * 'PENDING', 'REJECTED', 'NONE' (não existe) ou null (erro/sem acesso).
 */
export async function getSummaryTemplateStatus(
  tenant: WabaTenant,
  name = SUMMARY_TEMPLATE_NAME
): Promise<{ status: string | null; rejected_reason?: string }> {
  if (!tenant.waba_id || !tenant.whatsapp_token) return { status: null }
  let token: string
  try { token = decrypt(tenant.whatsapp_token) } catch { return { status: null } }

  try {
    const res = await fetch(
      `${GRAPH}/${tenant.waba_id}/message_templates?fields=name,status,rejected_reason&limit=200`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { status: null }
    const all = Array.isArray(data?.data) ? data.data : []
    const match = all.filter((t: any) => t.name === name)
    if (!match.length) return { status: 'NONE' }
    if (match.some((t: any) => t.status === 'APPROVED')) return { status: 'APPROVED' }
    const rejected = match.find((t: any) => t.status === 'REJECTED')
    if (rejected) return { status: 'REJECTED', rejected_reason: rejected.rejected_reason }
    return { status: match[0].status || 'PENDING' }
  } catch {
    return { status: null }
  }
}
