'use client'

import { useEffect, useState } from 'react'
import { MoreVertical, UserPlus, X } from 'lucide-react'

interface Member {
  id: string
  name: string | null
  email: string
  role: string
  created_at: string
}

const AVATAR_COLORS = ['#7c5cff', '#2f9e6b', '#d9772e', '#2563eb', '#c2417a', '#0e9aa7', '#8a6d1f']
function colorFor(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}
function initials(name: string | null, email: string) {
  const base = (name || email).trim()
  const parts = base.split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

const fieldCls = 'w-full rounded-xl border border-line bg-background px-3.5 py-3 text-sm text-fg focus:border-brand focus:outline-none'

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [me, setMe] = useState<string | null>(null)
  const [canManage, setCanManage] = useState(false)
  const [loading, setLoading] = useState(true)

  const [sheet, setSheet] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'agent' | 'admin'>('agent')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [action, setAction] = useState<{ id: string; kind: 'password' | 'remove' } | null>(null)
  const [newPass, setNewPass] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  async function load() {
    try {
      const r = await fetch('/api/tenant/team', { cache: 'no-store' })
      const d = await r.json()
      if (r.ok) {
        setMembers(d.members || [])
        setMe(d.me || null)
        setCanManage(!!d.canManage)
      }
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  function openSheet() {
    setName(''); setEmail(''); setPassword(''); setRole('agent'); setFormError('')
    setSheet(true)
  }

  async function create() {
    setSaving(true); setFormError('')
    try {
      const r = await fetch('/api/tenant/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role })
      })
      const d = await r.json()
      if (!r.ok) { setFormError(d.error || 'Não foi possível criar o acesso.'); return }
      setSheet(false)
      setNotice(`Acesso criado para ${d.member.name}. Envie o e-mail e a senha provisória para a pessoa entrar.`)
      load()
    } catch {
      setFormError('Erro de conexão. Tente de novo.')
    } finally {
      setSaving(false)
    }
  }

  async function patch(id: string, body: Record<string, unknown>, ok: string) {
    setError(''); setNotice('')
    const r = await fetch('/api/tenant/team', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...body })
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) { setError(d.error || 'Não foi possível salvar.'); return false }
    setNotice(ok); load(); return true
  }

  async function remove(id: string) {
    setError(''); setNotice('')
    const r = await fetch(`/api/tenant/team?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) { setError(d.error || 'Não foi possível remover.'); return }
    setAction(null); setNotice('Acesso removido.'); load()
  }

  const canCreate = name.trim() && /^\S+@\S+\.\S+$/.test(email.trim()) && password.length >= 8

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-8">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-fg">Equipe</h1>
          <p className="mt-1 text-sm text-muted">
            {loading ? 'Carregando…' : `${members.length} ${members.length === 1 ? 'pessoa' : 'pessoas'} com acesso`}
          </p>
        </div>
        {canManage && (
          <button
            onClick={openSheet}
            className="hidden items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand/25 transition-colors hover:bg-brand-600 sm:inline-flex"
          >
            <UserPlus className="h-4 w-4" /> Adicionar atendente
          </button>
        )}
      </div>

      {canManage && (
        <button
          onClick={openSheet}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand/25 transition-colors hover:bg-brand-600 sm:hidden"
        >
          <UserPlus className="h-4 w-4" /> Adicionar atendente
        </button>
      )}

      {notice && <p className="mb-3 rounded-xl bg-brand/10 px-3.5 py-2.5 text-sm text-brand">{notice}</p>}
      {error && <p className="mb-3 rounded-xl bg-red-500/10 px-3.5 py-2.5 text-sm text-red-500">{error}</p>}

      <div className="flex flex-col gap-2.5">
        {members.map((m) => {
          const isMe = m.id === me
          const isAdmin = m.role === 'admin' || m.role === 'superadmin'
          const busyHere = action?.id === m.id
          return (
            <div key={m.id} className="rounded-2xl border border-line bg-surface">
              <div className="flex items-center gap-3 p-3.5">
                <div
                  className="grid h-11 w-11 flex-none place-items-center rounded-full text-sm font-bold text-white"
                  style={{ background: colorFor(m.email) }}
                >
                  {initials(m.name, m.email)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-[15px] font-semibold text-fg">{isMe ? 'Você' : (m.name || m.email)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${isAdmin ? 'bg-brand/15 text-brand' : 'bg-surface2 text-muted'}`}>
                      {isAdmin ? 'Admin' : 'Atendente'}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted">{m.email}</p>
                </div>
                {canManage && !isMe && m.role !== 'superadmin' && (
                  <div className="relative">
                    <button
                      onClick={() => setMenuFor(menuFor === m.id ? null : m.id)}
                      className="rounded-lg p-2 text-faint transition-colors hover:bg-surface2 hover:text-fg"
                      aria-label={`Opções de ${m.name || m.email}`}
                    >
                      <MoreVertical className="h-5 w-5" />
                    </button>
                    {menuFor === m.id && (
                      <div className="absolute right-0 top-10 z-20 w-52 overflow-hidden rounded-xl border border-line bg-surface shadow-xl">
                        <button
                          className="block w-full px-4 py-3 text-left text-sm text-fg hover:bg-surface2"
                          onClick={() => { setMenuFor(null); setNewPass(''); setAction({ id: m.id, kind: 'password' }) }}
                        >
                          Redefinir senha
                        </button>
                        <button
                          className="block w-full px-4 py-3 text-left text-sm text-fg hover:bg-surface2"
                          onClick={() => {
                            setMenuFor(null)
                            patch(m.id, { role: isAdmin ? 'agent' : 'admin' }, isAdmin ? 'Agora é Atendente.' : 'Agora é Admin.')
                          }}
                        >
                          {isAdmin ? 'Tornar Atendente' : 'Tornar Admin'}
                        </button>
                        <button
                          className="block w-full px-4 py-3 text-left text-sm text-red-500 hover:bg-red-500/10"
                          onClick={() => { setMenuFor(null); setAction({ id: m.id, kind: 'remove' }) }}
                        >
                          Remover acesso
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {busyHere && action?.kind === 'password' && (
                <div className="flex flex-col gap-2 border-t border-line p-3.5 sm:flex-row">
                  <input
                    id={`pass-${m.id}`}
                    type="text"
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    placeholder="Nova senha (mín. 8 caracteres)"
                    className={fieldCls}
                  />
                  <div className="flex gap-2">
                    <button
                      disabled={newPass.length < 8}
                      onClick={async () => { if (await patch(m.id, { password: newPass }, 'Senha redefinida. Envie a nova senha para a pessoa.')) setAction(null) }}
                      className="flex-1 rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-40 sm:flex-none"
                    >
                      Salvar
                    </button>
                    <button onClick={() => setAction(null)} className="rounded-xl border border-line px-4 py-3 text-sm text-muted hover:bg-surface2">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {busyHere && action?.kind === 'remove' && (
                <div className="flex flex-col gap-2 border-t border-line p-3.5 sm:flex-row sm:items-center">
                  <p className="flex-1 text-sm text-fg">Remover o acesso de <b>{m.name || m.email}</b>? A pessoa não consegue mais entrar.</p>
                  <div className="flex gap-2">
                    <button onClick={() => remove(m.id)} className="flex-1 rounded-xl bg-red-500 px-4 py-3 text-sm font-semibold text-white hover:bg-red-600 sm:flex-none">
                      Remover
                    </button>
                    <button onClick={() => setAction(null)} className="rounded-xl border border-line px-4 py-3 text-sm text-muted hover:bg-surface2">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-4 flex gap-3 rounded-2xl border border-line bg-surface2 p-3.5 text-[13px] leading-relaxed text-muted">
        <span aria-hidden="true">💡</span>
        <p>
          <b className="text-fg">Cada pessoa entra com o próprio login.</b> O <b className="text-fg">Admin</b> gerencia a equipe e as
          configurações; o <b className="text-fg">Atendente</b> atende as conversas e trabalha os leads do funil.
        </p>
      </div>

      {/* Folha por baixo (celular) / janela central (desktop) */}
      {sheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 sm:items-center sm:p-4" onClick={() => !saving && setSheet(false)}>
          <div
            role="dialog"
            aria-label="Adicionar atendente"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-3xl border border-line bg-surface px-5 pb-[calc(20px+env(safe-area-inset-bottom,0px))] pt-2 shadow-2xl sm:rounded-3xl sm:pb-5"
          >
            <div className="mx-auto mb-3 mt-1 h-1 w-10 rounded-full bg-line sm:hidden" />
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-lg font-bold text-fg">Adicionar atendente</h2>
              <button onClick={() => setSheet(false)} className="rounded-lg p-1.5 text-faint hover:bg-surface2 hover:text-fg" aria-label="Fechar">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4 text-[13px] text-muted">Cria um acesso próprio para a pessoa entrar no CRM.</p>

            <div className="flex flex-col gap-3">
              <div>
                <label htmlFor="team-name" className="mb-1.5 block text-xs font-semibold text-muted">Nome</label>
                <input id="team-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Larissa Prado" className={fieldCls} />
              </div>
              <div>
                <label htmlFor="team-email" className="mb-1.5 block text-xs font-semibold text-muted">E-mail (login)</label>
                <input id="team-email" type="email" inputMode="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="larissa@suaempresa.com.br" className={fieldCls} />
              </div>
              <div>
                <label htmlFor="team-pass" className="mb-1.5 block text-xs font-semibold text-muted">Senha provisória</label>
                <input id="team-pass" type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="mín. 8 caracteres" className={fieldCls} />
              </div>
              <div>
                <span className="mb-1.5 block text-xs font-semibold text-muted">Papel</span>
                <div className="flex gap-2">
                  {(['agent', 'admin'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`flex-1 rounded-xl border px-3 py-3 text-sm font-semibold transition-colors ${
                        role === r ? 'border-brand bg-brand/10 text-brand' : 'border-line bg-background text-muted hover:text-fg'
                      }`}
                    >
                      {r === 'agent' ? 'Atendente' : 'Admin'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {formError && <p className="mt-3 text-sm text-red-500">{formError}</p>}

            <button
              onClick={create}
              disabled={!canCreate || saving}
              className="mt-5 w-full rounded-xl bg-brand py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand/25 transition-colors hover:bg-brand-600 disabled:opacity-40"
            >
              {saving ? 'Criando…' : 'Criar acesso'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
