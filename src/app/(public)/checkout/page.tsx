'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

interface SaasConfig {
  price_basic: number
  price_pro: number
  annual_discount: number
}

function CheckoutContent() {
  const searchParams = useSearchParams()
  const tenantId = searchParams.get('tenant') || ''
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [couponCode, setCouponCode] = useState('')
  const [couponStatus, setCouponStatus] = useState<null | { valid: boolean; discount_type: string; discount_value: number; description?: string }>(null)
  const [checkingCoupon, setCheckingCoupon] = useState(false)
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly')
  const [config, setConfig] = useState<SaasConfig>({ price_basic: 97, price_pro: 197, annual_discount: 20 })

  useEffect(() => {
    fetch('/api/admin/config').then(r => r.json()).then(d => {
      setConfig({
        price_basic: Number(d.price_basic),
        price_pro: Number(d.price_pro),
        annual_discount: d.annual_discount
      })
    }).catch(() => {})
  }, [])

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
      if (res.ok && data.valid) {
        setCouponStatus(data)
      } else {
        setError(data.error || 'Cupom inválido')
      }
    } catch {
      setError('Erro ao validar cupom')
    } finally {
      setCheckingCoupon(false)
    }
  }

  async function handleMercadoPago() {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/billing/mercadopago/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          billing,
          couponCode: couponStatus?.valid ? couponCode : undefined
        })
      })
      const data = await res.json()
      if (data.init_point) {
        window.location.href = data.init_point
      } else {
        setError(data.error || 'Erro ao iniciar pagamento')
      }
    } catch {
      setError('Erro ao iniciar pagamento')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0b0f14] px-4 text-[#e6e8eb]">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-green-500">
            <span className="text-xl font-bold text-white">UP</span>
          </div>
          <h1 className="mb-1 text-2xl font-bold">Ative sua conta</h1>
          <p className="text-sm text-[#9aa6b2]">Plano Básico · Cancele quando quiser.</p>
        </div>

        <div className="space-y-5 rounded-2xl border border-[#1b222c] bg-[#131820] p-8">
          {error && (
            <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
          )}

          {/* Mensal / Anual toggle */}
          <div className="flex rounded-xl overflow-hidden border border-[#232c38]">
            <button
              onClick={() => setBilling('monthly')}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                billing === 'monthly'
                  ? 'bg-green-500 text-white'
                  : 'bg-transparent text-[#9aa6b2] hover:text-white'
              }`}
            >
              Mensal
            </button>
            <button
              onClick={() => setBilling('annual')}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors relative ${
                billing === 'annual'
                  ? 'bg-green-500 text-white'
                  : 'bg-transparent text-[#9aa6b2] hover:text-white'
              }`}
            >
              Anual
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                billing === 'annual' ? 'bg-white/20' : 'bg-green-500/20 text-green-400'
              }`}>
                -{config.annual_discount}%
              </span>
            </button>
          </div>

          {/* Preço */}
          <div className="rounded-xl border border-[#232c38] bg-[#0b0f14] p-4 text-center">
            {couponStatus?.valid ? (
              <>
                <div className="text-sm text-[#6b7886] line-through">R$ {displayedPrice}/mês</div>
                <div className="text-3xl font-bold text-green-400">R$ {finalPrice}<span className="text-lg font-normal text-[#9aa6b2]">/mês</span></div>
              </>
            ) : (
              <div className="text-3xl font-bold text-white">R$ {displayedPrice}<span className="text-lg font-normal text-[#9aa6b2]">/mês</span></div>
            )}
            {billing === 'annual' && (
              <div className="mt-1 text-xs text-[#9aa6b2]">
                Cobrado R$ {couponStatus?.valid ? Math.max(1, annualTotal - (couponStatus.discount_type === 'percent' ? Math.round(annualTotal * couponStatus.discount_value / 100) : couponStatus.discount_value * 12)) : annualTotal} por ano
              </div>
            )}
          </div>

          {/* Cupom */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#9aa6b2]">
              Cupom de desconto (opcional)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={couponCode}
                onChange={(e) => {
                  setCouponCode(e.target.value.toUpperCase())
                  setCouponStatus(null)
                  setError('')
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleValidateCoupon()}
                placeholder="Ex: BEMVINDO50"
                className="flex-1 rounded-lg border border-[#232c38] bg-[#0b0f14] px-3 py-2 text-sm text-[#e6e8eb] focus:border-green-500 focus:outline-none uppercase"
              />
              <button
                onClick={handleValidateCoupon}
                disabled={checkingCoupon || !couponCode.trim()}
                className="rounded-lg border border-[#232c38] px-3 py-2 text-sm text-[#9aa6b2] hover:border-green-500 hover:text-green-400 disabled:opacity-40 transition-colors"
              >
                {checkingCoupon ? '...' : 'Aplicar'}
              </button>
            </div>
            {couponStatus?.valid && (
              <p className="mt-1.5 text-xs text-green-400">
                ✓ {couponStatus.description || `Desconto de ${couponStatus.discount_type === 'percent' ? `${couponStatus.discount_value}%` : `R$ ${couponStatus.discount_value}`} aplicado!`}
              </p>
            )}
          </div>

          <button
            onClick={handleMercadoPago}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#009ee3] py-4 font-medium text-white transition-colors hover:bg-[#008fcc] disabled:opacity-50"
          >
            <span className="text-2xl">🇧🇷</span>
            <div className="text-left">
              <div className="font-semibold">
                {loading ? 'Redirecionando...' : `Pagar R$ ${finalPrice}${billing === 'annual' ? '/ano' : '/mês'} com Mercado Pago`}
              </div>
              <div className="text-xs text-white/80">Pix, boleto ou cartão</div>
            </div>
          </button>

          <div className="pt-1 text-center">
            <div className="flex items-center justify-center gap-4 text-xs text-[#6b7886]">
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
