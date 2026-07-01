/**
 * Criação de cobrança Pix via Mercado Pago, usando o token do lojista (tenant),
 * para que o valor do sinal caia na conta dele.
 */
export interface PixCharge {
  paymentId: string
  qrCode: string // "copia e cola"
  qrCodeBase64: string // imagem em base64 (sem prefixo data:)
  ticketUrl: string // link para pagar
  amount: number
}

export async function createPixCharge(opts: {
  accessToken: string
  amount: number
  description: string
  payerEmail: string
  externalReference: string
  notificationUrl?: string
  expiresMinutes?: number
}): Promise<PixCharge> {
  const { MercadoPagoConfig, Payment } = await import('mercadopago')
  const client = new MercadoPagoConfig({ accessToken: opts.accessToken })
  const payment = new Payment(client)

  const body: any = {
    transaction_amount: Math.round(opts.amount * 100) / 100,
    description: opts.description,
    payment_method_id: 'pix',
    payer: { email: opts.payerEmail },
    external_reference: opts.externalReference
  }
  if (opts.notificationUrl) body.notification_url = opts.notificationUrl
  if (opts.expiresMinutes) {
    const exp = new Date(Date.now() + opts.expiresMinutes * 60000)
    body.date_of_expiration = exp.toISOString()
  }

  const res: any = await payment.create({ body })
  const tx = res.point_of_interaction?.transaction_data || {}
  return {
    paymentId: String(res.id),
    qrCode: tx.qr_code || '',
    qrCodeBase64: tx.qr_code_base64 || '',
    ticketUrl: tx.ticket_url || '',
    amount: Number(res.transaction_amount) || opts.amount
  }
}

/** Consulta o status de um pagamento usando o token do lojista. */
export async function getPixPaymentStatus(accessToken: string, paymentId: string): Promise<string> {
  const { MercadoPagoConfig, Payment } = await import('mercadopago')
  const client = new MercadoPagoConfig({ accessToken })
  const res: any = await new Payment(client).get({ id: paymentId })
  return res.status // approved | pending | rejected | cancelled | ...
}
