/**
 * Camada de IA unificada para o bot.
 *
 * Provedor escolhido por env AI_PROVIDER:
 *   - "anthropic" → Claude (usa ANTHROPIC_API_KEY)
 *   - "groq" (padrão) → Llama via Groq (usa GROQ_API_KEY)
 *
 * Trocar de um para o outro é só mudar a variável AI_PROVIDER no Railway.
 */

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatOptions {
  system: string
  messages: ChatMessage[]
  maxTokens?: number
}

// Provedor: respeita AI_PROVIDER se definido; senão usa Anthropic quando há
// uma chave válida (sk-ant-...), caindo para Groq como alternativa.
function resolveProvider(): 'anthropic' | 'groq' {
  const explicit = (process.env.AI_PROVIDER || '').toLowerCase()
  if (explicit === 'anthropic' || explicit === 'groq') return explicit
  if ((process.env.ANTHROPIC_API_KEY || '').startsWith('sk-ant')) return 'anthropic'
  return 'groq'
}

const PROVIDER = resolveProvider()

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5'
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'

export async function chatComplete({ system, messages, maxTokens = 1024 }: ChatOptions): Promise<string> {
  if (PROVIDER === 'anthropic') {
    return chatAnthropic(system, messages, maxTokens)
  }
  return chatGroq(system, messages, maxTokens)
}

async function chatAnthropic(system: string, messages: ChatMessage[], maxTokens: number): Promise<string> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 60000, maxRetries: 2 })

  const response = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: maxTokens,
    system,
    messages
  })

  // Com thinking adaptativo (padrão no Sonnet 5), a resposta pode ter um bloco
  // "thinking" antes do texto. Junta TODOS os blocos de texto, não só o primeiro.
  return (response.content || [])
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('\n')
    .trim()
}

async function chatGroq(system: string, messages: ChatMessage[], maxTokens: number): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY não configurada')

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      max_tokens: maxTokens,
      messages: [{ role: 'system', content: system }, ...messages]
    })
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Groq chat failed: ${err}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}
