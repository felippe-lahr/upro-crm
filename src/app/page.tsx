import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">W</span>
          </div>
          <span className="font-bold text-gray-900 text-lg">WaCRM</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-gray-600 hover:text-gray-900 text-sm">
            Entrar
          </Link>
          <Link
            href="/signup"
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Começar grátis
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1 rounded-full text-sm font-medium mb-6">
          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
          7 dias grátis, sem cartão
        </div>
        <h1 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
          CRM completo para<br />
          <span className="text-green-500">WhatsApp Business</span>
        </h1>
        <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto">
          Gerencie todos seus clientes do WhatsApp em um único lugar.
          Bot com IA incluso, setup em 2 minutos.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/signup"
            className="bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-xl text-lg font-semibold transition-colors shadow-lg shadow-green-200"
          >
            Criar conta grátis
          </Link>
          <Link
            href="#planos"
            className="text-gray-600 hover:text-gray-900 px-8 py-4 rounded-xl text-lg font-medium border border-gray-200 hover:border-gray-300 transition-colors"
          >
            Ver planos
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Tudo que você precisa
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: '💬',
                title: 'Conversas organizadas',
                desc: 'Todas as mensagens em uma inbox centralizada. Atribua agentes, filtre por status.'
              },
              {
                icon: '🤖',
                title: 'Bot com IA',
                desc: 'Claude Sonnet responde automaticamente seus clientes 24/7 com o tom da sua marca.'
              },
              {
                icon: '🔌',
                title: 'Conexão oficial Meta',
                desc: 'WhatsApp Cloud API oficial. Sem risco de ban, sem gambiarras.'
              },
              {
                icon: '👥',
                title: 'Multi-agente',
                desc: 'Adicione sua equipe. Cada agente tem seu login e visão personalizada.'
              },
              {
                icon: '📊',
                title: 'Relatórios',
                desc: 'Métricas de atendimento, tempo de resposta, volume por período.'
              },
              {
                icon: '🔒',
                title: 'Dados isolados',
                desc: 'Seu banco de dados é completamente separado de outros clientes.'
              }
            ].map((f) => (
              <div key={f.title} className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="planos" className="py-20">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">Planos simples</h2>
          <p className="text-center text-gray-500 mb-12">Sem taxa de setup. Cancele quando quiser.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="border border-gray-200 rounded-2xl p-8">
              <div className="text-sm font-medium text-gray-500 mb-2">BÁSICO</div>
              <div className="text-4xl font-bold text-gray-900 mb-1">R$ 97</div>
              <div className="text-gray-500 text-sm mb-6">/mês</div>
              <ul className="space-y-3 mb-8">
                {['1 número WhatsApp', 'Até 3 agentes', 'Bot com IA', '5.000 mensagens/mês', 'Suporte por email'].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="text-green-500">✓</span> {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="block w-full text-center bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-medium transition-colors"
              >
                Começar grátis
              </Link>
            </div>
            <div className="border-2 border-green-500 rounded-2xl p-8 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                POPULAR
              </div>
              <div className="text-sm font-medium text-green-600 mb-2">PRO</div>
              <div className="text-4xl font-bold text-gray-900 mb-1">R$ 197</div>
              <div className="text-gray-500 text-sm mb-6">/mês</div>
              <ul className="space-y-3 mb-8">
                {['3 números WhatsApp', 'Agentes ilimitados', 'Bot com IA avançado', 'Mensagens ilimitadas', 'Suporte prioritário', 'API de integração'].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="text-green-500">✓</span> {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="block w-full text-center bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-medium transition-colors"
              >
                Começar grátis
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 text-center text-gray-400 text-sm">
        © 2025 WaCRM. Todos os direitos reservados.
      </footer>
    </div>
  )
}
