import Link from 'next/link'
import {
  MessageSquare, Bot, KanbanSquare, Megaphone, Tags, BarChart3, ShieldCheck,
  ArrowRight, Check, Plug2, Users, Workflow
} from 'lucide-react'
import { CrmPreview } from '@/components/landing/crm-preview'
import { RefCapture } from '@/components/landing/ref-capture'
import { globalPrisma } from '@/lib/prisma-tenant'

// Renderiza por request para refletir o preço atual do admin (não prerender no build).
export const dynamic = 'force-dynamic'

const FEATURES = [
  { icon: MessageSquare, title: 'Inbox compartilhada', desc: 'Todas as conversas do WhatsApp num só lugar. Status, histórico completo e respostas em equipe sem pisar no pé um do outro.' },
  { icon: Bot, title: 'Bot com IA', desc: 'O Claude responde seus clientes 24/7 com o tom da sua marca, captura nome e e-mail e encaminha pra um humano quando precisa.' },
  { icon: KanbanSquare, title: 'Funil de vendas', desc: 'Arraste leads entre os estágios. Veja o valor do pipeline por coluna e o que está travando a venda.' },
  { icon: Megaphone, title: 'Disparos em massa', desc: 'Envie mensagens segmentadas por etiqueta e acompanhe entregas e respostas em tempo real.' },
  { icon: Tags, title: 'Etiquetas e contatos', desc: 'Organize com tags, anotações e campos. Cada lead vira um cadastro completo, automaticamente.' },
  { icon: BarChart3, title: 'Métricas em tempo real', desc: 'Conversas abertas, novos contatos, tempo de resposta e pipeline — sem você montar um único gráfico.' }
]

const STEPS = [
  { n: '01', icon: Plug2, title: 'Conecte seu WhatsApp', desc: 'Conexão oficial pela Meta Cloud API, sem risco de ban. Leva 2 minutos.' },
  { n: '02', icon: Users, title: 'Receba seus contatos', desc: 'As mensagens que chegam viram contatos no CRM automaticamente, com etiquetas e funil prontos.' },
  { n: '03', icon: Workflow, title: 'Atenda e venda', desc: 'O bot responde, qualifica e organiza os leads. Sua equipe foca em fechar.' }
]

const FAQ = [
  { q: 'Preciso de WhatsApp Business API?', a: 'A conexão é feita pela API oficial da Meta (Cloud API). A gente te guia no processo — leva poucos minutos e não há risco de banimento.' },
  { q: 'O bot de IA responde sozinho?', a: 'Sim. Você configura a personalidade e a base de conhecimento uma vez, e o Claude responde 24/7. Ele também pausa quando um atendente assume a conversa.' },
  { q: 'Posso cancelar quando quiser?', a: 'Sim, sem fidelidade. O cancelamento é feito pelo próprio painel e não há novas cobranças.' },
  { q: 'Meus dados ficam seguros?', a: 'Cada cliente tem um banco de dados isolado (schema próprio). Privacidade por arquitetura, não por configuração.' },
  { q: 'Quais formas de pagamento?', a: 'Pix, boleto ou cartão de crédito via Mercado Pago, com checkout transparente direto na plataforma.' }
]

