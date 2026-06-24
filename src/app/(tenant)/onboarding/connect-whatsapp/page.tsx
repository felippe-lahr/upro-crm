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
          handleSignupComplete(response.authResponse.code)
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

  async function handleSignupComplete(code: string) {
    try {
      const res = await fetch('/api/whatsapp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
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
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Conectar WhatsApp Business</h1>
        <p className="text-gray-500 mt-1">
          O processo leva menos de 2 minutos e é totalmente oficial pela Meta.
        </p>
      </div>

      {status === 'success' ? (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-green-800 mb-2">WhatsApp conectado!</h2>
          <p className="text-green-600 text-sm">Redirecionando para o dashboard...</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 p-8">
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-bold text-sm flex-shrink-0">
                1
              </div>
              <div>
                <p className="font-medium text-gray-900">Clique em &quot;Conectar WhatsApp&quot;</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  Uma janela da Meta vai abrir para você fazer login no Facebook/Meta Business
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-bold text-sm flex-shrink-0">
                2
              </div>
              <div>
                <p className="font-medium text-gray-900">Selecione seu número WhatsApp Business</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  Se ainda não tiver um, você pode criar durante o processo
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-bold text-sm flex-shrink-0">
                3
              </div>
              <div>
                <p className="font-medium text-gray-900">Pronto!</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  Suas mensagens começarão a chegar automaticamente no CRM
                </p>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="mt-6 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">
              {errorMsg}
            </div>
          )}

          <button
            onClick={launchEmbeddedSignup}
            disabled={status === 'loading'}
            className="mt-8 w-full bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white py-4 rounded-xl font-semibold text-lg transition-colors flex items-center justify-center gap-2"
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

          <p className="text-xs text-gray-400 text-center mt-4">
            Conexão oficial pela Meta Cloud API · Sem risco de ban
          </p>
        </div>
      )}
    </div>
  )
}
