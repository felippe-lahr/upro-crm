'use client'

import { useState, useEffect } from 'react'

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
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<TenantSettings | null>(null)
  const [botEnabled, setBotEnabled] = useState(false)
  const [botPrompt, setBotPrompt] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/tenant/settings')
      .then((r) => r.json())
      .then((data) => {
        setSettings(data)
        setBotEnabled(data.bot_enabled)
        setBotPrompt(data.bot_prompt || '')
      })
  }, [])

  async function saveSettings() {
    setSaving(true)
    setSaved(false)
    await fetch('/api/tenant/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bot_enabled: botEnabled, bot_prompt: botPrompt })
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (!settings) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-gray-400">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Configurações</h1>

      {/* Account */}
      <section className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Conta</h2>
        <dl className="space-y-3">
          <div className="flex justify-between text-sm">
            <dt className="text-gray-500">Empresa</dt>
            <dd className="font-medium text-gray-900">{settings.name}</dd>
          </div>
          <div className="flex justify-between text-sm">
            <dt className="text-gray-500">Email</dt>
            <dd className="font-medium text-gray-900">{settings.email}</dd>
          </div>
          <div className="flex justify-between text-sm">
            <dt className="text-gray-500">Plano</dt>
            <dd>
              <span className="bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full capitalize">
                {settings.plan}
              </span>
            </dd>
          </div>
          <div className="flex justify-between text-sm">
            <dt className="text-gray-500">Status</dt>
            <dd>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                  settings.status === 'active'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {settings.status}
              </span>
            </dd>
          </div>
        </dl>
      </section>

      {/* WhatsApp */}
      <section className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">WhatsApp Business</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">
              {settings.whatsapp_connected ? 'Conectado' : 'Não conectado'}
            </p>
            {settings.phone_number_id && (
              <p className="text-xs text-gray-400 mt-0.5">
                Phone ID: {settings.phone_number_id}
              </p>
            )}
          </div>
          <div
            className={`w-3 h-3 rounded-full ${
              settings.whatsapp_connected ? 'bg-green-500' : 'bg-gray-300'
            }`}
          />
        </div>
        {!settings.whatsapp_connected && (
          <a
            href="/onboarding/connect-whatsapp"
            className="mt-4 block text-center bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Conectar WhatsApp
          </a>
        )}
      </section>

      {/* Bot IA */}
      <section className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-gray-900">Bot com IA</h2>
            <p className="text-xs text-gray-400 mt-0.5">Responde automaticamente com Claude Sonnet</p>
          </div>
          <button
            onClick={() => setBotEnabled(!botEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              botEnabled ? 'bg-green-500' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                botEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {botEnabled && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Personalidade do bot (system prompt)
            </label>
            <textarea
              value={botPrompt}
              onChange={(e) => setBotPrompt(e.target.value)}
              rows={4}
              placeholder="Ex: Você é um assistente da Empresa XYZ. Sempre seja educado, responda em português e encaminhe dúvidas complexas para um agente humano."
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
            />
          </div>
        )}
      </section>

      <div className="flex items-center gap-3">
        <button
          onClick={saveSettings}
          disabled={saving}
          className="bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white px-6 py-2.5 rounded-xl font-medium text-sm transition-colors"
        >
          {saving ? 'Salvando...' : 'Salvar configurações'}
        </button>
        {saved && <span className="text-green-600 text-sm">Salvo!</span>}
      </div>
    </div>
  )
}