export default async function LandingPage() {
  // Preços vêm do painel admin (SaasConfig), não fixos no código.
  const cfg = await globalPrisma.saasConfig
    .upsert({ where: { id: 'singleton' }, create: { id: 'singleton' }, update: {} })
    .catch(() => null)
  const priceBasic = Number(cfg?.price_basic ?? 97)
  const pricePro = Number(cfg?.price_pro ?? 197)

  return (
    <div className="min-h-screen bg-background text-fg">
      <RefCapture />
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-line bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <Link href="/" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="UProCRM" className="h-9 w-9 rounded-xl" />
            <span className="text-lg font-bold tracking-tight">UProCRM</span>
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            <a href="#recursos" className="text-sm font-medium text-muted transition-colors hover:text-fg">Recursos</a>
            <a href="#como-funciona" className="text-sm font-medium text-muted transition-colors hover:text-fg">Como funciona</a>
            <a href="#planos" className="text-sm font-medium text-muted transition-colors hover:text-fg">Planos</a>
            <a href="#faq" className="text-sm font-medium text-muted transition-colors hover:text-fg">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-muted transition-colors hover:text-fg">Entrar</Link>
            <Link href="/signup" className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-brand/25 transition-colors hover:bg-brand-600">
              Começar grátis <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-32 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-brand/10 blur-3xl" />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-sm font-medium text-brand">
              <ShieldCheck className="h-4 w-4" />
              Conexão oficial WhatsApp Business API
            </div>
            <h1 className="text-balance text-4xl font-bold leading-[1.2] tracking-tight md:text-6xl md:leading-[1.2]">
              Atenda no WhatsApp e venda mais com{' '}
              <span className="bg-gradient-to-r from-brand to-brand-700 bg-clip-text text-transparent">inteligência artificial</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg text-muted">
              Inbox compartilhada, funil de vendas, disparos em massa e um bot de IA que
              atende seus clientes 24/7. Tudo num só CRM, com setup em 2 minutos.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/signup" className="inline-flex items-center gap-2 rounded-xl bg-brand px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand/25 transition-colors hover:bg-brand-600">
                Criar conta grátis <ArrowRight className="h-5 w-5" />
              </Link>
              <a href="#planos" className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-7 py-3.5 text-base font-semibold text-fg transition-colors hover:border-brand/40">
                Ver planos
              </a>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted">
              <span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-brand" /> Sem risco de ban</span>
              <span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-brand" /> Setup em 2 min</span>
              <span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-brand" /> Cancele quando quiser</span>
            </div>
          </div>

          {/* Mockup */}
          <div className="relative">
            {/* halo suave atrás */}
            <div className="pointer-events-none absolute -inset-8 rounded-[2.5rem] bg-brand/15 blur-3xl" />
            {/* moldura fina com feixe de luz girando */}
            <div className="relative overflow-hidden rounded-[1.15rem] p-[2px] shadow-2xl shadow-brand/20">
              {/* feixe luminoso que gira ao redor da borda */}
              <div className="animate-beam-sweep pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[200%] bg-[conic-gradient(from_0deg,transparent_0deg,transparent_255deg,#3b82f6_310deg,#bfdbfe_335deg,#3b82f6_360deg)]" />
              {/* borda sutil estática por cima do feixe */}
              <div className="pointer-events-none absolute inset-0 rounded-[1.15rem] ring-1 ring-inset ring-white/10" />
              <div className="relative">
                <CrmPreview />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="recursos" className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-brand">Recursos</div>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Um CRM completo para quem vende pelo WhatsApp</h2>
            <p className="mt-4 text-muted">Pare de juntar inbox, planilha e ferramenta de disparo. Está tudo aqui — e conversa com o WhatsApp de forma nativa.</p>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="group rounded-2xl border border-line bg-surface p-6 transition-all hover:border-brand/30 hover:shadow-lg hover:shadow-brand/5">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand transition-colors group-hover:bg-brand group-hover:text-white">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 font-semibold">{f.title}</h3>
                <p className="text-sm text-muted">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="como-funciona" className="border-t border-line py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-brand">Como funciona</div>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Do zero ao atendimento em minutos</h2>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="relative overflow-hidden rounded-2xl border border-line bg-surface p-7">
                <span className="absolute -right-2 -top-4 text-7xl font-extrabold text-brand/10">{s.n}</span>
                <div className="relative mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-white">
                  <s.icon className="h-5 w-5" />
                </div>
                <h3 className="relative mb-2 font-semibold">{s.title}</h3>
                <p className="relative text-sm text-muted">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="planos" className="border-t border-line py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-brand">Planos</div>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Preço simples, sem surpresa</h2>
            <p className="mt-4 text-muted">Sem taxa de setup. Pix, boleto ou cartão via Mercado Pago. Cancele quando quiser.</p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Básico */}
            <div className="rounded-2xl border border-line bg-surface p-8">
              <div className="text-sm font-semibold text-muted">Básico</div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold">R$ {priceBasic}</span>
                <span className="text-sm text-muted">/mês</span>
              </div>
              <p className="mt-2 text-sm text-muted">Para começar a organizar seu atendimento.</p>
              <ul className="mt-6 space-y-3">
                {['1 número WhatsApp', 'Inbox + funil de vendas', 'Menu de atendimento', 'Etiquetas e disparos', 'Suporte por e-mail'].map((i) => (
                  <li key={i} className="flex items-center gap-2.5 text-sm text-fg">
                    <Check className="h-4 w-4 flex-shrink-0 text-brand" /> {i}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="mt-8 block rounded-xl border border-line py-3 text-center font-semibold text-fg transition-colors hover:border-brand/40">
                Começar grátis
              </Link>
            </div>
            {/* Pro */}
            <div className="relative rounded-2xl border-2 border-brand bg-surface p-8 shadow-xl shadow-brand/10">
              <div className="absolute -top-3 left-8 rounded-full bg-brand px-3 py-1 text-xs font-bold text-white">MAIS POPULAR</div>
              <div className="text-sm font-semibold text-brand">Pro</div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold">R$ {pricePro}</span>
                <span className="text-sm text-muted">/mês</span>
              </div>
              <p className="mt-2 text-sm text-muted">Atendimento automático com IA de verdade.</p>
              <ul className="mt-6 space-y-3">
                {['Tudo do Básico', 'Bot com IA (Claude) 24/7', 'Qualificação e captura de leads', 'Encaminhamento para humano', 'Transcrição de áudios', 'Suporte prioritário'].map((i) => (
                  <li key={i} className="flex items-center gap-2.5 text-sm text-fg">
                    <Check className="h-4 w-4 flex-shrink-0 text-brand" /> {i}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="mt-8 block rounded-xl bg-brand py-3 text-center font-semibold text-white shadow-lg shadow-brand/25 transition-colors hover:bg-brand-600">
                Assinar o Pro
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-line py-20">
        <div className="mx-auto max-w-3xl px-6">
          <div className="mb-12 text-center">
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-brand">FAQ</div>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Perguntas frequentes</h2>
          </div>
          <div className="space-y-3">
            {FAQ.map((item) => (
              <details key={item.q} className="group rounded-xl border border-line bg-surface p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
                  {item.q}
                  <span className="ml-4 text-brand transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm text-muted">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 to-brand px-8 py-16 text-center shadow-2xl shadow-brand/30">
          <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">Pronto para automatizar seu atendimento?</h2>
          <p className="mx-auto mt-4 max-w-xl text-white/80">Crie sua conta, conecte o WhatsApp e deixe o bot trabalhar por você.</p>
          <Link href="/signup" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-base font-semibold text-brand-700 transition-transform hover:scale-[1.02]">
            Criar conta grátis <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="UProCRM" className="h-8 w-8 rounded-lg" />
            <span className="font-bold">UProCRM</span>
          </div>
          <div className="flex flex-wrap items-center gap-5 text-sm">
            <Link href="/afiliados" className="text-muted transition-colors hover:text-brand">Seja afiliado</Link>
            <Link href="/privacidade" className="text-muted transition-colors hover:text-brand">Privacidade</Link>
            <Link href="/termos" className="text-muted transition-colors hover:text-brand">Termos</Link>
            <Link href="/exclusao-de-dados" className="text-muted transition-colors hover:text-brand">Exclusão de dados</Link>
          </div>
          <p className="text-center text-xs leading-relaxed text-faint sm:text-right">
            © 2026 UProCRM · Studio44 Vendas e Marketing No Digital LTDA<br />
            CNPJ 23.192.161/0001-20
          </p>
        </div>
      </footer>
    </div>
  )
}
