import { decrypt } from './crypto'

export interface TranscriptionResult {
  text: string | null
  error?: string // motivo legível quando não foi possível transcrever
}

/**
 * Baixa um áudio recebido no WhatsApp e o transcreve para texto, informando o
 * motivo quando falha (para aparecer na conversa e no diagnóstico).
 * Usa a API de transcrição da Groq (compatível com OpenAI, Whisper).
 */
export async function transcribeWhatsAppAudioDetailed(
  tenant: { phone_number_id: string; whatsapp_token: string },
  mediaId: string
): Promise<TranscriptionResult> {
  const apiKey = (process.env.GROQ_API_KEY || '').trim()
  if (!apiKey) return { text: null, error: 'transcrição desligada (GROQ_API_KEY ausente)' }
  if (!mediaId) return { text: null, error: 'áudio sem identificador' }

  let token: string
  try {
    token = decrypt(tenant.whatsapp_token)
  } catch {
    return { text: null, error: 'token do WhatsApp inválido' }
  }

  try {
    // 1) Resolve a URL do mídia
    const metaRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!metaRes.ok) {
      const t = (await metaRes.text()).slice(0, 160)
      return { text: null, error: `Meta recusou o áudio (HTTP ${metaRes.status}) ${t}` }
    }
    const meta = await metaRes.json()
    if (!meta.url) return { text: null, error: 'Meta não devolveu o link do áudio' }

    // 2) Baixa o binário do áudio
    const audioRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${token}` } })
    if (!audioRes.ok) return { text: null, error: `falha ao baixar o áudio (HTTP ${audioRes.status})` }
    const audioBuffer = await audioRes.arrayBuffer()
    const mime = meta.mime_type || audioRes.headers.get('content-type') || 'audio/ogg'

    // 3) Transcreve (Groq Whisper)
    const form = new FormData()
    const ext = /mpeg|mp3/.test(mime) ? 'mp3' : /mp4|m4a|aac/.test(mime) ? 'm4a' : /wav/.test(mime) ? 'wav' : 'ogg'
    form.append('file', new Blob([audioBuffer], { type: mime.split(';')[0] }), `audio.${ext}`)
    // Turbo = melhor custo-benefício. Sobrescrevível por GROQ_WHISPER_MODEL.
    form.append('model', (process.env.GROQ_WHISPER_MODEL || 'whisper-large-v3-turbo').trim())
    form.append('language', 'pt')
    form.append('response_format', 'text')

    const trRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form
    })
    if (!trRes.ok) {
      const t = (await trRes.text()).slice(0, 200)
      console.error('[transcribe] groq error', trRes.status, t)
      return { text: null, error: `Groq recusou (HTTP ${trRes.status}) ${t}` }
    }

    const text = (await trRes.text()).trim()
    return text ? { text } : { text: null, error: 'áudio sem fala reconhecível' }
  } catch (err: any) {
    console.error('[transcribe] failed', err)
    return { text: null, error: `erro inesperado: ${err?.message || err}` }
  }
}

/** Atalho compatível: devolve só o texto (ou null). */
export async function transcribeWhatsAppAudio(
  tenant: { phone_number_id: string; whatsapp_token: string },
  mediaId: string
): Promise<string | null> {
  return (await transcribeWhatsAppAudioDetailed(tenant, mediaId)).text
}
