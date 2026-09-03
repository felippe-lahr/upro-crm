import { decrypt } from './crypto'

/**
 * Baixa um áudio recebido no WhatsApp e o transcreve para texto.
 * Usa a API de transcrição da Groq (compatível com OpenAI, Whisper large v3).
 * Requer GROQ_API_KEY. Se não estiver configurada, retorna null (bot ignora o áudio).
 */
export async function transcribeWhatsAppAudio(
  tenant: { phone_number_id: string; whatsapp_token: string },
  mediaId: string
): Promise<string | null> {
  const apiKey = (process.env.GROQ_API_KEY || '').trim()
  if (!apiKey || !mediaId) return null

  const token = decrypt(tenant.whatsapp_token)

  try {
    // 1) Resolve a URL do mídia
    const metaRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!metaRes.ok) return null
    const meta = await metaRes.json()
    if (!meta.url) return null

    // 2) Baixa o binário do áudio
    const audioRes = await fetch(meta.url, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!audioRes.ok) return null
    const audioBuffer = await audioRes.arrayBuffer()

    // 3) Envia para a transcrição (Groq Whisper)
    const form = new FormData()
    form.append('file', new Blob([audioBuffer]), 'audio.ogg')
    form.append('model', 'whisper-large-v3')
    form.append('language', 'pt')
    form.append('response_format', 'text')

    const trRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form
    })
    if (!trRes.ok) {
      console.error('[transcribe] groq error', await trRes.text())
      return null
    }

    const text = (await trRes.text()).trim()
    return text || null
  } catch (err) {
    console.error('[transcribe] failed', err)
    return null
  }
}
