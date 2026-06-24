import Link from 'next/link'

const FEATURES = [
  {
    icon: '💬',
    title: 'Inbox compartilhada',
    desc: 'Todas as conversas do WhatsApp num só lugar. Status (aberta / pendente / fechada), histórico completo e envio direto pela plataforma.'
  },
  {
    icon: '🤖',
    title: 'Bot com IA (Claude)',
    desc: 'O Claude Sonnet responde seus clientes 24/7 com o tom da sua marca. Você configura a personalidade uma vez.'
  },
  {
    icon: '🗂️',
    title: 'Funil de vendas Kanban',
    desc: 'Arraste leads entre os estágios — de novo lead a fechado. Veja o valor do pipeline em cada coluna.'
  },
  {
    icon: '📣',
    title: 'Disparos em massa',
    desc: 'Envie mensagens para todos os contatos ou segmente por etiqueta. Acompanhe entregas e falhas.'
  },
  {
    icon: '🏷️',
    title: 'Etiquetas e anotações',
    desc: 'Organize contatos com tags e registre anotações internas em cada conversa.'
  },
  {
    icon: '⚡',
    title: 'Respostas rápidas',
    desc: 'Crie modelos de mensagem reutilizáveis e insira com um clique durante o atendimento.'
  },
  {
    icon: '📊',
    title: 'Dashboard de métricas',
    desc: 'Contatos, mensagens do dia, conversas abertas, pipeline em negociação e total fechado.'
  },
  {
    icon: '🔌',
    title: 'Conexão oficial Meta',
    desc: 'WhatsApp Cloud API oficial. Sem risco de ban, sem gambiarras. Conexão em 2 minutos.'
  },
  {
    icon: '🔒',
    title: 'Dados isolados',
    desc: 'Cada cliente tem um banco de dados (schema) totalmente separado. Privacidade por arquitetura.'
  }
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0b0f14] text-[#e6e8eb]">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-[#1b222c] bg-[#0b0f14]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500">
              <span className="text-sm font-bold text-white">W</span>
            </div>
            <span className="text-lg font-bold">WaCRM</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-[#9aa6b2] transition-colors hover:text-white">
              Entrar
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-600"
            >
              Começar grátis
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-green-500/10 blur-3xl" />
        <div className="mx-auto max-w-6xl px-6 py-28 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-sm font-medium text-green-400">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            7 dias grátis, sem cartão
          </div>
          <h1 className="mb-6 text-5xl font-bold leading-tight md:text-6xl">
            CRM completo para<br />
            <span className="bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
              WhatsApp Business
            </span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-xl text-[#9aa6b2]">
            Inbox compartilhada, funil de vendas, disparos em massa e bot com IA — tudo
            num CRM multi-tenant com setup em 2 minutos.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/signup"
              className="rounded-xl bg-green-500 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-green-500/20 transition-colors hover:bg-green-600"
            >
              Criar conta grátis
            </Link>
            <Link
              href="#planos"
              className="rounded-xl border border-[#232c38] px-8 py-4 text-lg font-medium text-[#9aa6b2] transition-colors hover:border-[#3a4554] hover:text-white"
            >
              Ver planos
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-[#1b222c] py-24">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="mb-3 text-center text-3xl font-bold">Tudo que você precisa</h2>
          <p className="mb-14 text-center text-[#9aa6b2]">
            Um CRM pensado para quem vende e atende pelo WhatsApp.
          </p>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-[#1b222c] bg-[#131820] p-6 transition-colors hover:border-green-500/40"
              >
                <div className="mb-4 text-3xl">{f.icon}</div>
                <h3 className="mb-2 font-semibold">{f.title}</h3>
                <p className="text-sm text-[#9aa6b2]">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="planos" className="border-t border-[#1b222c] py-24">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="mb-3 text-center text-3xl font-bold">Planos simples</h2>
          <p className="mb-12 text-center text-[#9aa6b2]">
            Sem taxa de setup. Pague com Pix, boleto ou cartão via Mercado Pago. Cancele quando quiser.
          </p>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div className="rounded-2xl border border-[#232c38] bg-[#131820] p-8">
              <div className="mb-2 text-sm font-medium text-[#9aa6b2]">BÁSICO</div>
              <div className="mb-1 text-4xl font-bold">R$ 97</div>
              <div className="mb-6 text-sm text-[#9aa6b2]">/mês</div>
              <ul className="mb-8 space-y-3">
                {['1 número WhatsApp', 'Bot com IA', 'Funil de vendas Kanban', 'Disparos em massa', '5.000 mensagens/mês', 'Suporte por email'].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-[#c4cdd6]">
                    <span className="text-green-400">✓</span> {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="block w-full rounded-xl bg-green-500 py-3 text-center font-medium text-white transition-colors hover:bg-green-600"
              >
                Começar grátis
              </Link>
            </div>
            <div className="relative rounded-2xl border-2 border-green-500 bg-[#131820] p-8">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-green-500 px-3 py-1 text-xs font-bold text-white">
                POPULAR
              </div>
              <div className="mb-2 text-sm font-medium text-green-400">PRO</div>
              <div className="mb-1 text-4xl font-bold">R$ 197</div>
              <div className="mb-6 text-sm text-[#9aa6b2]">/mês</div>
              <ul className="mb-8 space-y-3">
                {['3 números WhatsApp', 'Bot com IA avançado', 'Mensagens ilimitadas', 'Etiquetas e segmentação', 'Respostas rápidas', 'Suporte prioritário'].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-[#c4cdd6]">
                    <span className="text-green-400">✓</span> {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="block w-full rounded-xl bg-green-500 py-3 text-center font-medium text-white transition-colors hover:bg-green-600"
              >
                Começar grátis
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1b222c] py-8 text-center text-sm text-[#6b7886]">
        © 2026 WaCRM. Todos os direitos reservados.
      </footer>
    </div>
  )
}
