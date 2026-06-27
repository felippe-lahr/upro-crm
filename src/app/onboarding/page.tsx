'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

function OnboardingContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tenantId = searchParams.get('tenant') || ''
  const [status, setStatus] = useState<'loading' | 'active' | 'pending' | 'error'>('loading')

  useEffect(() => {
    if (!tenantId) {
      setStatus('error')
      return
    }

    let attempts = 0
    const check = async () => {
      attempts++
      try {
        const res = await fetch(`/api/billing/status?tenant=${tenantId}`)
        const data = await res.json()
        if (data.active) {
          setStatus('active')
        } else if (attempts < 10) {
          setTimeout(check, 3000)
        } else {
          setStatus('pending')
        }
      } catch {
        if (attempts < 10) setTimeout(check, 3000)
        else setStatus('pending')
      }
    }
    check()
  }, [tenantId])

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background text-fg">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand">
          <span className="text-2xl font-bold text-white">UP</span>
        </div>
        <h1 className="mb-2 text-2xl font-bold">Ativando sua conta...</h1>
        <p className="text-sm text-muted">Aguarde enquanto confirmamos seu pagamento.</p>
        <div className="mt-8 flex gap-1">
          <span className="h-2 w-2 animate-bounce rounded-full bg-brand [animation-delay:-0.3s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-brand [animation-delay:-0.15s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-brand" />
        </div>
      </div>
    )
  }

  if (status === 'active') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background text-fg">
        <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-10 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand">
            <span className="text-2xl font-bold text-white">UP</span>
          </div>
          <div className="mb-4 text-5xl">🎉</div>
          <h1 className="mb-2 text-2xl font-bold text-brand">Conta ativada!</h1>
          <p className="mb-6 text-sm text-muted">
            Seu pagamento foi confirmado. Agora você já pode acessar o UProCRM.
          </p>
          <p className="mb-6 text-xs text-faint">
            Faça login com o e-mail e a senha que você cadastrou.
          </p>
          <button
            onClick={() => router.push('/login')}
            className="inline-block rounded-xl bg-brand px-8 py-3 font-semibold text-white transition-colors hover:bg-brand-600"
          >
            Acessar meu CRM →
          </button>
        </div>
      </div>
    )
  }

  if (status === 'pending') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background text-fg">
        <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-10 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-yellow-500">
            <span className="text-2xl font-bold text-white">UP</span>
          </div>
          <h1 className="mb-2 text-2xl font-bold text-yellow-400">Pagamento em análise</h1>
          <p className="mb-4 text-sm text-muted">
            Seu pagamento está sendo processado. Você receberá um e-mail assim que for confirmado.
          </p>
          <p className="text-xs text-faint">
            Se já tiver recebido a confirmação, tente fazer login normalmente.
          </p>
          <button
            onClick={() => router.push('/login')}
            className="mt-6 inline-block rounded-xl border border-line px-6 py-2.5 text-sm text-muted transition-colors hover:border-brand hover:text-brand"
          >
            Ir para o login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-fg">
      <p className="text-sm text-red-400">Link inválido. Verifique o e-mail de confirmação.</p>
    </div>
  )
}

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingContent />
    </Suspense>
  )
}
