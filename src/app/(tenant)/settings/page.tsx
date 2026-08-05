'use client'

import { useState, useEffect } from 'react'
import { PushToggle } from '@/components/ui/push-toggle'

interface MenuOption {
  id?: string
  label: string
  response: string
}

interface TenantSettings {
  id: string
  name: string
  email: string
  plan: string
  status: string
  whatsapp_connected: boolean
  phone_number_id: string | null
  bot_enabled: boolean
  bot_prompt: string | null
  summary_instructions: string | null
  trial_ends_at: string | null
  menu_bot_enabled: boolean
  menu_bot_greeting: string | null
  menu_bot_options: MenuOption[] | null
  handoff_pause: boolean
  keep_responding_after_human: boolean
  mp_connected?: boolean
  products_feed_url?: string | null
  products_synced_at?: string | null
  products_count?: number
}

function MercadoPagoConnect({ connected }: { connected: boolean }) {
  const [token, setToken] = useState('')
  const [isConnected, setIsConnected] = useState(connected)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { setIsConnected(connected) }, [connected])

  async function save(newToken: string | null) {
    setSaving(true); setMsg('')
    const res = await fetch('/api/tenant/settings', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mp_access_token: newToken })
    })
    setSaving(false)
    if (!res.ok) { setMsg('Erro ao salvar.'); return }
    setIsConnected(!!newToken); setToken('')
    setMsg(newToken ? 'Mercado Pago conectado!' : 'Mercado Pago desconectado.')
    setTimeout(() => setMsg(''), 3000)
  }

  return (
    <section className="mb-6 rounded-2xl border border-line bg-surface p-6">
      <h2 className="mb-1 font-semibold text-fg">Mercado Pago (cobrança de agendamentos)</h2>
      <p className="mb-4 text-sm text-muted">
        Conecte a conta Mercado Pago do seu negócio para receber os sinais/pagamentos de agendamento via Pix.
        Cole o <strong>Access Token</strong> de produção (Mercado Pago → Suas integrações → Credenciais de produção).
      </p>
      {isConnected ? (
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/15 px-3 py-1 text-sm font-medium text-green-600">● Conectado</span>
          <button onClick={() => save(null)} disabled={saving} className="text-sm text-muted hover:text-red-500">Desconectar</button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="APP_USR-..." className="min-w-[16rem] flex-1 rounded-lg border border-line bg-background px-3 py-2 text-sm focus:border-brand focus:outline-none" />
          <button onClick={() => token.trim() && save(token.trim())} disabled={saving || !token.trim()} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">Conectar</button>
        </div>
      )}
      {msg && <p className="mt-2 text-sm text-brand">{msg}</p>}
    </section>
  )
}

