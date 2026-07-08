'use client'

import { useEffect, useState } from 'react'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

export function PushToggle() {
  const [supported, setSupported] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

  useEffect(() => {
    const ok = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    setSupported(ok)
    if (!ok) return
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setEnabled(!!sub))
      .catch(() => {})
  }, [])

  async function enable() {
    setBusy(true); setMsg('')
    try {
      if (!publicKey) { setMsg('Push não configurado no servidor.'); return }
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { setMsg('Permissão de notificação negada.'); return }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource
      })
      const res = await fetch('/api/push/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub)
      })
      if (!res.ok) throw new Error()
      setEnabled(true)
      setMsg('Notificações ativadas! Você será avisado de mensagens novas.')
    } catch {
      setMsg('Não foi possível ativar. Tente novamente.')
    } finally {
      setBusy(false)
      setTimeout(() => setMsg(''), 5000)
    }
  }

  async function sendTest() {
    setBusy(true); setMsg('')
    try {
      const res = await fetch('/api/push/test')
      const r = await res.json().catch(() => ({}))
      if (r.configured === false) setMsg('Servidor sem chaves VAPID. Verifique as variáveis no Railway.')
      else if (r.subs === 0) setMsg('Nenhum dispositivo inscrito. Desative e ative novamente.')
      else if (r.sent > 0) setMsg(`Teste enviado a ${r.sent} dispositivo(s). Deve chegar em instantes.`)
      else setMsg('Falha: ' + (r.errors?.join('; ') || 'erro desconhecido'))
    } catch {
      setMsg('Erro ao enviar teste.')
    } finally {
      setBusy(false)
      setTimeout(() => setMsg(''), 8000)
    }
  }

  async function disable() {
    setBusy(true); setMsg('')
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint })
        }).catch(() => {})
        await sub.unsubscribe().catch(() => {})
      }
      setEnabled(false)
      setMsg('Notificações desativadas.')
    } finally {
      setBusy(false)
      setTimeout(() => setMsg(''), 4000)
    }
  }

  return (
    <section className="mb-6 rounded-2xl border border-line bg-surface p-6">
      <h2 className="mb-1 font-semibold text-fg">Notificações no celular</h2>
      <p className="mb-4 text-sm text-muted">
        Receba um aviso no aparelho quando chegar uma mensagem nova — mesmo com o app fechado.
        {' '}No iPhone, instale o app na tela de início primeiro (Compartilhar → Adicionar à Tela de Início).
      </p>

      {!supported ? (
        <p className="text-sm text-faint">Este dispositivo/navegador não suporta notificações push.</p>
      ) : enabled ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/15 px-3 py-1 text-sm font-medium text-green-600">● Ativadas</span>
          <button onClick={sendTest} disabled={busy} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-fg hover:border-brand hover:text-brand disabled:opacity-50">Enviar teste</button>
          <button onClick={disable} disabled={busy} className="text-sm text-muted hover:text-red-500">Desativar</button>
        </div>
      ) : (
        <button onClick={enable} disabled={busy} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">
          {busy ? 'Ativando…' : 'Ativar notificações'}
        </button>
      )}
      {msg && <p className="mt-2 text-sm text-brand">{msg}</p>}
    </section>
  )
}
