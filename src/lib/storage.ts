/**
 * Armazenamento de mídia recebida no WhatsApp (imagens e documentos).
 *
 * Usa um bucket compatível com S3 — recomendado: Cloudflare R2 (tráfego grátis).
 * Variáveis: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET.
 * Sem elas, o recurso fica desligado (nada é baixado).
 *
 * Os arquivos ficam em "<schema>/<contato>/<mensagem>.<ext>" e só são servidos
 * por link temporário, gerado depois de conferir a sessão do tenant.
 */
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { decrypt } from './crypto'

const GRAPH = 'https://graph.facebook.com/v21.0'
const MAX_BYTES = 16 * 1024 * 1024 // limite da Meta para documentos

let client: S3Client | null = null

export function storageConfigured(): boolean {
  return !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET)
}

function s3(): S3Client {
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!
      }
    })
  }
  return client
}

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xls',
  'text/plain': 'txt'
}

/**
 * Baixa a mídia da Meta e guarda no bucket. Retorna a chave salva
 * ("r2:<chave>") ou null se não foi possível.
 */
export async function storeWhatsAppMedia(opts: {
  tenant: { whatsapp_token: string }
  mediaId: string
  schemaName: string
  contactId: string
  messageKey: string
  filename?: string | null
}): Promise<string | null> {
  if (!storageConfigured() || !opts.mediaId) return null
  try {
    const token = decrypt(opts.tenant.whatsapp_token)
    const meta = await (await fetch(`${GRAPH}/${opts.mediaId}`, { headers: { Authorization: `Bearer ${token}` } })).json()
    if (!meta?.url) return null
    if (Number(meta.file_size || 0) > MAX_BYTES) return null
    const res = await fetch(meta.url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return null
    const body = Buffer.from(await res.arrayBuffer())
    const mime = String(meta.mime_type || res.headers.get('content-type') || 'application/octet-stream').split(';')[0]
    const fromName = (opts.filename || '').match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase()
    const ext = fromName || EXT[mime] || 'bin'
    const safeKey = String(opts.messageKey).replace(/[^a-zA-Z0-9_-]/g, '')
    const key = `${opts.schemaName}/${opts.contactId}/${safeKey}.${ext}`

    await s3().send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET!,
      Key: key,
      Body: body,
      ContentType: mime,
      ...(opts.filename ? { ContentDisposition: `inline; filename="${opts.filename.replace(/"/g, '')}"` } : {})
    }))
    return `r2:${key}`
  } catch (e: any) {
    console.error('[storage] falha ao guardar mídia', e?.message || e)
    return null
  }
}

/** Link temporário (5 min) para exibir/baixar a mídia. */
export async function signedMediaUrl(stored: string): Promise<string | null> {
  if (!storageConfigured() || !stored.startsWith('r2:')) return null
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: stored.slice(3) }), { expiresIn: 300 })
}

/** Apaga todas as mídias de um contato (usado ao excluir o contato — LGPD). */
export async function deleteContactMedia(schemaName: string, contactId: string): Promise<number> {
  if (!storageConfigured()) return 0
  let deleted = 0
  try {
    let token: string | undefined
    do {
      const list = await s3().send(new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET!, Prefix: `${schemaName}/${contactId}/`, ContinuationToken: token
      }))
      const keys = (list.Contents || []).map((o) => ({ Key: o.Key! }))
      if (keys.length) {
        await s3().send(new DeleteObjectsCommand({ Bucket: process.env.R2_BUCKET!, Delete: { Objects: keys } }))
        deleted += keys.length
      }
      token = list.IsTruncated ? list.NextContinuationToken : undefined
    } while (token)
  } catch (e: any) {
    console.error('[storage] falha ao apagar mídias do contato', e?.message || e)
  }
  return deleted
}
