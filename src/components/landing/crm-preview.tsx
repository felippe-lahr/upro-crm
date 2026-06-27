import { Search, Send } from 'lucide-react'

const CONVERSATIONS = [
  { initial: 'A', name: 'Aisha', last: 'Obrigada! Recebi 🙏', active: true, unread: false },
  { initial: 'D', name: 'Diego', last: 'Vocês entregam em SP?', active: false, unread: true },
  { initial: 'Y', name: 'Yuki', last: 'Tabela de preços enviada', active: false, unread: false },
  { initial: 'L', name: 'Lucas', last: 'Perfeito, vou testar.', active: false, unread: false },
  { initial: 'M', name: 'Marina', last: 'Oi! Vi o anúncio de vocês…', active: false, unread: true }
]

/**
 * Mockup animado do inbox do CRM para o hero da landing.
 * Apenas CSS — sem JS — para manter leve e renderizar no servidor.
 */
export function CrmPreview() {
  return (
    <div className="animate-float-slow w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0d1626] shadow-2xl shadow-blue-900/40 ring-1 ring-white/5">
      {/* Topbar */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-white/20" />
          <span className="h-3 w-3 rounded-full bg-white/20" />
          <span className="h-3 w-3 rounded-full bg-white/20" />
          <span className="ml-3 text-xs font-medium text-white/50">Inbox · UProCRM</span>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-semibold text-green-400">
          <span className="animate-pulse-ring h-1.5 w-1.5 rounded-full bg-green-400" />
          AO VIVO
        </span>
      </div>

      <div className="grid grid-cols-[1.1fr_1.4fr]">
        {/* Lista de conversas */}
        <div className="border-r border-white/10">
          <div className="flex items-center gap-2 px-3 py-2.5">
            <div className="flex flex-1 items-center gap-2 rounded-lg bg-white/5 px-2.5 py-1.5">
              <Search className="h-3.5 w-3.5 text-white/40" />
              <span className="text-[11px] text-white/40">Buscar conversas…</span>
            </div>
          </div>
          {CONVERSATIONS.map((c) => (
            <div
              key={c.name}
              className={`flex items-center gap-2.5 px-3 py-2.5 ${
                c.active ? 'border-l-2 border-blue-500 bg-blue-500/10' : 'border-l-2 border-transparent'
              }`}
            >
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-[11px] font-semibold text-blue-300">
                {c.initial}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-medium text-white/90">{c.name}</span>
                  {c.unread && <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />}
                </div>
                <p className="truncate text-[11px] text-white/45">{c.last}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Thread */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/20 text-[11px] font-semibold text-blue-300">
                A
              </div>
              <div>
                <div className="text-[12px] font-semibold text-white/90">Aisha</div>
                <div className="text-[10px] text-white/40">+55 11 9 8888-7777</div>
              </div>
            </div>
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/50">Aberta</span>
          </div>

          <div className="flex-1 space-y-2.5 px-4 py-4">
            <div className="animate-msg-in max-w-[80%] rounded-2xl rounded-tl-sm bg-white/8 px-3 py-2 text-[12px] text-white/80" style={{ animationDelay: '0.1s' }}>
              Oi! O plano tem bot de IA incluso?
            </div>
            <div className="animate-msg-in ml-auto max-w-[80%] rounded-2xl rounded-tr-sm bg-blue-500 px-3 py-2 text-[12px] text-white" style={{ animationDelay: '0.5s' }}>
              Tem sim 🤖 Ele responde 24/7 com o tom da sua marca.
            </div>
            <div className="animate-msg-in max-w-[80%] rounded-2xl rounded-tl-sm bg-white/8 px-3 py-2 text-[12px] text-white/80" style={{ animationDelay: '1s' }}>
              Perfeito! Quero contratar.
            </div>
            {/* Typing */}
            <div className="flex w-12 items-center justify-center gap-1 rounded-2xl rounded-tl-sm bg-white/8 px-3 py-2.5">
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-white/50" style={{ animationDelay: '0s' }} />
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-white/50" style={{ animationDelay: '0.2s' }} />
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-white/50" style={{ animationDelay: '0.4s' }} />
            </div>
          </div>

          <div className="flex items-center gap-2 border-t border-white/10 px-3 py-2.5">
            <div className="flex-1 rounded-lg bg-white/5 px-3 py-2 text-[11px] text-white/40">
              Digite uma mensagem…
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500">
              <Send className="h-3.5 w-3.5 text-white" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