function ProductFeed({ initialUrl, syncedAt, count }: { initialUrl: string; syncedAt: string | null; count: number }) {
  const [url, setUrl] = useState(initialUrl)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [lastSync, setLastSync] = useState(syncedAt)
  const [total, setTotal] = useState(count)

  async function saveUrl(newUrl: string | null) {
    setSaving(true); setMsg(''); setErr('')
    const res = await fetch('/api/tenant/settings', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products_feed_url: newUrl })
    })
    setSaving(false)
    if (!res.ok) { const d = await res.json().catch(() => ({})); setErr(d.error || 'Falha ao salvar'); return }
    setMsg(newUrl ? 'Feed salvo.' : 'Feed removido.')
  }

  async function syncNow() {
    setSyncing(true); setMsg(''); setErr('')
    // Salva a URL antes de sincronizar, garantindo que o backend use a atual.
    await saveUrl(url.trim() || null)
    const res = await fetch('/api/tenant/products/sync', { method: 'POST' })
    const d = await res.json().catch(() => ({}))
    setSyncing(false)
    if (!res.ok || !d.ok) { setErr(d.error || 'Falha na sincronização'); return }
    setTotal(d.total); setLastSync(new Date().toISOString())
    setMsg(`Sincronizado: ${d.total} produtos (${d.upserted} atualizados, ${d.outOfStock} fora de estoque).`)
  }

  return (
    <section className="mb-6 rounded-2xl border border-line bg-surface p-6">
      <h2 className="mb-1 font-semibold text-fg">Catálogo de produtos (Promaster)</h2>
      <p className="mb-4 text-sm text-muted">
        Cole a URL do seu <strong>feed XML de produtos</strong> (padrão Google Merchant/RSS 2.0, exportado por Tray, Nuvemshop, VTEX, WooCommerce, Shopify, Bling).
        O bot passa a responder sobre catálogo, preço e disponibilidade, enviando o link da página do produto para o cliente concluir a compra.
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          type="url" value={url} onChange={(e) => setUrl(e.target.value)}
          placeholder="https://sualoja.com.br/xml/feed.xml"
          className="min-w-[18rem] flex-1 rounded-lg border border-line bg-background px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
        <button onClick={() => saveUrl(url.trim() || null)} disabled={saving || syncing} className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-fg hover:bg-surface2 disabled:opacity-50">Salvar</button>
        <button onClick={syncNow} disabled={syncing || saving || !url.trim()} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">
          {syncing ? 'Sincronizando…' : 'Sincronizar agora'}
        </button>
      </div>
      <p className="mt-3 text-xs text-faint">
        {total > 0 ? `${total} produtos no catálogo` : 'Nenhum produto sincronizado ainda'}
        {lastSync ? ` · última sincronização ${new Date(lastSync).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}` : ''}
        {' · '}sincroniza automaticamente a cada hora.
      </p>
      {msg && <p className="mt-2 text-sm text-brand">{msg}</p>}
      {err && <p className="mt-2 text-sm text-red-500">{err}</p>}
    </section>
  )
}

// Upload do logo do cliente → vira a foto de perfil do WhatsApp Business do número.
function WhatsAppProfilePhoto() {
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // permite reenviar o mesmo arquivo
    if (!file) return
    setUploading(true); setMsg(''); setErr('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/whatsapp/profile-photo', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setErr(data.error || 'Falha ao enviar o logo.'); return }
      setMsg('Logo aplicado! A nova foto aparece nas conversas em instantes.')
      setTimeout(() => setMsg(''), 5000)
    } catch {
      setErr('Erro ao enviar. Tente novamente.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="mt-5 border-t border-line pt-4">
      <p className="text-sm font-medium text-fg">Logo do WhatsApp</p>
      <p className="mt-0.5 text-xs text-muted">
        Imagem que aparece no topo da conversa para quem fala com você. Use o logo da sua
        empresa (JPG ou PNG, quadrado, até 5 MB).
      </p>
      <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-medium text-fg transition-colors hover:border-brand hover:text-brand">
        {uploading ? 'Enviando...' : 'Enviar logo'}
        <input type="file" accept="image/jpeg,image/png" onChange={onFile} disabled={uploading} className="hidden" />
      </label>
      {msg && <p className="mt-2 text-sm text-brand">{msg}</p>}
      {err && <p className="mt-2 text-sm text-red-400">{err}</p>}
    </div>
  )
}

