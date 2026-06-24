export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { getTenantPrisma } from '@/lib/prisma-tenant'

// Normaliza um número de telefone para apenas dígitos.
function normalizePhone(raw: string): string {
  return String(raw).replace(/\D/g, '')
}

export async function POST(req: Request) {
  const session = await auth()
  const schemaName = (session?.user as any)?.schemaName
  if (!schemaName) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { csv } = await req.json()
  if (!csv?.trim()) {
    return Response.json({ error: 'CSV vazio' }, { status: 400 })
  }

  const lines = String(csv).trim().split(/\r?\n/)
  // Detecta cabeçalho (se a primeira linha contém "nome"/"name"/"phone"/"telefone")
  const header = lines[0].toLowerCase()
  const hasHeader = /nome|name|phone|telefone|celular/.test(header)
  const rows = hasHeader ? lines.slice(1) : lines

  const db = getTenantPrisma(schemaName)
  let imported = 0
  let skipped = 0

  for (const row of rows) {
    if (!row.trim()) continue
    const cols = row.split(/[,;]/).map((c) => c.trim().replace(/^"|"$/g, ''))
    // Heurística: a coluna com mais dígitos é o telefone
    let phone = ''
    let name = ''
    for (const col of cols) {
      const digits = normalizePhone(col)
      if (digits.length >= 10 && digits.length > normalizePhone(phone).length) {
        phone = digits
      } else if (col && !/^\d+$/.test(col) && !name) {
        name = col
      }
    }
    if (!phone) {
      skipped++
      continue
    }
    try {
      await db.contact.upsert({
        where: { whatsapp_id: phone },
        update: { name: name || undefined },
        create: { whatsapp_id: phone, phone, name: name || null }
      })
      imported++
    } catch {
      skipped++
    }
  }

  return Response.json({ ok: true, imported, skipped })
}
