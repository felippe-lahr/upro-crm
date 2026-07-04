import type { Metadata } from 'next'
import { LegalShell, H2, COMPANY } from '@/components/legal/legal-shell'

export const metadata: Metadata = {
  title: 'Termos de Serviço — UProCRM',
  description: 'Termos e condições de uso da plataforma UProCRM.'
}

export default function TermosPage() {
  return (
    <LegalShell title="Termos de Serviço">
      <p>
        Estes Termos de Serviço (&quot;Termos&quot;) regem o uso da plataforma <strong>{COMPANY.product}</strong>,
        operada por <strong>{COMPANY.legalName}</strong> ({COMPANY.tradeName}), CNPJ {COMPANY.cnpj}. Ao criar uma conta
        ou utilizar a plataforma, você concorda com estes Termos.
      </p>

      <H2>1. Descrição do serviço</H2>
      <p>
        O {COMPANY.product} é uma plataforma de CRM para WhatsApp Business que oferece caixa de entrada compartilhada,
        funil de vendas, agendamento, respostas automáticas (inclusive por inteligência artificial) e recursos
        relacionados. O serviço depende de integrações de terceiros, como a Plataforma do WhatsApp Business (Meta).
      </p>

      <H2>2. Cadastro e conta</H2>
      <p>
        Você deve fornecer informações verdadeiras e manter suas credenciais em sigilo. Você é responsável por toda
        atividade realizada em sua conta. É necessário ter capacidade legal para contratar.
      </p>

      <H2>3. Planos, pagamento e assinatura</H2>
      <ul className="list-disc space-y-1 pl-6">
        <li>Os planos e valores vigentes são apresentados na plataforma no momento da contratação.</li>
        <li>As assinaturas mensais são cobradas de forma recorrente até o cancelamento.</li>
        <li>Os pagamentos são processados por parceiro (Mercado Pago). Impostos aplicáveis podem incidir.</li>
        <li>O cancelamento pode ser feito pelo painel; o acesso permanece até o fim do período já pago, salvo disposição em contrário.</li>
      </ul>

      <H2>4. Uso aceitável</H2>
      <p>Ao usar a plataforma, você concorda em não:</p>
      <ul className="list-disc space-y-1 pl-6">
        <li>Enviar spam ou mensagens sem o devido consentimento (opt-in) dos destinatários.</li>
        <li>Violar as políticas da Meta e do WhatsApp Business, incluindo regras de mensagens e de conteúdo.</li>
        <li>Enviar conteúdo ilícito, enganoso, ofensivo ou que infrinja direitos de terceiros.</li>
        <li>Comprometer a segurança, integridade ou disponibilidade da plataforma.</li>
      </ul>
      <p>
        O descumprimento pode levar à suspensão ou encerramento da conta, sem prejuízo de outras medidas.
      </p>

      <H2>5. Responsabilidades do cliente</H2>
      <p>
        Você é o responsável pelo conteúdo das mensagens enviadas, pela obtenção do consentimento dos seus contatos e
        pela conformidade com a legislação aplicável (incluindo LGPD) e com as regras das plataformas de mensagens. No
        tratamento de dados dos seus contatos, você atua como controlador e o {COMPANY.product} como operador.
      </p>

      <H2>6. Cobranças a terceiros (agendamentos)</H2>
      <p>
        Quando você habilita cobrança de sinal/pagamento em agendamentos, os valores são processados pela sua própria
        conta de pagamentos e destinam-se a você. O {COMPANY.product} apenas viabiliza a geração da cobrança e não é
        parte na relação comercial entre você e seu cliente final.
      </p>

      <H2>7. Propriedade intelectual</H2>
      <p>
        A plataforma, marca e conteúdos do {COMPANY.product} pertencem a {COMPANY.legalName}. Estes Termos não
        transferem qualquer direito de propriedade intelectual, exceto a licença de uso limitada para utilizar o
        serviço.
      </p>

      <H2>8. Disponibilidade</H2>
      <p>
        Empenhamo-nos para manter o serviço disponível, mas ele é fornecido &quot;como está&quot;, podendo haver
        interrupções para manutenção, falhas de terceiros ou eventos fora de nosso controle. Não garantimos operação
        ininterrupta.
      </p>

      <H2>9. Limitação de responsabilidade</H2>
      <p>
        Na máxima extensão permitida em lei, não nos responsabilizamos por danos indiretos, lucros cessantes ou perdas
        decorrentes de indisponibilidade, de decisões de plataformas de terceiros (como bloqueios pela Meta) ou do uso
        indevido da plataforma.
      </p>

      <H2>10. Rescisão</H2>
      <p>
        Você pode encerrar sua conta a qualquer momento. Podemos suspender ou encerrar o acesso em caso de violação
        destes Termos ou das políticas aplicáveis.
      </p>

      <H2>11. Alterações dos Termos</H2>
      <p>
        Podemos atualizar estes Termos periodicamente. Alterações relevantes serão comunicadas, e o uso continuado após
        a vigência implica concordância.
      </p>

      <H2>12. Lei aplicável e foro</H2>
      <p>
        Estes Termos são regidos pelas leis do Brasil. Fica eleito o foro do domicílio da contratante para dirimir
        controvérsias, salvo disposição legal em contrário.
      </p>

      <H2>13. Contato</H2>
      <p>
        {COMPANY.legalName} — CNPJ {COMPANY.cnpj}. Contato: <a className="text-brand hover:underline" href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.
      </p>
    </LegalShell>
  )
}