// Wizard de conexão por "número próprio" (modelo custom / projeto premium).
// Sobrepõe o endpoint /api/admin/connect-whatsapp-manual (protegido pelo token
// do operador) para conectar um número sem precisar de curl nem do Embedded Signup.
function OwnNumberConnect({ email }: { email: string }) {
  const [open, setOpen] = useState(false)
  const [token, setToken] = useState('')
  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [wabaId, setWabaId] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  async function connect() {
    setSaving(true); setMsg(''); setErr('')
    try {
      const res = await fetch('/api/admin/connect-whatsapp-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token.trim(),
          email,
          phone_number_id: phoneNumberId.trim(),
          access_token: accessToken.trim(),
          waba_id: wabaId.trim() || undefined
        })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setErr(data.error || 'Falha ao conectar.'); return }
      setMsg('Número conectado! Recarregando...')
      setTimeout(() => window.location.reload(), 1200)
    } catch {
      setErr('Erro de conexão. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-5 border-t border-line pt-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-xs font-medium text-faint transition-colors hover:text-brand"
      >
        {open ? '− ' : '+ '}Conectar número próprio (avançado)
      </button>

      {open && (
        <div className="mt-4 space-y-3 rounded-lg border border-line bg-background p-4">
          <p className="text-xs text-muted">
            Para projetos customizados: conecte um número WhatsApp Business informando os
            dados da Meta (Business Manager). Requer o <strong>token do operador</strong>.
            Não depende do App Review.
          </p>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Token do operador"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none"
          />
          <input
            value={phoneNumberId}
            onChange={(e) => setPhoneNumberId(e.target.value)}
            placeholder="phone_number_id (Meta)"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none"
          />
          <input
            type="password"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder="access_token (System User Token)"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none"
          />
          <input
            value={wabaId}
            onChange={(e) => setWabaId(e.target.value)}
            placeholder="waba_id (opcional)"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none"
          />
          <button
            onClick={connect}
            disabled={saving || !token.trim() || !phoneNumberId.trim() || !accessToken.trim()}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-40"
          >
            {saving ? 'Conectando...' : 'Conectar número próprio'}
          </button>
          {msg && <p className="text-sm text-brand">{msg}</p>}
          {err && <p className="text-sm text-red-400">{err}</p>}
        </div>
      )}
    </div>
  )
}

interface QuickReply {
  id: string
  shortcut: string
  content: string
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<TenantSettings | null>(null)
  const [botEnabled, setBotEnabled] = useState(false)
  const [botPrompt, setBotPrompt] = useState('')
  const [summaryInstructions, setSummaryInstructions] = useState('')
  const [menuBotEnabled, setMenuBotEnabled] = useState(false)
  const [menuGreeting, setMenuGreeting] = useState('')
  const [menuOptions, setMenuOptions] = useState<MenuOption[]>([])
  const [handoffPause, setHandoffPause] = useState(false)
  const [keepResponding, setKeepResponding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Promaster inclui tudo do Pro (bot com IA) + catálogo de produtos.
  const isPromaster = settings?.plan === 'promaster'
  const isPro = settings?.plan === 'pro' || isPromaster

  const [replies, setReplies] = useState<QuickReply[]>([])
  const [shortcut, setShortcut] = useState('')
  const [content, setContent] = useState('')

  const [showCancel, setShowCancel] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const [cancelConfirmText, setCancelConfirmText] = useState('')

  useEffect(() => {
    fetch('/api/tenant/settings')
      .then((r) => r.json())
      .then((data) => {
        setSettings(data)
        setBotEnabled(data.bot_enabled)
        setBotPrompt(data.bot_prompt || '')
        setSummaryInstructions(data.summary_instructions || '')
        setMenuBotEnabled(data.menu_bot_enabled)
        setMenuGreeting(data.menu_bot_greeting || '')
        setMenuOptions(
          Array.isArray(data.menu_bot_options) && data.menu_bot_options.length
            ? data.menu_bot_options
            : [{ label: '', response: '' }]
        )
        setHandoffPause(!!data.handoff_pause)
        setKeepResponding(!!data.keep_responding_after_human)
      })
    loadReplies()
  }, [])

  function loadReplies() {
    fetch('/api/quick-replies')
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setReplies(d))
      .catch(() => {})
  }

