import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'

export interface OrderItem {
  nome: string
  quantidade: number
  preco_unit: number
  subtotal: number
}

export interface OrderPdfData {
  businessName: string
  orderId: string
  createdAt: Date
  customerName?: string | null
  customerPhone?: string | null
  items: OrderItem[]
  total: number
  notes?: string | null
}

const money = (n: number) =>
  (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// pdf-lib usa WinAnsi nas fontes padrão (cobre acentos do português). Remove só o
// que WinAnsi não representa, para nunca quebrar a geração.
const clean = (s: string) =>
  String(s || '').replace(/[^\x09\x0A\x0D\x20-\x7E -ÿ]/g, '')

/**
 * Gera o PDF do resumo de pedido (A4). Simples e sem dependências nativas —
 * roda em qualquer runtime Node. Suporta múltiplas páginas se houver muitos itens.
 */
export async function generateOrderPdf(data: OrderPdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  const A4: [number, number] = [595.28, 841.89]
  const M = 48 // margem
  const brand = rgb(0.11, 0.42, 0.92)
  const dark = rgb(0.12, 0.14, 0.18)
  const gray = rgb(0.45, 0.48, 0.53)
  const line = rgb(0.85, 0.87, 0.9)

  let page: PDFPage = doc.addPage(A4)
  let y = A4[1] - M

  const text = (s: string, x: number, yy: number, size: number, f: PDFFont, color = dark) =>
    page.drawText(clean(s), { x, y: yy, size, font: f, color })

  const hr = (yy: number) =>
    page.drawLine({ start: { x: M, y: yy }, end: { x: A4[0] - M, y: yy }, thickness: 1, color: line })

  const newPageIfNeeded = (needed: number) => {
    if (y - needed < M + 60) {
      page = doc.addPage(A4)
      y = A4[1] - M
    }
  }

  // Cabeçalho
  text(data.businessName || 'Pedido', M, y, 20, bold, brand)
  y -= 26
  text('Resumo de pedido', M, y, 12, font, gray)
  y -= 10
  const dateLabel = data.createdAt.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
  text(`Nº ${data.orderId.slice(0, 8).toUpperCase()}  ·  ${dateLabel}`, M, y - 8, 10, font, gray)
  y -= 26
  hr(y)
  y -= 24

  // Dados do cliente
  if (data.customerName || data.customerPhone) {
    text('Cliente', M, y, 10, bold, gray)
    y -= 16
    if (data.customerName) { text(data.customerName, M, y, 12, font); y -= 16 }
    if (data.customerPhone) { text(data.customerPhone, M, y, 12, font); y -= 16 }
    y -= 8
  }

  // Cabeçalho da tabela
  const colQty = M
  const colName = M + 44
  const colUnit = A4[0] - M - 170
  const colSub = A4[0] - M - 80
  text('Qtd', colQty, y, 9, bold, gray)
  text('Produto', colName, y, 9, bold, gray)
  text('Unitário', colUnit, y, 9, bold, gray)
  text('Subtotal', colSub, y, 9, bold, gray)
  y -= 8
  hr(y)
  y -= 18

  // Itens
  for (const it of data.items) {
    newPageIfNeeded(20)
    const name = clean(String(it.nome || ''))
    // Trunca nomes muito longos para caber na coluna.
    const maxChars = 46
    const shown = name.length > maxChars ? name.slice(0, maxChars - 1) + '…' : name
    text(String(it.quantidade), colQty, y, 11, font)
    text(shown, colName, y, 11, font)
    text(money(it.preco_unit), colUnit, y, 11, font)
    text(money(it.subtotal), colSub, y, 11, font)
    y -= 20
  }

  y -= 4
  hr(y)
  y -= 24

  // Total
  newPageIfNeeded(40)
  text('TOTAL', colUnit, y, 12, bold, gray)
  text(money(data.total), colSub, y, 14, bold, brand)
  y -= 30

  // Observações
  if (data.notes && data.notes.trim()) {
    newPageIfNeeded(60)
    text('Observações', M, y, 10, bold, gray)
    y -= 16
    // Quebra simples de linha a ~90 caracteres.
    const words = clean(data.notes).split(/\s+/)
    let lineBuf = ''
    const flush = () => { if (lineBuf) { newPageIfNeeded(16); text(lineBuf, M, y, 11, font); y -= 16; lineBuf = '' } }
    for (const w of words) {
      if ((lineBuf + ' ' + w).trim().length > 90) flush()
      lineBuf = (lineBuf ? lineBuf + ' ' : '') + w
    }
    flush()
    y -= 8
  }

  // Rodapé (na última página)
  const foot = 'Este documento é apenas um resumo do pedido para conferência. Não constitui nota fiscal nem confirmação de pagamento.'
  page.drawText(clean(foot), { x: M, y: M - 4, size: 8, font, color: gray, maxWidth: A4[0] - 2 * M })

  return await doc.save()
}
