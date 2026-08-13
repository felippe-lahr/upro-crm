'use client'

import { useEffect, useRef, useState } from 'react'

const WD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
]

// Helpers de data em fuso LOCAL (evita o shift de UTC do toISOString).
function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function parseISO(s?: string): Date | null {
  if (!s) return null
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}
function fmtBR(s?: string): string {
  const d = parseISO(s)
  if (!d) return ''
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

/**
 * Date-picker sempre em pt-BR (dd/mm/aaaa), independente do navegador.
 * value/onChange usam ISO "AAAA-MM-DD" (mesmo formato de <input type="date">).
 */
export function DatePickerBR({
  value,
  onChange,
  min,
  max,
  placeholder = 'dd/mm/aaaa'
}: {
  value: string
  onChange: (iso: string) => void
  min?: string
  max?: string
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = parseISO(value)
  const [view, setView] = useState<Date>(() => {
    const base = selected || new Date()
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  // Ao abrir, posiciona o mês na data selecionada (se houver).
  useEffect(() => {
    if (open && selected) setView(new Date(selected.getFullYear(), selected.getMonth(), 1))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const minD = parseISO(min)
  const maxD = parseISO(max)
  const today = new Date(); today.setHours(0, 0, 0, 0)

  function disabled(d: Date): boolean {
    if (minD && d < minD) return true
    if (maxD && d > maxD) return true
    return false
  }
  function pick(d: Date) {
    if (disabled(d)) return
    onChange(toISO(d))
    setOpen(false)
  }

  // Monta a grade do mês (semanas começando no domingo).
  const firstWeekday = view.getDay()
  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate()
  const cells: (Date | null)[] = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(view.getFullYear(), view.getMonth(), d))
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-fg focus:border-brand focus:outline-none"
      >
        <svg className="h-3.5 w-3.5 text-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
        <span className={value ? 'text-fg' : 'text-faint'}>{value ? fmtBR(value) : placeholder}</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-[260px] rounded-xl border border-line bg-surface p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
              className="rounded-md p-1 text-muted hover:bg-surface2 hover:text-fg" aria-label="Mês anterior">
              ‹
            </button>
            <span className="text-sm font-semibold capitalize text-fg">
              {MONTHS[view.getMonth()]} {view.getFullYear()}
            </span>
            <button type="button" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
              className="rounded-md p-1 text-muted hover:bg-surface2 hover:text-fg" aria-label="Próximo mês">
              ›
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[10px] text-faint">
            {WD.map((w) => <div key={w} className="py-1">{w}</div>)}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((d, i) => {
              if (!d) return <div key={i} />
              const iso = toISO(d)
              const isSel = value === iso
              const isToday = d.getTime() === today.getTime()
              const isDisabled = disabled(d)
              return (
                <button
                  key={i}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => pick(d)}
                  className={`aspect-square rounded-md text-xs transition-colors ${
                    isSel
                      ? 'bg-brand font-semibold text-white'
                      : isDisabled
                        ? 'cursor-not-allowed text-faint/40'
                        : isToday
                          ? 'text-brand hover:bg-surface2'
                          : 'text-fg hover:bg-surface2'
                  }`}
                >
                  {d.getDate()}
                </button>
              )
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
            <button type="button" onClick={() => { onChange(''); setOpen(false) }}
              className="text-xs text-faint hover:text-red-400">
              Limpar
            </button>
            <button type="button" onClick={() => pick(new Date())}
              className="text-xs font-medium text-brand hover:underline">
              Hoje
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