  async function saveSettings() {
    setSaving(true)
    setSaved(false)
    setSaveError('')
    const res = await fetch('/api/tenant/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bot_enabled: isPro ? botEnabled : false,
        bot_prompt: botPrompt,
        ...(isPro ? { summary_instructions: summaryInstructions } : {}),
        menu_bot_enabled: menuBotEnabled,
        menu_bot_greeting: menuGreeting,
        menu_bot_options: menuOptions.filter((o) => o.label.trim()),
        handoff_pause: handoffPause,
        keep_responding_after_human: keepResponding
      })
    })
    setSaving(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setSaveError(d.error || 'Erro ao salvar.')
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  function updateOption(i: number, field: 'label' | 'response', value: string) {
    setMenuOptions((opts) => opts.map((o, idx) => (idx === i ? { ...o, [field]: value } : o)))
  }
  function addOption() {
    setMenuOptions((opts) => (opts.length >= 3 ? opts : [...opts, { label: '', response: '' }]))
  }
  function removeOption(i: number) {
    setMenuOptions((opts) => opts.filter((_, idx) => idx !== i))
  }

  async function addReply() {
    if (!shortcut.trim() || !content.trim()) return
    await fetch('/api/quick-replies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shortcut, content })
    })
    setShortcut('')
    setContent('')
    loadReplies()
  }

  async function cancelSubscription() {
    setCancelling(true)
    setCancelError('')
    try {
      const res = await fetch('/api/billing/cancel', { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.ok) {
        window.location.href = '/login'
      } else {
        setCancelError(data.error || 'Não foi possível cancelar. Tente novamente.')
      }
    } catch {
      setCancelError('Erro ao cancelar. Tente novamente.')
    } finally {
      setCancelling(false)
    }
  }

  async function deleteReply(id: string) {
    await fetch('/api/quick-replies', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    })
    loadReplies()
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl p-4 sm:p-8">
      <h1 className="mb-8 text-2xl font-bold text-fg">Configurações</h1>

      {/* Account */}
      <section className="mb-6 rounded-2xl border border-line bg-surface p-6">
        <h2 className="mb-4 font-semibold text-fg">Conta</h2>
        <dl className="space-y-3">
          <Row label="Empresa" value={settings.name} />
          <Row label="Email" value={settings.email} />
          <div className="flex justify-between text-sm">
            <dt className="text-muted">Plano</dt>
            <dd>
              <span className="rounded-full bg-brand/15 px-2 py-0.5 text-xs font-medium capitalize text-brand">
                {settings.plan}
              </span>
            </dd>
          </div>
          <div className="flex justify-between text-sm">
            <dt className="text-muted">Status</dt>
            <dd>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                  settings.status === 'active'
                    ? 'bg-brand/15 text-brand'
                    : 'bg-red-500/15 text-red-400'
                }`}
              >
                {settings.status}
              </span>
            </dd>
          </div>
        </dl>

        {settings.status === 'active' && (
          <div className="mt-5 border-t border-line pt-5">
            {!showCancel ? (
              <button
                onClick={() => setShowCancel(true)}
                className="text-xs text-faint transition-colors hover:text-red-400"
              >
                Cancelar assinatura
              </button>
            ) : (
              <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
                <p className="text-sm font-medium text-fg">Tem certeza que quer cancelar?</p>
                <p className="mt-1 text-xs text-muted">
                  Ao cancelar, você perde imediatamente o acesso a tudo que construiu no UProCRM:
                </p>
                <ul className="mt-3 space-y-1.5 text-xs text-muted">
                  <li className="flex gap-2">
                    <span className="text-red-400">✕</span>
                    <span><strong className="text-fg">Atendimento automático com IA</strong> — o bot deixa de responder seus clientes 24/7</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-red-400">✕</span>
                    <span><strong className="text-fg">Histórico de conversas</strong> — todas as mensagens e o contexto dos seus clientes ficam inacessíveis</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-red-400">✕</span>
                    <span><strong className="text-fg">Sua base de contatos</strong> — leads e clientes cadastrados deixam de ser acessíveis</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-red-400">✕</span>
                    <span><strong className="text-fg">Funil de vendas</strong> — o acompanhamento das suas negociações em andamento</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-red-400">✕</span>
                    <span><strong className="text-fg">Conexão com o WhatsApp</strong> e os disparos em massa configurados</span>
                  </li>
                </ul>
                <p className="mt-3 text-xs text-muted">
                  Não haverá novas cobranças. Esta ação não pode ser desfeita — para voltar a usar,
                  será necessário assinar novamente.
                </p>
                <div className="mt-4">
                  <label className="block text-xs text-muted">
                    Para confirmar, digite <strong className="text-fg">CANCELAR</strong> abaixo:
                  </label>
                  <input
                    value={cancelConfirmText}
                    onChange={(e) => setCancelConfirmText(e.target.value)}
                    placeholder="CANCELAR"
                    className="mt-1.5 w-full rounded-lg border border-line bg-background px-3 py-2 text-sm uppercase text-fg focus:border-red-500 focus:outline-none"
                  />
                </div>
                {cancelError && (
                  <p className="mt-2 text-xs text-red-400">{cancelError}</p>
                )}
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => { setShowCancel(false); setCancelError(''); setCancelConfirmText('') }}
                    disabled={cancelling}
                    className="rounded-lg bg-brand px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-40"
                  >
                    Manter minha assinatura
                  </button>
                  <button
                    onClick={cancelSubscription}
                    disabled={cancelling || cancelConfirmText.trim().toUpperCase() !== 'CANCELAR'}
                    className="rounded-lg bg-transparent px-4 py-2 text-xs font-medium text-faint transition-colors hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-faint"
                  >
                    {cancelling ? 'Cancelando...' : 'Cancelar mesmo assim'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* WhatsApp */}
      <section className="mb-6 rounded-2xl border border-line bg-surface p-6">
        <h2 className="mb-4 font-semibold text-fg">WhatsApp Business</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-fg">
              {settings.whatsapp_connected ? 'Conectado' : 'Não conectado'}
            </p>
            {settings.phone_number_id && (
              <p className="mt-0.5 text-xs text-faint">Phone ID: {settings.phone_number_id}</p>
            )}
          </div>
          <div
            className={`h-3 w-3 rounded-full ${
              settings.whatsapp_connected ? 'bg-brand' : 'bg-faint'
            }`}
          />
        </div>
        {!settings.whatsapp_connected ? (
          <a
            href="/onboarding/connect-whatsapp"
            className="mt-4 block rounded-lg bg-brand py-2 text-center text-sm font-medium text-white transition-colors hover:bg-brand-600"
          >
            Conectar WhatsApp
          </a>
        ) : (
          <button
            onClick={async () => {
              if (!confirm('Desconectar o WhatsApp? Você poderá reconectar em seguida pelo Embedded Signup.')) return
              const r = await fetch('/api/whatsapp/connect', { method: 'DELETE' })
              if (r.ok) window.location.reload()
              else alert('Não foi possível desconectar. Tente novamente.')
            }}
            className="mt-4 block w-full rounded-lg border border-line py-2 text-center text-sm font-medium text-muted transition-colors hover:border-red-500/40 hover:text-red-500"
          >
            Desconectar WhatsApp
          </button>
        )}

        {settings.whatsapp_connected && <WhatsAppProfilePhoto />}

        <OwnNumberConnect email={settings.email} />
      </section>

      {/* Notificações push (mobile) */}
      <PushToggle />

      {/* Mercado Pago (recebe os sinais de agendamento) */}
      <MercadoPagoConnect connected={!!(settings as any)?.mp_connected} />

      {isPromaster && (
        <ProductFeed
          initialUrl={settings.products_feed_url || ''}
          syncedAt={settings.products_synced_at || null}
          count={settings.products_count || 0}
        />
      )}

      {/* Bot com IA — exclusivo do Pro */}
      <section className="mb-6 rounded-2xl border border-line bg-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-fg">
              Bot com IA
              <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-purple-400">
                Pro
              </span>
            </h2>
            <p className="mt-0.5 text-xs text-faint">
              Responde automaticamente em linguagem natural com Claude
            </p>
          </div>
          <button
            onClick={() => isPro && setBotEnabled(!botEnabled)}
            disabled={!isPro}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              botEnabled && isPro ? 'bg-brand' : 'bg-surface2'
            } ${!isPro ? 'cursor-not-allowed opacity-50' : ''}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                botEnabled && isPro ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {!isPro && (
          <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-4">
            <p className="text-sm font-medium text-fg">Disponível no plano Pro</p>
            <p className="mt-1 text-xs text-muted">
              No plano Pro, o bot entende qualquer pergunta e responde sozinho em linguagem
              natural — ideal para tirar dúvidas, qualificar leads e atender 24/7.
            </p>
            <p className="mt-3 text-xs text-purple-400">
              Para fazer upgrade, entre em contato com o suporte.
            </p>
          </div>
        )}

        {isPro && botEnabled && (
          <div>
            <label className="mb-2 block text-sm font-medium text-fg">
              Personalidade e base de conhecimento do bot
            </label>
            <textarea
              value={botPrompt}
              onChange={(e) => setBotPrompt(e.target.value)}
              rows={6}
              placeholder="Ex: Você é o assistente da Escola XYZ. Horário: seg-sex 7h-18h. Séries: do maternal ao 9º ano. Atividades extracurriculares: judô (3ª e 5ª, 14h), ballet (2ª e 4ª, 15h), robótica (sáb 9h). Matrículas 2026 abertas. Sempre responda em português, seja cordial e, para matrícula, peça nome do responsável e telefone."
              className="w-full resize-none rounded-lg border border-line bg-background px-4 py-3 text-sm text-fg focus:border-brand focus:outline-none"
            />
            <p className="mt-2 text-xs text-faint">
              Quanto mais informação você colocar aqui (horários, valores, regras), melhor o bot
              responde. Ele usa tudo isso como base de conhecimento.
            </p>

            {/* Resumo do atendimento configurável (4.0) */}
            <div className="mt-5 border-t border-line pt-5">
              <label className="mb-2 block text-sm font-medium text-fg">
                O que o resumo do atendimento deve conter
              </label>
              <textarea
                value={summaryInstructions}
                onChange={(e) => setSummaryInstructions(e.target.value)}
                rows={4}
                placeholder="Ex: No resumo, sempre inclua o nome do cliente, telefone, e-mail e o serviço de interesse. Se houver, adicione orçamento e prazo desejado. Formato: 'Nome: … / Telefone: … / Serviço: … / Observações: …'"
                className="w-full resize-none rounded-lg border border-line bg-background px-4 py-3 text-sm text-fg focus:border-brand focus:outline-none"
              />
              <p className="mt-2 text-xs text-faint">
                Orienta o resumo gerado pela IA em cada atendimento (aparece no painel da conversa).
                Deixe em branco para usar o resumo padrão (1–2 frases). O telefone do contato é
                incluído automaticamente quando você pedir.
              </p>
            </div>

            {/* Opções de comportamento */}
            <div className="mt-5 space-y-4 border-t border-line pt-5">
              <ToggleRow
                title="Pausar e avisar ao encaminhar para humano"
                desc="Quando o bot escala um atendimento, ele para de responder e avisa o cliente que um atendente vai assumir."
                checked={handoffPause}
                onChange={() => setHandoffPause(!handoffPause)}
              />
              <ToggleRow
                title="Continuar respondendo após atendimento humano"
                desc="Por padrão, o bot fica em silêncio por 30 min quando um atendente responde. Ative para manter o bot respondendo mesmo assim."
                checked={keepResponding}
                onChange={() => setKeepResponding(!keepResponding)}
              />
            </div>
          </div>
        )}
      </section>

      {/* Menu bot — disponível no Básico */}
      <section className="mb-6 rounded-2xl border border-line bg-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-fg">Menu de atendimento</h2>
            <p className="mt-0.5 text-xs text-faint">
              Envia botões de opção ao cliente e responde cada escolha automaticamente
            </p>
          </div>
          <button
            onClick={() => setMenuBotEnabled(!menuBotEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              menuBotEnabled ? 'bg-brand' : 'bg-surface2'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                menuBotEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {menuBotEnabled && (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-fg">
                Mensagem de saudação
              </label>
              <input
                value={menuGreeting}
                onChange={(e) => setMenuGreeting(e.target.value)}
                placeholder="Ex: Olá! Bem-vindo à Escola XYZ. Como podemos ajudar?"
                className="w-full rounded-lg border border-line bg-background px-4 py-2.5 text-sm text-fg focus:border-brand focus:outline-none"
              />
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium text-fg">
                Opções (até 3 botões)
              </label>
              {menuOptions.map((opt, i) => (
                <div key={i} className="rounded-lg border border-line bg-background p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-brand">{i + 1}</span>
                    <input
                      value={opt.label}
                      onChange={(e) => updateOption(i, 'label', e.target.value)}
                      maxLength={20}
                      placeholder="Texto do botão (máx 20 car.)"
                      className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none"
                    />
                    {menuOptions.length > 1 && (
                      <button
                        onClick={() => removeOption(i)}
                        className="text-faint hover:text-red-400"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <textarea
                    value={opt.response}
                    onChange={(e) => updateOption(i, 'response', e.target.value)}
                    rows={2}
                    placeholder="Resposta enviada ao cliente quando ele escolher esta opção"
                    className="mt-2 w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none"
                  />
                </div>
              ))}
              {menuOptions.length < 3 && (
                <button
                  onClick={addOption}
                  className="text-xs font-medium text-brand hover:text-brand"
                >
                  + Adicionar opção
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      <div className="mb-8 flex items-center gap-3">
        <button
          onClick={saveSettings}
          disabled={saving}
          className="rounded-xl bg-brand px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-40"
        >
          {saving ? 'Salvando...' : 'Salvar configurações'}
        </button>
        {saved && <span className="text-sm text-brand">Salvo!</span>}
        {saveError && <span className="text-sm text-red-400">{saveError}</span>}
      </div>

      {/* Quick replies */}
      <section className="rounded-2xl border border-line bg-surface p-6">
        <h2 className="font-semibold text-fg">Respostas rápidas</h2>
        <p className="mt-0.5 mb-4 text-xs text-faint">
          Modelos de mensagem reutilizáveis nas conversas (ícone ⚡).
        </p>

        <div className="mb-4 space-y-2">
          {replies.map((r) => (
            <div
              key={r.id}
              className="flex items-start gap-3 rounded-lg border border-line bg-background p-3"
            >
              <span className="text-xs font-semibold text-brand">/{r.shortcut}</span>
              <span className="flex-1 text-sm text-muted">{r.content}</span>
              <button
                onClick={() => deleteReply(r.id)}
                className="text-faint hover:text-red-400"
              >
                ×
              </button>
            </div>
          ))}
          {replies.length === 0 && (
            <p className="text-xs text-faint">Nenhuma resposta rápida cadastrada.</p>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={shortcut}
            onChange={(e) => setShortcut(e.target.value)}
            placeholder="atalho"
            className="rounded-lg border border-line bg-background px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none sm:w-32"
          />
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Conteúdo da resposta"
            className="flex-1 rounded-lg border border-line bg-background px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none"
          />
          <button
            onClick={addReply}
            className="rounded-lg bg-surface2 px-4 py-2 text-sm font-medium text-fg hover:bg-line"
          >
            Adicionar
          </button>
        </div>
      </section>
    </div>
  )
}

function ToggleRow({
  title,
  desc,
  checked,
  onChange
}: {
  title: string
  desc: string
  checked: boolean
  onChange: () => void
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-fg">{title}</p>
        <p className="mt-0.5 text-xs text-faint">{desc}</p>
      </div>
      <button
        onClick={onChange}
        className={`relative mt-0.5 inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
          checked ? 'bg-brand' : 'bg-surface2'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium text-fg">{value}</dd>
    </div>
  )
}
