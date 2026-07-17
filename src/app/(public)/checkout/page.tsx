'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Lock, ShieldCheck, Check, Tag, CreditCard, Loader2 } from 'lucide-react'

interface SaasConfig {
  price_basic: number
  price_pro: number
  price_promaster: number
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
  const [plan, setPlan] = useState<'basic' | 'pro' | 'promaster'>('basic')
  const [config, setConfig] = useState<SaasConfig>({ price_basic: 97, price_pro: 197, price_promaster: 297, annual_discount: 20 })
  const [brickReady, setBrickReady] = useState(false)
  const brickController = useRef<any>(null)
  const billingRef = useRef(billing)
  const planRef = useRef(plan)
  const couponStatusRef = useRef(couponStatus)
  const couponCodeRef = useRef(couponCode)

  const monthlyPrice = plan === 'promaster' ? config.price_promaster : plan === 'pro' ? config.price_pro : config.price_basic
  const annualTotal = Math.round(monthlyPrice * 12 * (1 - config.annual_discount / 100))
  const annualMonthly = Math.round(annualTotal / 12)
  const displayedPrice = billing === 'annual' ? annualMonthly : monthlyPrice
  const couponDiscount = couponStatus?.valid
    ? couponStatus.discount_type === 'percent'
      ? Math.round(displayedPrice * couponStatus.discount_value / 100)
      : couponStatus.discount_value
    : 0
  const finalPrice = Math.max(1, displayedPrice - couponDiscount)

  // Total anual efetivamente cobrado (com cupom aplicado sobre o valor do ano)
  const annualBilled = couponStatus?.valid
    ? Math.max(1, annualTotal - (couponStatus.discount_type === 'percent'
      ? Math.round(annualTotal * couponStatus.discount_value / 100)
      : couponStatus.discount_value * 12))
    : annualTotal
  // Valor que o Brick deve usar como base (anual à vista para calcular as 12x; mensal recorrente)
  const brickAmount = (billing === 'annual' ? annualBilled : finalPrice) || 97

  // Keep refs in sync (avoid remounting Brick)
  useEffect(() => { billingRef.current = billing }, [billing])
  useEffect(() => { planRef.current = plan }, [plan])
  useEffect(() => { couponStatusRef.current = couponStatus }, [couponStatus])
  useEffect(() => { couponCodeRef.current = couponCode }, [couponCode])

