'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Settings, Trash2, Check, X, CalendarDays, Pencil } from 'lucide-react'

interface Service { id: string; name: string; duration_min: number; price: string | null; active?: boolean; gap_min?: number; min_notice_min?: number; charge_mode?: string; charge_value?: string | null; hold_minutes?: number }
interface Appt {
  id: string
  customer_name: string | null
  customer_phone: string | null
  customer_email?: string | null
  booked_by?: string | null
  title: string | null
  start_at: string
  end_at: string
  status: string
  notes: string | null
  service?: { name: string; duration_min: number } | null
  contact?: { name: string | null; phone: string } | null
}

const WD = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const STATUS: Record<string, { label: string; cls: string }> = {
  scheduled: { label: 'Agendado', cls: 'bg-brand/15 text-brand' },
  pending_payment: { label: 'Aguardando pagamento', cls: 'bg-amber-500/15 text-amber-600' },
  confirmed: { label: 'Confirmado', cls: 'bg-green-500/15 text-green-600' },
  cancelled: { label: 'Cancelado', cls: 'bg-red-500/15 text-red-500' },
  done: { label: 'Concluído', cls: 'bg-surface2 text-muted' },
  no_show: { label: 'Não compareceu', cls: 'bg-orange-500/15 text-orange-500' }
}

