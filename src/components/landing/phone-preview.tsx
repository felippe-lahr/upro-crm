const ROWS = [
  { initial: 'A', name: 'Aisha', last: 'Obrigada! Recebi 🙏', unread: false },
  { initial: 'D', name: 'Diego', last: 'Vocês entregam em SP?', unread: true },
  { initial: 'M', name: 'Marina', last: 'Oi! Vi o anúncio…', unread: true },
  { initial: 'L', name: 'Lucas', last: 'Perfeito, vou testar.', unread: false }
]

/**
 * Mockup de iPhone mostrando o app (PWA) aberto — inbox no celular.
 * Moldura escura (funciona nos dois temas); a tela usa tokens semânticos.
 */
export function PhonePreview() {
  return (
    <div className="animate-float-slow w-[188px] rounded-[2.3rem] bg-neutral-900 p-2 shadow-2xl shadow-brand/30 ring-1 ring-black/30" style={{ animationDelay: '0.6s' }}>
      <div className="relative overflow-hidden rounded-[1.8rem] bg-background">
        {/* notch */}
        <div className="absolute left-1/2 top-0 z-10 h-4 w-16 -translate-x-1/2 rounded-b-2xl bg-neutral-900" />
        <div className="h-5" />

        {/* top bar */}
        <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
          <div className="flex flex-col gap-[3px]">
            <span className="h-0.5 w-4 rounded bg-muted" />
            <span className="h-0.5 w-4 rounded bg-muted" />
            <span className="h-0.5 w-4 rounded bg-muted" />
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-upro-novo.png" alt="UProCRM" className="h-5 w-5 rounded" />
          <span className="text-[11px] font-bold text-fg">UProCRM</span>
        </div>

        {/* conversas */}
        <div className="divide-y divide-line">
          {ROWS.map((r) => (
            <div key={r.name} className="flex items-center gap-2 px-3 py-2.5">
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand/15 text-[10px] font-semibold text-brand">
                {r.initial}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-fg">{r.name}</span>
                  {r.unread && <span className="h-1.5 w-1.5 rounded-full bg-brand" />}
                </div>
                <p className="truncate text-[10px] text-faint">{r.last}</p>
              </div>
            </div>
          ))}
        </div>

        {/* barra inferior (home indicator) */}
        <div className="flex justify-center py-2">
          <span className="h-1 w-16 rounded-full bg-muted/50" />
        </div>
      </div>
    </div>
  )
}
