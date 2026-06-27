'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

interface SaasConfig {
  price_basic: number
  price_pro: number
  annual_discount: number
}

declare global {
  interface Window { MercadoPago: any }
}

function CheckoutContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tenantId = searchParams.get('tenant') || ''

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [couponCode, setCouponCode] = useState('')
  const [couponStatus, setCouponStatus] = useState<null | { valid: boolean; discount_type: string; discount_value: number; description?: string }>(null)
  const [checkingCoupon, setCheckingCoupon] = useState(false)
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly')
  const [config, setConfig] = useState<SaasConfig>({ price_basic: 97, price_pro: 197, annual_discount: 20 })
  const [brickReady, setBrickReady] = useState(false)
  const brickController = useRef<any>(null)
  const billingRef = useRef(billing)
  const couponStatusRef = useRef(couponStatus)
  const couponCodeRef = useRef(couponCode)

  const monthlyPrice = config.price_basic
  const annualTotal = Math.round(monthlyPrice * 12 * (1 - config.annual_discount / 100))
  const annualMonthly = Math.round(annualTotal / 12)
  const displayedPrice = billing === 'annual' ? annualMonthly : monthlyPrice
  const couponDiscount = couponStatus?.valid
    ? couponStatus.discount_type === 'percent'
      ? Math.round(displayedPrice * couponStatus.discount_value / 100)
      : couponStatus.discount_value
    : 0
  const finalPrice = Math.max(1, displayedPrice - couponDiscount)

  // Keep refs in sync (avoid remounting Brick)
  useEffect(() => { billingRef.current = billing }, [billing])
  useEffect(() => { couponStatusRef.current = couponStatus }, [couponStatus])
  useEffect(() => { couponCodeRef.current = couponCode }, [couponCode])

  useEffect(() => {
    fetch('/api/admin/config').then(r => r.json()).then(d => {
      setConfig({ price_basic: Number(d.price_basic), price_pro: Number(d.price_pro), annual_discount: d.annual_discount })
    }).catch(() => {})
  }, [])

  const handleSubmit = useCallback(async (data: any) => {
    setLoading(true)
    setError('')
    console.log('[MP Brick onSubmit] token:', data?.token, 'payer:', data?.payer)
    try {
      const res = await fetch('/api/billing/mercadopago/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          billing: billingRef.current,
          couponCode: couponStatusRef.current?.valid ? couponCodeRef.current : undefined,
          cardTokenId: data.token,
          payerEmail: data.payer?.email,
          payerDocType: data.payer?.identification?.type,
          payerDocNumber: data.payer?.identification?.number,
        })
      })
      const result = await res.json()
      if (result.success) {
        router.push(`/onboarding?tenant=${tenantId}`)
      } else if (result.init_point) {
        window.location.href = result.init_point
      } else {
        setError(result.error || 'Pagamento não autorizado. Tente outro cartão.')
      }
    } catch {
      setError('Erro ao processar pagamento.')
    } finally {
      setLoading(false)
    }
  }, [tenantId, router])

  // Mount Brick once
  useEffect(() => {
    const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY
    if (!publicKey) return

    let cancelled = false

    const script = document.createElement('script')
    script.src = 'https://sdk.mercadopago.com/js/v2'
    script.onload = async () => {
      if (cancelled) return
      const mp = new window.MercadoPago(publicKey, { locale: 'pt-BR' })
      const bricks = mp.bricks()
      try {
        brickController.current = await bricks.create('cardPayment', 'mp-card-brick', {
          initialization: { amount: 97, payer: { email: '' } },
          customization: {
            visual: {
              style: {
                theme: 'default',
                customVariables: {
                  baseColor: '#2563eb',
                  inputFocusedBorderColor: '#2563eb',
                }
              },
              texts: { formTitle: 'Dados do cartão', cardholderName: { label: 'Nome no cartão' } }
            },
            paymentMethods: { maxInstallments: 1 }
          },
          callbacks: {
            onReady: () => setBrickReady(true),
            onError: (err: any) => {
              console.error('[MP Brick error]', err)
              setError(err?.message || 'Erro no formulário de pagamento')
            },
            onSubmit: handleSubmit
          }
        })
      } catch (e) {
        console.error('[MP Brick create error]', e)
      }
    }
    document.head.appendChild(script)

    return () => {
      cancelled = true
      brickController.current?.unmount?.()
      brickController.current = null
    }
  }, [handleSubmit])

  async function handleValidateCoupon() {
    if (!couponCode.trim()) return
    setCheckingCoupon(true)
    setCouponStatus(null)
    setError('')
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode })
      })
      const data = await res.json()
      if (res.ok && data.valid) setCouponStatus(data)
      else setError(data.error || 'Cupom inválido')
    } catch {
      setError('Erro ao validar cupom')
    } finally {
      setCheckingCoupon(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-fg">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand">
            <span className="text-xl font-bold text-white">UP</span>
          </div>
          <h1 className="mb-1 text-2xl font-bold">Ative sua conta</h1>
          <p className="text-sm text-muted">Plano Básico · Cancele quando quiser.</p>
        </div>

        <div className="space-y-5 rounded-2xl border border-line bg-surface p-8">
          {error && (
            <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
          )}

          {/* Mensal / Anual toggle */}
          <div className="flex overflow-hidden rounded-xl border border-line">
            <button onClick={() => setBilling('monthly')} className={`flex-1 py-2.5 text-sm font-medium transition-colors ${billing === 'monthly' ? 'bg-brand text-white' : 'bg-transparent text-muted hover:text-white'}`}>
              Mensal
            </button>
            <button onClick={() => setBilling('annual')} className={`relative flex-1 py-2.5 text-sm font-medium transition-colors ${billing === 'annual' ? 'bg-brand text-white' : 'bg-transparent text-muted hover:text-white'}`}>
              Anual
              <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs ${billing === 'annual' ? 'bg-white/20' : 'bg-brand/20 text-brand'}`}>
                -{config.annual_discount}%
              </span>
            </button>
          </div>

          {/* Preço */}
          <div className="rounded-xl border border-line bg-background p-4 text-center">
            {couponStatus?.valid ? (
              <>
                <div className="text-sm text-faint line-through">R$ {displayedPrice}/mês</div>
                <div className="text-3xl font-bold text-brand">R$ {finalPrice}<span className="text-lg font-normal text-muted">/mês</span></div>
              </>
            ) : (
              <div className="text-3xl font-bold text-white">R$ {displayedPrice}<span className="text-lg font-normal text-muted">/mês</span></div>
            )}
            {billing === 'annual' && (
              <div className="mt-1 text-xs text-muted">
                Cobrado R$ {couponStatus?.valid
                  ? Math.max(1, annualTotal - (couponStatus.discount_type === 'percent'
                    ? Math.round(annualTotal * couponStatus.discount_value / 100)
                    : couponStatus.discount_value * 12))
                  : annualTotal} por ano
              </div>
            )}
          </div>

          {/* Cupom */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Cupom de desconto (opcional)</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={couponCode}
                onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponStatus(null); setError('') }}
                onKeyDown={(e) => e.key === 'Enter' && handleValidateCoupon()}
                placeholder="Ex: BEMVINDO50"
                className="flex-1 rounded-lg border border-line bg-background px-3 py-2 text-sm uppercase text-fg focus:border-brand focus:outline-none"
              />
              <button onClick={handleValidateCoupon} disabled={checkingCoupon || !couponCode.trim()} className="rounded-lg border border-line px-3 py-2 text-sm text-muted transition-colors hover:border-brand hover:text-brand disabled:opacity-40">
                {checkingCoupon ? '...' : 'Aplicar'}
              </button>
            </div>
            {couponStatus?.valid && (
              <p className="mt-1.5 text-xs text-brand">
                ✓ {couponStatus.description || `Desconto de ${couponStatus.discount_type === 'percent' ? `${couponStatus.discount_value}%` : `R$ ${couponStatus.discount_value}`} aplicado!`}
              </p>
            )}
          </div>

          {/* Card Brick */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Dados do cartão</label>
            {!brickReady && (
              <div className="flex h-48 items-center justify-center rounded-lg border border-line">
                <span className="text-sm text-faint">Carregando formulário...</span>
              </div>
            )}
            <div id="mp-card-brick" className={brickReady ? '' : 'hidden'} />
          </div>

          {loading && <div className="text-center text-sm text-muted">Processando pagamento...</div>}

          <div className="pt-1 text-center">
            <div className="flex items-center justify-center gap-4 text-xs text-faint">
              <span>🔒 Pagamento seguro</span>
              <span>✓ Sem fidelidade</span>
              <span>✓ Cancele a qualquer hora</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense>
      <CheckoutContent />
    </Suspense>
  )
}
