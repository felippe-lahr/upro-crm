'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

declare global {
  interface Window {
    FB: any
    fbAsyncInit: () => void
  }
}

export default function ConnectWhatsAppPage() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const router = useRouter()

  // O popup do Embedded Signup envia o WABA ID e o phone_number_id via postMessage.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (!String(event.origin).includes('facebook.com')) return
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
        if (data?.type === 'WA_EMBEDDED_SIGNUP') {
          ;(window as any).__waSessionInfo = data?.data || data
          console.log('[embedded signup] session info', (window as any).__waSessionInfo)
        }
      } catch { /* ignora mensagens não-JSON */ }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  useEffect(() => {
    window.fbAsyncInit = function () {
      window.FB.init({
        appId: process.env.NEXT_PUBLIC_META_APP_ID,
        autoLogAppEvents: true,
        xfbml: true,
        version: 'v21.0'
      })
    }

    const script = document.createElement('script')
    script.src = 'https://connect.facebook.net/pt_BR/sdk.js'
    script.async = true
    script.defer = true
    document.body.appendChild(script)

    return () => {
      document.body.removeChild(script)
    }
  }, [])

  function launchEmbeddedSignup() {
    setStatus('loading')
    setErrorMsg('')

    window.FB.login(
      function (response: any) {
        if (response.authResponse) {
          handleSignupComplete(response.authResponse)
        } else {
          setStatus('idle')
        }
      },
      {
        config_id: process.env.NEXT_PUBLIC_META_CONFIG_ID,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: '',
          sessionInfoVersion: '3'
        }
      }
    )
  }

  async function handleSignupComplete(authResponse: any) {
    try {
      // O session info (waba_id/phone_number_id) pode chegar via postMessage
      // logo após o callback — aguarda até 4s por ele antes de enviar.
      let sessionInfo = (window as any).__waSessionInfo || null
      for (let i = 0; i < 20 && !sessionInfo; i++) {
        await new Promise((r) => setTimeout(r, 200))
        sessionInfo = (window as any).__waSessionInfo || null
      }
      console.log('[embedded signup] sending to backend, sessionInfo:', sessionInfo)

      const res = await fetch('/api/whatsapp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authResponse,
          code: authResponse?.code,
          sessionInfo
        })
      })

      const data = await res.json()

      if (data.success) {
        setStatus('success')
        setTimeout(() => router.push('/dashboard'), 2000)
      } else {
        setStatus('error')
        setErrorMsg(data.error || 'Erro ao conectar WhatsApp')
      }
    } catch {
      setStatus('error')
      setErrorMsg('Erro de conexão. Tente novamente.')
    }
  }

  return (
    <div className="p-4 sm:p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-fg">Conectar WhatsApp Business</h1>
        <p className="mt-1 text-muted">
          O processo leva menos de 2 minutos e é totalmente oficial pela Meta.
        </p>
      </div>

      {status === 'success' ? (
        <div className="rounded-2xl border border-brand/30 bg-brand/10 p-8 text-center">
          <div className="mb-4 text-5xl">✅</div>
          <h2 className="mb-2 text-xl font-bold text-brand">WhatsApp conectado!</h2>
          <p className="text-sm text-brand/80">Redirecionando para o dashboard...</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-line bg-surface p-8">
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand/15 text-sm font-bold text-brand">
                1
              </div>
              <div>
                <p className="font-medium text-fg">Clique em &quot;Conectar WhatsApp&quot;</p>
                <p className="mt-0.5 text-sm text-muted">
                  Uma janela da Meta vai abrir para você fazer login no Facebook/Meta Business
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand/15 text-sm font-bold text-brand">
                2
              </div>
              <div>
                <p className="font-medium text-fg">Selecione seu número WhatsApp Business</p>
                <p className="mt-0.5 text-sm text-muted">
                  Se ainda não tiver um, você pode criar durante o processo
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand/15 text-sm font-bold text-brand">
                3
              </div>
              <div>
                <p className="font-medium text-fg">Pronto!</p>
                <p className="mt-0.5 text-sm text-muted">
                  Suas mensagens começarão a chegar automaticamente no CRM
                </p>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="mt-6 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {errorMsg}
            </div>
          )}

          <button
            onClick={launchEmbeddedSignup}
            disabled={status === 'loading'}
            className="mt-8 w-full bg-brand hover:bg-brand-600 disabled:bg-brand/50 text-white py-4 rounded-xl font-semibold text-lg transition-colors flex items-center justify-center gap-2"
          >
            {status === 'loading' ? (
              <>
                <span className="animate-spin">⟳</span>
                Conectando...
              </>
            ) : (
              <>
                <span>🔌</span>
                Conectar WhatsApp Business
              </>
            )}
          </button>

          <p className="mt-4 text-center text-xs text-faint">
            Conexão oficial pela Meta Cloud API · Sem risco de ban · v4
          </p>
        </div>
      )}
    </div>
  )
}
