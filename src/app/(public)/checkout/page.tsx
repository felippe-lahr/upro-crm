'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function CheckoutContent() {
  const searchParams = useSearchParams()
  const tenantId = searchParams.get('tenant') || ''
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleMercadoPago() {
    setError('')
    setLoading(true)
    const res = await fetch('/api/billing/mercadopago/create-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId })
    })
    const data = await res.json()
    setLoading(false)
    if (data.init_point) {
      window.location.href = data.init_point
    } else {
      setError('Erro ao iniciar pagamento')
    }
  }

  async function handleStripe() {
    setError('')
    setLoading(true)
    const res = await fetch('/api/billing/stripe/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId })
    })
    const data = await res.json()
    setLoading(false)
    if (data.url) {
      window.location.href = data.url
    } else {
      setError('Erro ao iniciar pagamento')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-xl">W</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Escolha como pagar</h1>
          <p className="text-gray-500 text-sm">
            Plano Básico — R$ 97/mês. Cancele quando quiser.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            onClick={handleMercadoPago}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 border-2 border-blue-500 hover:bg-blue-50 text-blue-700 py-4 rounded-xl font-medium transition-colors disabled:opacity-50"
          >
            <span className="text-2xl">🇧🇷</span>
            <div className="text-left">
              <div className="font-semibold">Mercado Pago</div>
              <div className="text-xs text-blue-500">Pix, boleto, cartão</div>
            </div>
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-100"></div>
            </div>
            <div className="relative flex justify-center text-xs text-gray-400">
              <span className="px-2 bg-white">ou</span>
            </div>
          </div>

          <button
            onClick={handleStripe}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 border-2 border-gray-200 hover:bg-gray-50 text-gray-700 py-4 rounded-xl font-medium transition-colors disabled:opacity-50"
          >
            <span className="text-2xl">💳</span>
            <div className="text-left">
              <div className="font-semibold">Cartão internacional</div>
              <div className="text-xs text-gray-400">Visa, Mastercard, Amex</div>
            </div>
          </button>

          <div className="pt-2 text-center">
            <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
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
