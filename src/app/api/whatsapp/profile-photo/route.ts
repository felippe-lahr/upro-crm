export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { globalPrisma } from '@/lib/prisma-tenant'
import { decrypt } from '@/lib/crypto'

/**
 * Define a foto de perfil do WhatsApp Business do número do tenant a partir de
 * um logo enviado pela plataforma. É a imagem que o cliente final vê no topo da
 * conversa. Fluxo (WhatsApp Cloud API):
 *   1) inicia uma sessão de upload reutilizável no app (app access token)
 *   2) envia os bytes da imagem → recebe um "handle"
 *   3) aplica o handle como profile_picture no whatsapp_business_profile
 * Requer whatsapp_business_management (já presente no token do tenant).
 */
export async function POST(req: Request) {
  const session = await auth()
  const tenantId = (session?.user as any)?.tenantId
  if (!tenantId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const tenant = await globalPrisma.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant?.whatsapp_connected || !tenant.phone_number_id || !tenant.whatsapp_token) {
    return Response.json({ error: 'Conecte o WhatsApp antes de definir o logo.' }, { status: 400 })
  }

  const appId = process.env.META_APP_ID
  const appSecret = process.env.META_APP_SECRET
  if (!appId || !appSecret) {
    return Response.json({ error: 'App da Meta não configurado no servidor.' }, { status: 500 })
  }
  const appToken = `${appId}|${appSecret}`

  // Lê o arquivo enviado (multipart/form-data, campo "file").
  const form = await req.formData().catch(() => null)
  const file = form?.get('file') as File | null
  if (!file) return Response.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 })

  const type = file.type || 'image/jpeg'
  if (!['image/jpeg', 'image/png'].includes(type)) {
    return Response.json({ error: 'Envie uma imagem JPG ou PNG.' }, { status: 400 })
  }
  const bytes = Buffer.from(await file.arrayBuffer())
  if (bytes.length > 5 * 1024 * 1024) {
    return Response.json({ error: 'Imagem muito grande (máx 5 MB).' }, { status: 400 })
  }

  try {
    // 1) Inicia a sessão de upload reutilizável.
    const startRes = await fetch(
      `https://graph.facebook.com/v21.0/${appId}/uploads?` +
        `file_length=${bytes.length}&file_type=${encodeURIComponent(type)}&access_token=${encodeURIComponent(appToken)}`,
      { method: 'POST' }
    )
    const startData = await startRes.json()
    const sessionId: string | undefined = startData?.id
    if (!sessionId) {
      console.error('[profile-photo] start failed', JSON.stringify(startData))
      return Response.json({ error: 'Falha ao iniciar o upload na Meta.' }, { status: 400 })
    }

    // 2) Envia os bytes → recebe o handle.
    const uploadRes = await fetch(`https://graph.facebook.com/v21.0/${sessionId}`, {
      method: 'POST',
      headers: { Authorization: `OAuth ${appToken}`, file_offset: '0' },
      body: bytes
    })
    const uploadData = await uploadRes.json()
    const handle: string | undefined = uploadData?.h
    if (!handle) {
      console.error('[profile-photo] upload failed', JSON.stringify(uploadData))
      return Response.json({ error: 'Falha ao enviar a imagem para a Meta.' }, { status: 400 })
    }

    // 3) Aplica o handle como foto de perfil do número (token do tenant).
    const token = decrypt(tenant.whatsapp_token)
    const setRes = await fetch(
      `https://graph.facebook.com/v21.0/${tenant.phone_number_id}/whatsapp_business_profile`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messaging_product: 'whatsapp', profile_picture_handle: handle })
      }
    )
    const setData = await setRes.json()
    if (setData?.error) {
      console.error('[profile-photo] set failed', JSON.stringify(setData.error))
      return Response.json({ error: `Não foi possível aplicar a foto: ${setData.error.message}` }, { status: 400 })
    }

    return Response.json({ ok: true })
  } catch (e: any) {
    console.error('[profile-photo] error', e?.message || e)
    return Response.json({ error: 'Erro ao definir o logo. Tente novamente.' }, { status: 500 })
  }
}
