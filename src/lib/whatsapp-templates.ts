import { decrypt } from './crypto'

export const SUMMARY_TEMPLATE_NAME = 'resumo_atendimento'
export const CONSENT_TEMPLATE_NAME = 'consentimento_conversa'
const GRAPH = 'https://graph.facebook.com/v21.0'

/**
 * Cria o template de consentimento (disparo para iniciar conversa). Estrutura:
 *   "Olá {{1}}, somos da {{2}}. {{3}}. Se tiver interesse digite SIM para
 *    continuar. Caso não queira mais receber esta mensagem digite SAIR."
 * {{1}} = nome, {{2}} = empresa, {{3}} = frase livre que o tenant escreve no
 * envio (não exige nova aprovação da Meta). Categoria MARKETING, idioma pt_BR.
 */
export async function createConsentTemplate(
  tenant: WabaTenant,
  name = CONSENT_TEMPLATE_NAME
): Promise<{ ok: boolean; name: string; status?: string; error?: string; detail?: string; subcode?: number; alreadyExists?: boolean }> {
  if (!tenant.waba_id || !tenant.whatsapp_token) return { ok: false, name, error: 'Tenant sem WABA/token' }
  let token: string
  try { token = decrypt(tenant.whatsapp_token) } catch { return { ok: false, name, error: 'Falha ao ler token' } }

  const res = await fetch(`${GRAPH}/${tenant.waba_id}/message_templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      name,
      language: 'pt_BR',
      category: 'MARKETING',
      components: [
        {
          type: 'BODY',
          text:
            'Olá {{1}}, somos da {{2}}. {{3}}. Se tiver interesse digite SIM para continuar. ' +
            'Caso não queira mais receber esta mensagem digite SAIR.',
          example: {
            body_text: [[
              'Maria',
              'Cinthia Claro Arquitetura',
              'temos uma condição especial de projeto de interiores para o seu apartamento'
            ]]
          }
        }
      ]
    })
  })
  const data = await res.json().catch(() => ({}))
  if (res.ok) return { ok: true, name, status: data?.status || 'PENDING' }

  const err = data?.error || {}
  const msg: string = err.message || ''
  const detail: string = err.error_user_msg || err.error_user_title || ''
  const subcode: number | undefined = err.error_subcode
  if (res.status === 400 && /already exists|nome.*existe|already been used/i.test(msg + ' ' + detail)) {
    return { ok: true, name, alreadyExists: true }
  }
  return { ok: false, name, error: msg || 'Falha ao criar template', detail, subcode }
}

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
): Promise<{ ok: boolean; name: string; status?: string; error?: string; detail?: string; subcode?: number; alreadyExists?: boolean }> {
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
          // Precisa de texto fixo suficiente em relação às 2 variáveis, senão a
          // Meta recusa (subcode 2388293: "muitas variáveis para a extensão").
          // Regras da Meta: variável não pode ficar no início nem no fim do texto,
          // e precisa de texto fixo suficiente. Por isso há texto antes de {{1}} e
          // depois de {{2}}.
          text:
            'Você recebeu um novo resumo de atendimento pelo seu assistente virtual no UProCRM. ' +
            'Confira os dados abaixo e entre em contato com o cliente assim que possível.\n\n' +
            'Contato: {{1}}\n\n' +
            'Resumo do atendimento: {{2}}\n\n' +
            'Mensagem automática do seu CRM. Bom atendimento!',
          example: { body_text: [['João (5511999998888)', 'Cliente quer projeto de interiores e pediu um orçamento.']] }
        }
      ]
    })
  })
  const data = await res.json().catch(() => ({}))
  if (res.ok) return { ok: true, name, status: data?.status || 'PENDING' }

  // Nome já usado → tratamos como sucesso (o template existe, o envio vai usá-lo).
  const err = data?.error || {}
  const msg: string = err.message || ''
  const detail: string = err.error_user_msg || err.error_user_title || ''
  const subcode: number | undefined = err.error_subcode
  if (res.status === 400 && /already exists|nome.*existe|already been used/i.test(msg + ' ' + detail)) {
    return { ok: true, name, alreadyExists: true }
  }
  return { ok: false, name, error: msg || 'Falha ao criar template', detail, subcode }
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
