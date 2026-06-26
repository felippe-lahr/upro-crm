'use client'

import { useState, useEffect } from 'react'

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
  trial_ends_at: string | null
  menu_bot_enabled: boolean
  menu_bot_greeting: string | null
  menu_bot_options: MenuOption[] | null
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
  const [menuBotEnabled, setMenuBotEnabled] = useState(false)
  const [menuGreeting, setMenuGreeting] = useState('')
  const [menuOptions, setMenuOptions] = useState<MenuOption[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')

  const isPro = settings?.plan === 'pro'

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
        setMenuBotEnabled(data.menu_bot_enabled)
        setMenuGreeting(data.menu_bot_greeting || '')
        setMenuOptions(
          Array.isArray(data.menu_bot_options) && data.menu_bot_options.length
            ? data.menu_bot_options
            : [{ label: '', response: '' }]
        )
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
        menu_bot_enabled: menuBotEnabled,
        menu_bot_greeting: menuGreeting,
        menu_bot_options: menuOptions.filter((o) => o.label.trim())
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
    <div className="max-w-2xl p-8">
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
              <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium capitalize text-green-400">
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
                    ? 'bg-green-500/15 text-green-400'
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
                    className="rounded-lg bg-green-500 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-green-600 disabled:opacity-40"
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
              settings.whatsapp_connected ? 'bg-green-500' : 'bg-faint'
            }`}
          />
        </div>
        {!settings.whatsapp_connected && (
          <a
            href="/onboarding/connect-whatsapp"
            className="mt-4 block rounded-lg bg-green-500 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-green-600"
          >
            Conectar WhatsApp
          </a>
        )}
      </section>

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
              botEnabled && isPro ? 'bg-green-500' : 'bg-surface2'
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
              className="w-full resize-none rounded-lg border border-line bg-background px-4 py-3 text-sm text-fg focus:border-green-500 focus:outline-none"
            />
            <p className="mt-2 text-xs text-faint">
              Quanto mais informação você colocar aqui (horários, valores, regras), melhor o bot
              responde. Ele usa tudo isso como base de conhecimento.
            </p>
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
              menuBotEnabled ? 'bg-green-500' : 'bg-surface2'
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
                className="w-full rounded-lg border border-line bg-background px-4 py-2.5 text-sm text-fg focus:border-green-500 focus:outline-none"
              />
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium text-fg">
                Opções (até 3 botões)
              </label>
              {menuOptions.map((opt, i) => (
                <div key={i} className="rounded-lg border border-line bg-background p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-green-400">{i + 1}</span>
                    <input
                      value={opt.label}
                      onChange={(e) => updateOption(i, 'label', e.target.value)}
                      maxLength={20}
                      placeholder="Texto do botão (máx 20 car.)"
                      className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg focus:border-green-500 focus:outline-none"
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
                    className="mt-2 w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg focus:border-green-500 focus:outline-none"
                  />
                </div>
              ))}
              {menuOptions.length < 3 && (
                <button
                  onClick={addOption}
                  className="text-xs font-medium text-green-400 hover:text-green-300"
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
          className="rounded-xl bg-green-500 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-600 disabled:opacity-40"
        >
          {saving ? 'Salvando...' : 'Salvar configurações'}
        </button>
        {saved && <span className="text-sm text-green-400">Salvo!</span>}
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
              <span className="text-xs font-semibold text-green-400">/{r.shortcut}</span>
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
            className="rounded-lg border border-line bg-background px-3 py-2 text-sm text-fg focus:border-green-500 focus:outline-none sm:w-32"
          />
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Conteúdo da resposta"
            className="flex-1 rounded-lg border border-line bg-background px-3 py-2 text-sm text-fg focus:border-green-500 focus:outline-none"
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium text-fg">{value}</dd>
    </div>
  )
}