  useEffect(() => {
    fetch('/api/admin/config', { cache: 'no-store' }).then(r => r.json()).then(d => {
      setConfig({ price_basic: Number(d.price_basic), price_pro: Number(d.price_pro), price_promaster: Number(d.price_promaster), annual_discount: d.annual_discount })
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
          plan: planRef.current,
          couponCode: couponStatusRef.current?.valid ? couponCodeRef.current : undefined,
          cardTokenId: data.token,
          payerEmail: data.payer?.email,
          payerDocType: data.payer?.identification?.type,
          payerDocNumber: data.payer?.identification?.number,
          // Parcelamento (usado no plano anual em 12x)
          installments: data.installments,
          paymentMethodId: data.payment_method_id,
          issuerId: data.issuer_id,
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
          initialization: { amount: brickAmount, payer: { email: '' } },
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
            // Anual: até 12x (sem juros, configurado na conta MP). Mensal: assinatura recorrente, sem parcelas.
            paymentMethods: { maxInstallments: billing === 'annual' ? 12 : 1 }
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
    // Remonta ao alternar mensal/anual (muda o número de parcelas do Brick).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleSubmit, billing])

  // Atualiza o valor-base do Brick quando plano/cupom mudam (sem remontar).
  useEffect(() => {
    brickController.current?.update?.({ amount: brickAmount })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brickAmount])

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

  const PLAN_INCLUDES = plan === 'promaster'
    ? [
        'Tudo do plano Pro',
        'Bot vendedor de e-commerce',
        'Catálogo de produtos por feed XML',
        'Busca de produtos + link de compra'
      ]
    : plan === 'pro'
    ? [
        'Tudo do plano Básico',
        'Bot com IA (Claude) 24/7',
        'Qualificação e captura de leads',
        'Transcrição de áudios'
      ]
    : [
        'Inbox compartilhada do WhatsApp',
        'Funil de vendas e contatos',
        'Etiquetas, anotações e disparos',
        'Conexão oficial Meta (sem ban)'
      ]

  return (
    <div className="min-h-screen bg-background text-fg">
      {/* Top bar */}
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-upro-novo.png" alt="UProCRM" className="h-8 w-8 rounded-lg" />
            <span className="font-bold tracking-tight">UProCRM</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
            <Lock className="h-3.5 w-3.5" /> Pagamento seguro
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-8 px-6 py-10 lg:grid-cols-[1fr_1.1fr]">
        {/* ─── Resumo do pedido ─── */}
        <div className="lg:order-1">
          <h1 className="text-2xl font-bold tracking-tight">Ative seu plano</h1>
          <p className="mt-1 text-sm text-muted">Comece a atender no WhatsApp em minutos.</p>

          {/* Seletor de plano */}
          <div className="mt-6 grid grid-cols-3 gap-3">
            {([
              { id: 'basic', name: 'Básico', price: config.price_basic, sub: 'Atendimento + CRM' },
              { id: 'pro', name: 'Pro', price: config.price_pro, sub: 'Com bot de IA' },
              { id: 'promaster', name: 'Promaster', price: config.price_promaster, sub: 'Bot vendedor e-commerce' }
            ] as const).map((p) => (
              <button
                key={p.id}
                onClick={() => setPlan(p.id)}
                className={`relative rounded-xl border-2 p-4 text-left transition-colors ${
                  plan === p.id ? 'border-brand bg-brand/5' : 'border-line bg-surface hover:border-brand/40'
                }`}
              >
                {p.id === 'pro' && (
                  <span className="absolute -top-2 right-3 rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-white">POPULAR</span>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-fg">{p.name}</span>
                  <span className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 ${plan === p.id ? 'border-brand' : 'border-line'}`}>
                    {plan === p.id && <span className="h-2 w-2 rounded-full bg-brand" />}
                  </span>
                </div>
                <div className="mt-1 text-lg font-bold text-fg">R$ {p.price}<span className="text-xs font-normal text-muted">/mês</span></div>
                <div className="text-xs text-muted">{p.sub}</div>
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-line bg-surface p-6">
            {/* Plano + toggle */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-brand">Plano {plan === 'promaster' ? 'Promaster' : plan === 'pro' ? 'Pro' : 'Básico'}</div>
                <div className="mt-0.5 text-sm text-muted">Assinatura {billing === 'annual' ? 'anual' : 'mensal'}</div>
              </div>
              <div className="flex overflow-hidden rounded-lg border border-line text-xs">
                <button onClick={() => setBilling('monthly')} className={`px-3 py-1.5 font-medium transition-colors ${billing === 'monthly' ? 'bg-brand text-white' : 'text-muted hover:text-fg'}`}>Mensal</button>
                <button onClick={() => setBilling('annual')} className={`px-3 py-1.5 font-medium transition-colors ${billing === 'annual' ? 'bg-brand text-white' : 'text-muted hover:text-fg'}`}>
                  Anual <span className={billing === 'annual' ? 'text-white/80' : 'text-brand'}>-{config.annual_discount}%</span>
                </button>
              </div>
            </div>

            {/* Preço */}
            <div className="mt-5 flex items-end gap-2 border-t border-line pt-5">
              {couponStatus?.valid && (
                <span className="mb-1 text-base text-faint line-through">R$ {displayedPrice}</span>
              )}
              {billing === 'annual' ? (
                <>
                  <span className="mb-1 text-sm text-muted">12x de</span>
                  <span className="text-4xl font-bold tracking-tight">R$ {finalPrice}</span>
                  <span className="mb-1 text-sm font-medium text-brand">sem juros</span>
                </>
              ) : (
                <>
                  <span className="text-4xl font-bold tracking-tight">R$ {finalPrice}</span>
                  <span className="mb-1 text-sm text-muted">/mês</span>
                </>
              )}
            </div>
            {billing === 'annual' && (
              <p className="mt-1 text-xs text-muted">Total R$ {annualBilled} por ano · parcelado no cartão</p>
            )}

            {/* Cupom */}
            <div className="mt-5">
              <div className="flex gap-2">
                <div className="flex flex-1 items-center gap-2 rounded-lg border border-line bg-background px-3 focus-within:border-brand">
                  <Tag className="h-4 w-4 text-faint" />
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponStatus(null); setError('') }}
                    onKeyDown={(e) => e.key === 'Enter' && handleValidateCoupon()}
                    placeholder="Cupom de desconto"
                    className="flex-1 bg-transparent py-2.5 text-sm uppercase text-fg placeholder:normal-case placeholder:text-faint focus:outline-none"
                  />
                </div>
                <button onClick={handleValidateCoupon} disabled={checkingCoupon || !couponCode.trim()} className="rounded-lg border border-line px-4 text-sm font-medium text-fg transition-colors hover:border-brand hover:text-brand disabled:opacity-40">
                  {checkingCoupon ? '...' : 'Aplicar'}
                </button>
              </div>
              {couponStatus?.valid && (
                <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-brand">
                  <Check className="h-3.5 w-3.5" />
                  {couponStatus.description || `Desconto de ${couponStatus.discount_type === 'percent' ? `${couponStatus.discount_value}%` : `R$ ${couponStatus.discount_value}`} aplicado!`}
                </p>
              )}
            </div>

            {/* Incluído */}
            <ul className="mt-6 space-y-2.5 border-t border-line pt-5">
              {PLAN_INCLUDES.map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-sm text-fg">
                  <Check className="h-4 w-4 flex-shrink-0 text-brand" /> {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-brand" /> Sem fidelidade</span>
            <span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-brand" /> Cancele quando quiser</span>
          </div>
        </div>

        {/* ─── Pagamento ─── */}
        <div className="lg:order-2">
          <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold">
                <CreditCard className="h-5 w-5 text-brand" /> Pagamento no cartão
              </h2>
              <div className="flex items-center gap-1">
                {['mastercard', 'visa', 'elo'].map((b) => (
                  <span key={b} className="rounded border border-line bg-background px-1.5 py-0.5 text-[9px] font-bold uppercase text-muted">{b}</span>
                ))}
              </div>
            </div>

            {error && (
              <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500">{error}</div>
            )}

            <div className="relative">
              {!brickReady && (
                <div className="flex h-64 items-center justify-center rounded-lg border border-line">
                  <span className="flex items-center gap-2 text-sm text-faint">
                    <Loader2 className="h-4 w-4 animate-spin" /> Carregando pagamento seguro…
                  </span>
                </div>
              )}
              <div id="mp-card-brick" className={brickReady ? '' : 'hidden'} />

              {loading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-surface/80 backdrop-blur-sm">
                  <span className="flex items-center gap-2 text-sm font-medium text-brand">
                    <Loader2 className="h-5 w-5 animate-spin" /> Processando pagamento…
                  </span>
                </div>
              )}
            </div>

            <div className="mt-5 flex items-center justify-center gap-1.5 border-t border-line pt-4 text-xs text-faint">
              <Lock className="h-3.5 w-3.5" />
              Seus dados são processados com segurança pelo Mercado Pago
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
