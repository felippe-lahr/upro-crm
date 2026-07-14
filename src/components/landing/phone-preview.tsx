import { Search, Send, ArrowRight, Menu } from 'lucide-react'

const CONVS = [
  { i: 'A', n: 'Aisha', m: 'Obrigada! Recebi 🙏', u: false },
  { i: 'D', n: 'Diego', m: 'Vocês entregam em SP?', u: true },
  { i: 'M', n: 'Marina', m: 'Oi! Vi o anúncio…', u: true },
  { i: 'L', n: 'Lucas', m: 'Perfeito, vou testar.', u: false },
  { i: 'Y', n: 'Yuki', m: 'Tabela de preços enviada', u: false }
]

const H = 'h-[440px]'

function TopBar() {
  return (
    <div className="flex items-center gap-2 border-b border-line px-3.5 py-2.5">
      <Menu className="h-4 w-4 text-muted" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-upro-novo.png" alt="" className="h-5 w-5 rounded" />
      <span className="text-[12px] font-bold text-fg">UProCRM</span>
    </div>
  )
}

/* Tela 1 — Conversas */
function ScreenConversas() {
  return (
    <div className={`${H} w-full shrink-0 bg-background`}>
      <TopBar />
      <div className="flex items-center gap-2 px-3.5 py-2">
        <div className="flex flex-1 items-center gap-2 rounded-lg bg-surface2 px-2.5 py-1.5">
          <Search className="h-3.5 w-3.5 text-faint" />
          <span className="text-[11px] text-faint">Buscar conversas…</span>
        </div>
      </div>
      <div className="divide-y divide-line">
        {CONVS.map((c, idx) => (
          <div key={c.n} className={`flex items-center gap-2.5 px-3.5 py-2.5 ${idx === 0 ? 'bg-brand/5' : ''}`}>
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand/15 text-[11px] font-semibold text-brand">{c.i}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-fg">{c.n}</span>
                {c.u && <span className="h-2 w-2 rounded-full bg-brand" />}
              </div>
              <p className="truncate text-[11px] text-faint">{c.m}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* Tela 2 — Funil */
function ScreenFunil() {
  const cards = [
    { i: 'L', n: 'Felippe', m: 'Agendamento confirmado' },
    { i: 'D', n: 'Daniela', m: 'Perfeito, vou encaminhar' },
    { i: 'M', n: 'Marianna', m: 'Aí vamos nos falando!' }
  ]
  return (
    <div className={`${H} w-full shrink-0 bg-background`}>
      <TopBar />
      <div className="px-3.5 py-3">
        <div className="text-[15px] font-bold text-fg">Funil de Vendas</div>
        <div className="mt-3 rounded-2xl bg-surface2 p-2.5">
          <div className="mb-2 flex items-center gap-2 px-1">
            <span className="h-2 w-2 rounded-full bg-brand" />
            <span className="text-[11px] font-semibold text-fg">Em Atendimento</span>
            <span className="text-[10px] text-faint">3</span>
          </div>
          <div className="space-y-2">
            {cards.map((c) => (
              <div key={c.n} className="rounded-xl border border-line bg-surface p-2.5 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/15 text-[10px] font-semibold text-brand">{c.i}</div>
                  <span className="flex-1 text-[11px] font-semibold text-fg">{c.n}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-faint" />
                </div>
                <p className="mt-1 truncate pl-8 text-[10px] text-faint">{c.m}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* Tela 3 — Chat com bot */
function ScreenChat() {
  return (
    <div className={`${H} flex w-full shrink-0 flex-col bg-background`}>
      <div className="flex items-center gap-2 border-b border-line px-3.5 py-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/15 text-[11px] font-semibold text-brand">A</div>
        <div className="flex-1">
          <div className="text-[12px] font-semibold text-fg">Aisha</div>
          <div className="text-[9px] text-faint">+55 11 9 8888-7777</div>
        </div>
        <span className="rounded-full bg-surface2 px-2 py-0.5 text-[9px] text-muted">Aberta</span>
      </div>
      <div className="flex-1 space-y-2.5 p-3.5">
        <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-surface2 px-3 py-2 text-[11px] text-fg">Oi! O plano tem bot de IA incluso?</div>
        <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-brand px-3 py-2 text-[11px] text-white">Tem sim 🤖 Ele responde 24/7 com o tom da sua marca.</div>
        <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-surface2 px-3 py-2 text-[11px] text-fg">Perfeito! Quero contratar.</div>
        <div className="flex w-12 items-center justify-center gap-1 rounded-2xl rounded-tl-sm bg-surface2 px-3 py-2.5">
          <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted" />
          <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted" style={{ animationDelay: '0.2s' }} />
          <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted" style={{ animationDelay: '0.4s' }} />
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-line px-3 py-2.5">
        <div className="flex-1 rounded-lg bg-surface2 px-3 py-2 text-[10px] text-faint">Digite uma mensagem…</div>
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand"><Send className="h-3.5 w-3.5 text-white" /></div>
      </div>
    </div>
  )
}

/**
 * iPhone realista com carrossel animado das telas do PWA (Conversas → Funil → Chat).
 * Moldura em CSS; a tela usa tokens semânticos (claro/escuro).
 */
export function PhonePreview() {
  return (
    <div className="animate-float-slow relative" style={{ animationDelay: '0.5s' }}>
      {/* brilho atrás */}
      <div className="pointer-events-none absolute -inset-6 rounded-[3rem] bg-brand/25 blur-3xl" />

      {/* botões laterais */}
      <div className="absolute -left-[3px] top-24 h-8 w-[3px] rounded-l bg-neutral-700" />
      <div className="absolute -left-[3px] top-36 h-12 w-[3px] rounded-l bg-neutral-700" />
      <div className="absolute -right-[3px] top-32 h-16 w-[3px] rounded-r bg-neutral-700" />

      {/* moldura titânio */}
      <div className="relative rounded-[2.7rem] bg-gradient-to-b from-neutral-600 via-neutral-900 to-neutral-800 p-[3px] shadow-2xl shadow-brand/30 ring-1 ring-white/10">
        <div className="rounded-[2.5rem] bg-black p-[6px]">
          <div className="relative w-[212px] overflow-hidden rounded-[2.05rem] bg-background">
            {/* Dynamic Island */}
            <div className="absolute left-1/2 top-2 z-30 h-6 w-[70px] -translate-x-1/2 rounded-full bg-black" />
            {/* status bar */}
            <div className="relative z-20 flex items-center justify-between bg-background px-5 pb-1 pt-2.5 text-[9px] font-semibold text-fg">
              <span>9:41</span>
              <span className="flex items-center gap-1 text-muted">
                <span className="inline-block h-2 w-3 rounded-[2px] border border-current" />
              </span>
            </div>

            {/* viewport do carrossel */}
            <div className="relative h-[440px] overflow-hidden">
              <div className="animate-screens">
                <ScreenConversas />
                <ScreenFunil />
                <ScreenChat />
                <ScreenConversas />
              </div>
              {/* reflexo de luz */}
              <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
                <div className="animate-glare absolute -inset-y-16 left-0 w-2/5 bg-gradient-to-r from-transparent via-white/40 to-transparent" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
