'use client'

import { useState } from 'react'

interface TenantLite {
  name: string
  email: string
  plan: string
  whatsapp_connected: boolean
  whatsapp_needs_reconnect: boolean
}

type Field = 'tenant' | 'to' | 'text' | 'code'

interface Tool {
  id: string
  title: string
  desc: string
  path: string
  fields: Field[]
  extra?: Record<string, string>
  danger?: string // texto de confirmação: ação que altera dados
}

const GROUPS: { title: string; tools: Tool[] }[] = [
  {
    title: 'WhatsApp',
    tools: [
      { id: 'token-health', title: 'Validade dos tokens (todos)', desc: 'Pergunta à Meta se o token de cada tenant é válido, o tipo e quando vence.', path: '/api/admin/token-health', fields: [] },
      { id: 'wa-fix', title: 'Verificar e corrigir WhatsApp', desc: 'Valida o token, consulta o número, reinscreve o app (recebimento) e mostra mensagens recebidas nas últimas 3h. Com telefone, envia um teste.', path: '/api/admin/wa-fix', fields: ['tenant', 'to'] },
      { id: 'wa-unpause', title: 'Despausar conversas', desc: 'Tira de "pendente" as conversas em que o bot estava pausado aguardando atendimento humano.', path: '/api/admin/wa-fix', fields: ['tenant'], extra: { unpause: '1' }, danger: 'Despausar todas as conversas pendentes deste tenant?' },
      { id: 'platform-token', title: 'Usar token permanente da plataforma', desc: 'Troca o token do tenant pelo da plataforma (não expira), se tiver permissão de mensagens na conta. Guarda o anterior.', path: '/api/admin/use-platform-token', fields: ['tenant'], danger: 'Trocar o token do WhatsApp deste tenant pelo token da plataforma?' },
      { id: 'platform-undo', title: 'Desfazer troca de token', desc: 'Volta para o token anterior guardado.', path: '/api/admin/use-platform-token', fields: ['tenant'], extra: { undo: '1' }, danger: 'Voltar para o token anterior deste tenant?' }
    ]
  },
  {
    title: 'Bot e IA',
    tools: [
      { id: 'ai-health', title: 'Saúde da IA', desc: 'Faz uma chamada real à IA e mostra provedor, modelo e erro (crédito, chave, modelo).', path: '/api/admin/ai-health', fields: [] },
      { id: 'bot-diagnose', title: 'Testar o bot do tenant', desc: 'Roda o bot com o prompt real e a mensagem abaixo, sem enviar ao WhatsApp, e lista travas (pausas, handoff).', path: '/api/admin/bot-diagnose', fields: ['tenant', 'text'], extra: { run: '1' } },
      { id: 'voice-health', title: 'Áudio do tenant', desc: 'Últimos áudios, conversa em volta do último, última falha do bot e teste da IA com o texto do áudio.', path: '/api/admin/voice-health', fields: ['tenant'] }
    ]
  },
  {
    title: 'Dados e anúncios',
    tools: [
      { id: 'ads-diagnose', title: 'Rastreamento Google Ads', desc: 'Cliques de anúncio registrados e quais viraram conversa. Opcional: código do clique.', path: '/api/admin/ads-diagnose', fields: ['code'] },
      { id: 'migrate-schemas', title: 'Migrar schemas dos tenants', desc: 'Aplica o schema atual do banco em todos os tenants (cria tabelas/colunas que faltam).', path: '/api/admin/migrate-schemas', fields: [], danger: 'Aplicar o schema do banco em todos os tenants?' }
    ]
  }
]

const inputCls = 'w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none'