function ymd(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
function hm(iso: string) { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }
function minToHM(m: number) { return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` }
function hmToMin(s: string) { const [h, m] = s.split(':').map(Number); return h * 60 + (m || 0) }

export function AgendaClient() {
  const [day, setDay] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d })
  const [appts, setAppts] = useState<Appt[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [showForm, setShowForm] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [error, setError] = useState('')
  const [view, setView] = useState<'day' | 'month'>('day')

  const loadAppts = useCallback(async () => {
    const from = new Date(day); const to = new Date(day); to.setHours(23, 59, 59)
    const r = await fetch(`/api/scheduling/appointments?from=${from.toISOString()}&to=${to.toISOString()}`, { cache: 'no-store' })
    if (r.ok) setAppts(await r.json())
  }, [day])

  const loadServices = useCallback(async () => {
    const r = await fetch('/api/scheduling/services', { cache: 'no-store' })
    if (r.ok) setServices(await r.json())
  }, [])

  useEffect(() => { loadAppts() }, [loadAppts])
  useEffect(() => { loadServices() }, [loadServices])

  function shift(days: number) { const d = new Date(day); d.setDate(d.getDate() + days); setDay(d) }

  async function patch(id: string, body: any) {
    await fetch('/api/scheduling/appointments', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...body }) })
    loadAppts()
  }
  async function remove(id: string) {
    if (!confirm('Excluir este agendamento?')) return
    await fetch('/api/scheduling/appointments', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    loadAppts()
  }

  const isToday = ymd(day) === ymd(new Date())

  return (
    <div className="p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agenda</h1>
          <p className="mt-1 text-sm text-muted">Gerencie seus agendamentos.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-line p-0.5 text-sm">
            <button onClick={() => setView('day')} className={`rounded-md px-3 py-1.5 ${view === 'day' ? 'bg-brand text-white' : 'text-muted hover:text-fg'}`}>Dia</button>
            <button onClick={() => setView('month')} className={`rounded-md px-3 py-1.5 ${view === 'month' ? 'bg-brand text-white' : 'text-muted hover:text-fg'}`}>Mês</button>
          </div>
          <button onClick={() => setShowConfig(!showConfig)} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm text-muted hover:text-fg">
            <Settings className="h-4 w-4" /> Configurar
          </button>
          <button onClick={() => { setShowForm(!showForm); setError('') }} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-600">
            <Plus className="h-4 w-4" /> Novo agendamento
          </button>
        </div>
      </div>

      {showConfig && <ConfigPanel services={services} onServices={loadServices} />}

      {showForm && (
        <NewAppointmentForm
          services={services}
          defaultDate={ymd(day)}
          onClose={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); loadAppts() }}
          onError={setError}
        />
      )}
      {error && <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-500">{error}</div>}

      {view === 'month' && (
        <MonthCalendar
          refDay={day}
          onPickDay={(d) => { setDay(d); setView('day') }}
        />
      )}

      {view === 'day' && <>
      {/* Navegação de dia */}
      <div className="mb-4 flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3">
        <button onClick={() => shift(-1)} className="rounded-lg p-1.5 text-muted hover:bg-surface2"><ChevronLeft className="h-5 w-5" /></button>
        <div className="text-center">
          <div className="text-sm font-semibold capitalize">{WD[day.getDay()]}, {day.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}</div>
          {!isToday && <button onClick={() => { const d = new Date(); d.setHours(0,0,0,0); setDay(d) }} className="text-xs text-brand hover:underline">Hoje</button>}
        </div>
        <button onClick={() => shift(1)} className="rounded-lg p-1.5 text-muted hover:bg-surface2"><ChevronRight className="h-5 w-5" /></button>
      </div>

      {/* Lista do dia */}
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        {appts.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <CalendarDays className="mb-3 h-8 w-8 text-faint" />
            <p className="text-sm text-muted">Nenhum agendamento neste dia.</p>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {appts.map((a) => {
              const st = STATUS[a.status] || STATUS.scheduled
              const who = a.customer_name || a.contact?.name || a.customer_phone || a.contact?.phone || 'Cliente'
              return (
                <div key={a.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <div className="w-16 text-center">
                    <div className="text-lg font-bold text-fg">{hm(a.start_at)}</div>
                    <div className="text-[10px] text-faint">{hm(a.end_at)}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-fg">{who}</span>
                      {a.booked_by && <span className="text-xs text-faint">· agendado por {a.booked_by}</span>}
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${st.cls}`}>{st.label}</span>
                    </div>
                    <div className="text-xs text-muted">
                      {a.service?.name || a.title || 'Agendamento'}
                      {(a.customer_phone || a.contact?.phone) && <> · {a.customer_phone || a.contact?.phone}</>}
                      {a.customer_email && <> · {a.customer_email}</>}
                    </div>
                    {a.notes && <div className="mt-0.5 text-xs text-faint">{a.notes}</div>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {a.status !== 'confirmed' && a.status !== 'cancelled' && (
                      <button onClick={() => patch(a.id, { status: 'confirmed' })} title="Confirmar" className="rounded-lg border border-line p-1.5 text-muted hover:text-green-600"><Check className="h-4 w-4" /></button>
                    )}
                    {a.status !== 'done' && (
                      <button onClick={() => patch(a.id, { status: 'done' })} title="Concluir" className="rounded-lg border border-line px-2 py-1.5 text-xs text-muted hover:text-fg">Concluir</button>
                    )}
                    {a.status !== 'cancelled' && (
                      <button onClick={() => patch(a.id, { status: 'cancelled' })} title="Cancelar" className="rounded-lg border border-line p-1.5 text-muted hover:text-red-500"><X className="h-4 w-4" /></button>
                    )}
                    <button onClick={() => remove(a.id)} title="Excluir" className="rounded-lg border border-line p-1.5 text-muted hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      </>}
    </div>
  )
}

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const WD_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function MonthCalendar({ refDay, onPickDay }: { refDay: Date; onPickDay: (d: Date) => void }) {
  const [cursor, setCursor] = useState(() => new Date(refDay.getFullYear(), refDay.getMonth(), 1))
  const [byDay, setByDay] = useState<Record<string, Appt[]>>({})

  useEffect(() => {
    const from = new Date(cursor.getFullYear(), cursor.getMonth(), 1, 0, 0, 0)
    const to = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59)
    fetch(`/api/scheduling/appointments?from=${from.toISOString()}&to=${to.toISOString()}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : [])
      .then((rows: Appt[]) => {
        const map: Record<string, Appt[]> = {}
        for (const a of rows) { const k = ymd(new Date(a.start_at)); (map[k] ||= []).push(a) }
        setByDay(map)
      }).catch(() => setByDay({}))
  }, [cursor])

  function shiftMonth(n: number) { setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1)) }

  const firstWeekday = cursor.getDay()
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()
  const cells: (Date | null)[] = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d))
  while (cells.length % 7 !== 0) cells.push(null)
  const todayStr = ymd(new Date())

  return (
    <div className="mb-4 rounded-2xl border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => shiftMonth(-1)} className="rounded-lg p-1.5 text-muted hover:bg-surface2"><ChevronLeft className="h-5 w-5" /></button>
        <div className="text-sm font-semibold capitalize">{MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</div>
        <button onClick={() => shiftMonth(1)} className="rounded-lg p-1.5 text-muted hover:bg-surface2"><ChevronRight className="h-5 w-5" /></button>
      </div>
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-faint">
        {WD_SHORT.map((w) => <div key={w} className="py-1">{w}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="aspect-square rounded-lg" />
          const key = ymd(d)
          const list = byDay[key] || []
          const active = list.filter((a) => a.status !== 'cancelled')
          const isToday = key === todayStr
          return (
            <button key={i} onClick={() => onPickDay(d)}
              className={`aspect-square rounded-lg border p-1 text-left transition hover:border-brand hover:bg-brand/5 ${isToday ? 'border-brand bg-brand/5' : 'border-line'}`}>
              <div className={`text-xs font-semibold ${isToday ? 'text-brand' : 'text-fg'}`}>{d.getDate()}</div>
              {active.length > 0 && (
                <div className="mt-0.5 space-y-0.5">
                  {active.slice(0, 2).map((a) => (
                    <div key={a.id} className="truncate rounded bg-brand/15 px-1 text-[9px] leading-tight text-brand">
                      {hm(a.start_at)} {a.customer_name || a.contact?.name || a.service?.name || ''}
                    </div>
                  ))}
                  {active.length > 2 && <div className="px-1 text-[9px] text-muted">+{active.length - 2}</div>}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

type HoursMap = Record<number, { on: boolean; start: string; end: string }>
function emptyHours(): HoursMap {
  const h: HoursMap = {}
  for (let w = 0; w < 7; w++) h[w] = { on: false, start: '08:00', end: '18:00' }
  return h
}

function ServiceEditor({ service, onChanged, onDelete }: {
  service: Service
  onChanged: () => void
  onDelete: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(service.name)
  const [duration, setDuration] = useState(service.duration_min)
  const [price, setPrice] = useState(service.price || '')
  const [gap, setGap] = useState(service.gap_min || 0)
  const initialNotice = service.min_notice_min || 0
  const [noticeVal, setNoticeVal] = useState(() => initialNotice / (initialNotice > 0 && initialNotice % 1440 === 0 ? 1440 : initialNotice > 0 && initialNotice % 60 === 0 ? 60 : 1))
  const [noticeUnit, setNoticeUnit] = useState(() => initialNotice > 0 && initialNotice % 1440 === 0 ? 1440 : initialNotice > 0 && initialNotice % 60 === 0 ? 60 : 1)
  const [hours, setHours] = useState<HoursMap>(emptyHours())
  const [chargeMode, setChargeMode] = useState(service.charge_mode || 'none')
  const [chargeValue, setChargeValue] = useState(service.charge_value || '')
  const [holdMinutes, setHoldMinutes] = useState(service.hold_minutes || 30)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)

  async function loadHours() {
    const r = await fetch(`/api/scheduling/availability?service_id=${service.id}`, { cache: 'no-store' })
    const rules: any[] = r.ok ? await r.json() : []
    const h = emptyHours()
    for (const rule of rules) h[rule.weekday] = { on: true, start: minToHM(rule.start_min), end: minToHM(rule.end_min) }
    setHours(h); setLoaded(true)
  }
  function toggle() { const next = !open; setOpen(next); if (next && !loaded) loadHours() }

  async function save() {
    setSaving(true)
    const svcRes = await fetch('/api/scheduling/services', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: service.id, name, duration_min: duration, price: String(price), gap_min: gap, min_notice_min: noticeVal * noticeUnit, charge_mode: chargeMode, charge_value: String(chargeValue), hold_minutes: holdMinutes })
    })
    const rules = Object.entries(hours).filter(([, v]) => v.on).map(([w, v]) => ({ weekday: Number(w), start_min: hmToMin(v.start), end_min: hmToMin(v.end) }))
    const avRes = await fetch('/api/scheduling/availability', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service_id: service.id, rules })
    })
    setSaving(false)
    if (!svcRes.ok || !avRes.ok) { alert('Não foi possível salvar. Tente novamente.'); return }
    onChanged(); setOpen(false)
  }

  return (
    <div className="rounded-lg border border-line bg-background text-sm">
      <div className="flex items-center justify-between px-3 py-2">
        <button onClick={toggle} className="flex-1 text-left">
          {service.name} <span className="text-faint">· {service.duration_min}min{service.price ? ` · R$ ${service.price}` : ''}</span>
        </button>
        <div className="flex items-center gap-1.5">
          <button onClick={toggle} className="text-faint hover:text-brand" title="Editar"><Pencil className="h-3.5 w-3.5" /></button>
          <button onClick={() => onDelete(service.id)} className="text-faint hover:text-red-500" title="Excluir"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      {open && (
        <div className="space-y-3 border-t border-line px-3 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" className="min-w-[8rem] flex-1 rounded border border-line bg-surface px-2 py-1 focus:border-brand focus:outline-none" />
            <input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-16 rounded border border-line bg-surface px-2 py-1" />
            <span className="text-xs text-faint">min</span>
            <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="R$" className="w-16 rounded border border-line bg-surface px-2 py-1" />
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-muted">Horários de atendimento</p>
            <div className="space-y-1.5">
              {WD.map((label, w) => {
                const h = hours[w]
                return (
                  <div key={w} className="flex items-center gap-2">
                    <label className="flex w-24 items-center gap-1.5">
                      <input type="checkbox" checked={h.on} onChange={(e) => setHours({ ...hours, [w]: { ...h, on: e.target.checked } })} />
                      {label.slice(0, 3)}
                    </label>
                    <input type="time" value={h.start} disabled={!h.on} onChange={(e) => setHours({ ...hours, [w]: { ...h, start: e.target.value } })} className="rounded border border-line bg-surface px-2 py-1 text-xs disabled:opacity-40" />
                    <span className="text-faint">–</span>
                    <input type="time" value={h.end} disabled={!h.on} onChange={(e) => setHours({ ...hours, [w]: { ...h, end: e.target.value } })} className="rounded border border-line bg-surface px-2 py-1 text-xs disabled:opacity-40" />
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex items-center gap-2 border-t border-line pt-3">
            <label className="flex-1 text-muted">Intervalo entre atendimentos</label>
            <input type="number" min={0} max={240} step={5} value={gap} onChange={(e) => setGap(Math.max(0, Number(e.target.value) || 0))} className="w-16 rounded border border-line bg-surface px-2 py-1" />
            <span className="text-xs text-faint">min</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex-1 text-muted">Antecedência mínima</label>
            <input type="number" min={0} value={noticeVal} onChange={(e) => setNoticeVal(Math.max(0, Number(e.target.value) || 0))} className="w-16 rounded border border-line bg-surface px-2 py-1" />
            <select value={noticeUnit} onChange={(e) => setNoticeUnit(Number(e.target.value))} className="rounded border border-line bg-surface px-2 py-1">
              <option value={1}>min</option>
              <option value={60}>horas</option>
              <option value={1440}>dias</option>
            </select>
          </div>

          <div className="border-t border-line pt-3">
            <p className="mb-1.5 text-xs font-medium text-muted">Cobrança de sinal (Pix)</p>
            <div className="flex flex-wrap items-center gap-2">
              <select value={chargeMode} onChange={(e) => setChargeMode(e.target.value)} className="rounded border border-line bg-surface px-2 py-1">
                <option value="none">Sem cobrança</option>
                <option value="fixed">Sinal fixo (R$)</option>
                <option value="percent">% do preço</option>
                <option value="full">Valor cheio</option>
              </select>
              {(chargeMode === 'fixed' || chargeMode === 'percent') && (
                <>
                  <input type="number" min={0} value={chargeValue} onChange={(e) => setChargeValue(e.target.value)} placeholder={chargeMode === 'percent' ? '%' : 'R$'} className="w-20 rounded border border-line bg-surface px-2 py-1" />
                  <span className="text-xs text-faint">{chargeMode === 'percent' ? '%' : 'R$'}</span>
                </>
              )}
            </div>
            {chargeMode !== 'none' && (
              <div className="mt-2 flex items-center gap-2">
                <label className="flex-1 text-muted">Prazo para pagar (pré-reserva)</label>
                <input type="number" min={5} max={1440} step={5} value={holdMinutes} onChange={(e) => setHoldMinutes(Math.max(5, Number(e.target.value) || 30))} className="w-20 rounded border border-line bg-surface px-2 py-1" />
                <span className="text-xs text-faint">min</span>
              </div>
            )}
            {chargeMode !== 'none' && <p className="mt-1.5 text-xs text-faint">Requer o Mercado Pago do seu negócio conectado em Configurações. O horário fica reservado até o pagamento ou o fim do prazo.</p>}
          </div>

          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="rounded-lg bg-brand px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">{saving ? 'Salvando…' : 'Salvar'}</button>
            <button onClick={() => setOpen(false)} className="rounded-lg border border-line px-4 py-1.5 text-sm text-muted hover:text-fg">Fechar</button>
          </div>
        </div>
      )}
    </div>
  )
}

function NewAppointmentForm({ services, defaultDate, onClose, onCreated, onError }: {
  services: Service[]; defaultDate: string; onClose: () => void; onCreated: () => void; onError: (s: string) => void
}) {
  const [name, setName] = useState('')
  const [bookedBy, setBookedBy] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [date, setDate] = useState(defaultDate)
  const [time, setTime] = useState('09:00')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); onError('')
    const start = new Date(`${date}T${time}:00`)
    const r = await fetch('/api/scheduling/appointments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_name: name, booked_by: bookedBy || undefined, customer_phone: phone, customer_email: email || undefined, service_id: serviceId || undefined, start_at: start.toISOString(), notes })
    })
    setSaving(false)
    if (r.ok) onCreated()
    else onError((await r.json()).error || 'Erro ao agendar')
  }

  return (
    <form onSubmit={submit} className="mb-4 grid grid-cols-1 gap-3 rounded-2xl border border-line bg-surface p-5 sm:grid-cols-2">
      <input required placeholder="Para quem é (aluno/paciente/cliente)" value={name} onChange={(e) => setName(e.target.value)} className="rounded-lg border border-line bg-background px-3 py-2 text-sm focus:border-brand focus:outline-none" />
      <input placeholder="Agendado por / responsável (opcional)" value={bookedBy} onChange={(e) => setBookedBy(e.target.value)} className="rounded-lg border border-line bg-background px-3 py-2 text-sm focus:border-brand focus:outline-none" />
      <input placeholder="Telefone (opcional)" value={phone} onChange={(e) => setPhone(e.target.value)} className="rounded-lg border border-line bg-background px-3 py-2 text-sm focus:border-brand focus:outline-none" />
      <input type="email" placeholder="E-mail (para confirmação)" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-lg border border-line bg-background px-3 py-2 text-sm focus:border-brand focus:outline-none sm:col-span-2" />
      <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} className="rounded-lg border border-line bg-background px-3 py-2 text-sm focus:border-brand focus:outline-none">
        <option value="">Serviço (opcional)</option>
        {services.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.duration_min}min)</option>)}
      </select>
      <div className="flex gap-2">
        <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="flex-1 rounded-lg border border-line bg-background px-3 py-2 text-sm focus:border-brand focus:outline-none" />
        <input type="time" required value={time} onChange={(e) => setTime(e.target.value)} className="w-28 rounded-lg border border-line bg-background px-3 py-2 text-sm focus:border-brand focus:outline-none" />
      </div>
      <input placeholder="Observações (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-lg border border-line bg-background px-3 py-2 text-sm focus:border-brand focus:outline-none sm:col-span-2" />
      <div className="flex gap-2 sm:col-span-2">
        <button disabled={saving} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">{saving ? 'Salvando…' : 'Agendar'}</button>
        <button type="button" onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm text-muted hover:text-fg">Cancelar</button>
      </div>
    </form>
  )
}

function ConfigPanel({ services, onServices }: { services: Service[]; onServices: () => void }) {
  const [name, setName] = useState('')
  const [duration, setDuration] = useState(60)
  const [price, setPrice] = useState('')

  async function addService(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const r = await fetch('/api/scheduling/services', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, duration_min: duration, price }) })
    if (!r.ok) {
      const d = await r.json().catch(() => ({}))
      alert(d.error || 'Não foi possível cadastrar o serviço. Se o problema persistir, avise o suporte (pode ser necessário atualizar o banco).')
      return
    }
    setName(''); setDuration(60); setPrice(''); onServices()
  }
  async function delService(id: string) {
    if (!confirm('Excluir este serviço? Agendamentos já feitos continuam existindo.')) return
    await fetch('/api/scheduling/services', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    onServices()
  }

  return (
    <div className="mb-4 rounded-2xl border border-line bg-surface p-5">
      <h3 className="mb-1 text-sm font-semibold">Serviços</h3>
      <p className="mb-3 text-xs text-muted">Cada serviço tem seus próprios horários de atendimento, intervalo e antecedência mínima. Clique em um serviço para configurar.</p>
      <div className="mb-3 space-y-2">
        {services.map((s) => (
          <ServiceEditor key={s.id} service={s} onChanged={onServices} onDelete={delService} />
        ))}
        {services.length === 0 && <p className="text-xs text-faint">Nenhum serviço cadastrado.</p>}
      </div>
      <form onSubmit={addService} className="flex flex-wrap gap-2">
        <input placeholder="Nome do novo serviço" value={name} onChange={(e) => setName(e.target.value)} className="flex-1 rounded-lg border border-line bg-background px-3 py-1.5 text-sm focus:border-brand focus:outline-none" />
        <input type="number" placeholder="min" value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-16 rounded-lg border border-line bg-background px-2 py-1.5 text-sm" />
        <input placeholder="R$" value={price} onChange={(e) => setPrice(e.target.value)} className="w-16 rounded-lg border border-line bg-background px-2 py-1.5 text-sm" />
        <button className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600">+</button>
      </form>
    </div>
  )
}
