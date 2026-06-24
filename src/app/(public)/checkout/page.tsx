'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function CheckoutContent() {
  const searchParams = useSearchParams()
  const tenantId = searchParams.get('tenant') || ''
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleMercadoPago() {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/billing/mercadopago/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId })
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
            <span className="text-xl font-bold text-white">W</span>
          </div>
          <h1 className="mb-1 text-2xl font-bold">Ative sua conta</h1>
          <p className="text-sm text-[#9aa6b2]">
            Plano Básico — R$ 97/mês. 7 dias grátis. Cancele quando quiser.
          </p>
        </div>

        <div className="space-y-4 rounded-2xl border border-[#1b222c] bg-[#131820] p-8">
          {error && (
            <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            onClick={handleMercadoPago}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#009ee3] py-4 font-medium text-white transition-colors hover:bg-[#008fcc] disabled:opacity-50"
          >
            <span className="text-2xl">🇧🇷</span>
            <div className="text-left">
              <div className="font-semibold">{loading ? 'Redirecionando...' : 'Pagar com Mercado Pago'}</div>
              <div className="text-xs text-white/80">Pix, boleto ou cartão</div>
            </div>
          </button>

          <div className="pt-2 text-center">
            <div className="flex items-center justify-center gap-4 text-xs text-[#6b7886]">
              <span>🔒 Pagamento seguro</span>
              <span>✓ 7 dias grátis</span>
              <span>✓ Sem fidelidade</span>
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