export function DiagnosticsPanel({ tenants }: { tenants: TenantLite[] }) {
  const [email, setEmail] = useState(tenants[0]?.email || '')
  const [to, setTo] = useState('')
  const [text, setText] = useState('Olá, gostaria de mais informações')
  const [code, setCode] = useState('')
  const [running, setRunning] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [result, setResult] = useState<{ tool: string; status: number; body: string } | null>(null)

  async function run(tool: Tool) {
    setConfirming(null)
    setRunning(tool.id)
    setResult(null)
    const qs = new URLSearchParams(tool.extra || {})
    if (tool.fields.includes('tenant')) qs.set('email', email)
    if (tool.fields.includes('to') && to.trim()) qs.set('to', to.replace(/\D/g, ''))
    if (tool.fields.includes('text')) qs.set('text', text)
    if (tool.fields.includes('code') && code.trim()) qs.set('code', code.trim())
    try {
      const r = await fetch(`${tool.path}?${qs.toString()}`, { cache: 'no-store' })
      const raw = await r.text()
      let body = raw
      try { body = JSON.stringify(JSON.parse(raw), null, 2) } catch { /* não é JSON */ }
      setResult({ tool: tool.title, status: r.status, body })
    } catch (e: any) {
      setResult({ tool: tool.title, status: 0, body: e?.message || 'Erro de conexão' })
    } finally {
      setRunning(null)
    }
  }

  const sel = tenants.find((t) => t.email === email)

  return (
    <div className="mt-6 space-y-6">
      {/* Parâmetros comuns */}
      <div className="grid gap-3 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="diag-tenant" className="mb-1 block text-xs font-semibold text-muted">Tenant</label>
          <select id="diag-tenant" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls}>
            {tenants.map((t) => (
              <option key={t.email} value={t.email}>
                {t.name} — {t.email} ({t.plan}){t.whatsapp_needs_reconnect ? ' ⚠️ reconectar' : ''}
              </option>
            ))}
          </select>
          {sel && (
            <p className="mt-1 text-xs text-faint">
              WhatsApp {sel.whatsapp_connected ? 'conectado' : 'não conectado'}
              {sel.whatsapp_needs_reconnect ? ' · a Meta recusou o token — precisa reconectar' : ''}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="diag-to" className="mb-1 block text-xs font-semibold text-muted">Telefone para teste de envio (opcional)</label>
          <input id="diag-to" value={to} onChange={(e) => setTo(e.target.value)} inputMode="tel" placeholder="5511999998888" className={inputCls} />
          <p className="mt-1 text-[11px] text-faint">Só entrega se esse número falou com o tenant nas últimas 24h.</p>
        </div>
        <div>
          <label htmlFor="diag-text" className="mb-1 block text-xs font-semibold text-muted">Mensagem para testar o bot</label>
          <input id="diag-text" value={text} onChange={(e) => setText(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label htmlFor="diag-code" className="mb-1 block text-xs font-semibold text-muted">Código do clique Google Ads (opcional)</label>
          <input id="diag-code" value={code} onChange={(e) => setCode(e.target.value)} className={inputCls} />
        </div>
      </div>

      {GROUPS.map((g) => (
        <section key={g.title}>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-faint">{g.title}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {g.tools.map((tool) => (
              <div key={tool.id} className="flex flex-col rounded-2xl border border-line bg-surface p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-fg">{tool.title}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tool.danger ? 'bg-amber-500/15 text-amber-500' : 'bg-surface2 text-muted'}`}>
                    {tool.danger ? 'altera dados' : tool.fields.includes('tenant') ? 'por tenant' : 'geral'}
                  </span>
                </div>
                <p className="mt-1 flex-1 text-xs leading-relaxed text-muted">{tool.desc}</p>
                {confirming === tool.id ? (
                  <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
                    <p className="text-xs text-fg">{tool.danger}{tool.fields.includes('tenant') && sel ? ` (${sel.name})` : ''}</p>
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => run(tool)} className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600">Confirmar</button>
                      <button onClick={() => setConfirming(null)} className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted hover:bg-surface2">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => (tool.danger ? setConfirming(tool.id) : run(tool))}
                    disabled={!!running || (tool.fields.includes('tenant') && !email)}
                    className="mt-3 self-start rounded-lg bg-brand px-3.5 py-2 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-40"
                  >
                    {running === tool.id ? 'Executando…' : 'Executar'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      {result && (
        <section className="rounded-2xl border border-line bg-surface p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-fg">Resultado · {result.tool}</h2>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${result.status >= 200 && result.status < 300 ? 'bg-green-500/15 text-green-500' : 'bg-red-500/15 text-red-500'}`}>
              HTTP {result.status || 'erro'}
            </span>
          </div>
          <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-xl bg-background p-3 text-xs leading-relaxed text-fg">{result.body}</pre>
        </section>
      )}
    </div>
  )
}
