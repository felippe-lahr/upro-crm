import type { Metadata } from 'next'
import { LegalShell, H2, COMPANY } from '@/components/legal/legal-shell'

export const metadata: Metadata = {
  title: 'Exclusão de dados — UProCRM',
  description: 'Como solicitar a exclusão dos seus dados pessoais no UProCRM.'
}

export default function ExclusaoDeDadosPage() {
  return (
    <LegalShell title="Exclusão de dados">
      <p>
        Esta página explica como solicitar a exclusão de dados pessoais tratados pelo <strong>{COMPANY.product}</strong>,
        operado por <strong>{COMPANY.legalName}</strong> ({COMPANY.tradeName}), CNPJ {COMPANY.cnpj}, em conformidade com a
        Lei Geral de Proteção de Dados (LGPD).
      </p>

      <H2>Quem pode solicitar</H2>
      <ul className="list-disc space-y-1 pl-6">
        <li><strong>Clientes assinantes</strong> do {COMPANY.product} — titulares da conta na plataforma.</li>
        <li><strong>Contatos finais</strong> — pessoas que conversaram com uma empresa que usa o {COMPANY.product}. Nesse caso, os dados pertencem à empresa com quem você se relacionou; recomendamos contatá-la diretamente. Ainda assim, podemos encaminhar sua solicitação.</li>
      </ul>

      <H2>Como solicitar</H2>
      <p>
        Envie um e-mail para <a className="text-brand hover:underline" href={`mailto:${COMPANY.email}?subject=Exclusão de dados`}>{COMPANY.email}</a> com
        o assunto <strong>&quot;Exclusão de dados&quot;</strong>, informando:
      </p>
      <ul className="list-disc space-y-1 pl-6">
        <li>Seu nome completo;</li>
        <li>O e-mail e/ou telefone associado aos dados;</li>
        <li>Se você é cliente assinante ou contato final (e, neste caso, de qual empresa).</li>
      </ul>
      <p>
        Para sua segurança, podemos solicitar informações adicionais para confirmar sua identidade antes de processar o
        pedido.
      </p>

      <H2>O que é excluído</H2>
      <p>
        Mediante confirmação, eliminamos os dados pessoais associados à solicitação, incluindo cadastro, conversas e
        informações de atendimento, ressalvadas as hipóteses em que a manutenção é exigida por lei (por exemplo,
        obrigações fiscais e de segurança).
      </p>

      <H2>Prazo</H2>
      <p>
        Processamos as solicitações no menor tempo possível, normalmente em até <strong>30 dias</strong>, e confirmamos a
        conclusão pelo mesmo e-mail de contato.
      </p>

      <H2>Contato</H2>
      <p>
        {COMPANY.legalName} — CNPJ {COMPANY.cnpj}. Dúvidas sobre exclusão de dados ou privacidade:{' '}
        <a className="text-brand hover:underline" href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.
      </p>
    </LegalShell>
  )
}
