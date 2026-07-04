import type { Metadata } from 'next'
import { LegalShell, H2, COMPANY } from '@/components/legal/legal-shell'

export const metadata: Metadata = {
  title: 'Política de Privacidade — UProCRM',
  description: 'Como o UProCRM coleta, usa e protege dados pessoais, em conformidade com a LGPD.'
}

export default function PrivacidadePage() {
  return (
    <LegalShell title="Política de Privacidade">
      <p>
        Esta Política de Privacidade descreve como o <strong>{COMPANY.product}</strong>, plataforma de CRM para
        WhatsApp Business operada por <strong>{COMPANY.legalName}</strong> ({COMPANY.tradeName}), inscrita no CNPJ
        sob o nº {COMPANY.cnpj} (&quot;nós&quot;), coleta, utiliza, armazena e protege dados pessoais, em conformidade
        com a Lei nº 13.709/2018 (Lei Geral de Proteção de Dados — LGPD).
      </p>

      <H2>1. Quem é o controlador</H2>
      <p>
        O controlador dos dados tratados na plataforma é {COMPANY.legalName}. Para assuntos de privacidade, entre em
        contato pelo e-mail <a className="text-brand hover:underline" href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.
      </p>

      <H2>2. Dados que coletamos</H2>
      <p>Tratamos duas categorias de dados:</p>
      <ul className="list-disc space-y-1 pl-6">
        <li><strong>Dados dos clientes assinantes:</strong> nome, e-mail, telefone, dados de cadastro da empresa, dados de pagamento (processados por parceiro) e informações de uso da plataforma.</li>
        <li><strong>Dados dos contatos finais:</strong> quando um cliente conecta seu número de WhatsApp Business, tratamos, em nome dele, os dados das conversas — nome de perfil, número/identificador do WhatsApp, mensagens trocadas (texto, áudio, mídia), etiquetas e informações de atendimento e agendamento.</li>
      </ul>

      <H2>3. Como usamos os dados</H2>
      <ul className="list-disc space-y-1 pl-6">
        <li>Prestar e operar o serviço de CRM e atendimento por WhatsApp.</li>
        <li>Processar assinaturas, pagamentos e emitir comunicações transacionais.</li>
        <li>Oferecer funcionalidades como funil de vendas, agendamento, lembretes e respostas automáticas por inteligência artificial.</li>
        <li>Garantir segurança, prevenir fraudes e cumprir obrigações legais.</li>
      </ul>

      <H2>4. Bases legais</H2>
      <p>
        Tratamos dados com fundamento na execução de contrato, no cumprimento de obrigação legal, no legítimo interesse
        e no consentimento, conforme aplicável. Para os dados dos contatos finais, o cliente assinante atua como
        controlador e o {COMPANY.product} como operador, tratando os dados conforme suas instruções.
      </p>

      <H2>5. Compartilhamento com terceiros</H2>
      <p>Compartilhamos dados apenas com prestadores necessários à operação, incluindo:</p>
      <ul className="list-disc space-y-1 pl-6">
        <li><strong>Meta Platforms / WhatsApp Business Platform</strong> — envio e recebimento de mensagens.</li>
        <li><strong>Mercado Pago</strong> — processamento de pagamentos e assinaturas.</li>
        <li><strong>Provedores de inteligência artificial</strong> (ex.: Anthropic, Groq) — geração de respostas e transcrição, quando o recurso está ativo.</li>
        <li><strong>Resend</strong> — envio de e-mails transacionais.</li>
        <li><strong>Provedor de hospedagem em nuvem</strong> — infraestrutura e banco de dados.</li>
      </ul>
      <p>Não vendemos dados pessoais.</p>

      <H2>6. Integração com o WhatsApp e a Meta</H2>
      <p>
        O uso do WhatsApp por meio da plataforma está sujeito às políticas da Meta e do WhatsApp Business. O cliente é
        responsável por obter o consentimento (opt-in) dos seus contatos e por respeitar as regras de mensagens da
        plataforma.
      </p>

      <H2>7. Armazenamento e segurança</H2>
      <p>
        Adotamos medidas técnicas e organizacionais para proteger os dados, incluindo <strong>isolamento por cliente</strong>
        (cada cliente possui um banco de dados lógico próprio), <strong>criptografia</strong> de credenciais sensíveis e
        controles de acesso. Nenhum método é 100% infalível, mas trabalhamos para mitigar riscos.
      </p>

      <H2>8. Retenção</H2>
      <p>
        Mantemos os dados pelo tempo necessário à prestação do serviço e ao cumprimento de obrigações legais. Após o
        encerramento da conta, os dados podem ser eliminados ou anonimizados, ressalvadas as hipóteses de guarda legal.
      </p>

      <H2>9. Direitos do titular</H2>
      <p>
        Nos termos da LGPD, você pode solicitar confirmação de tratamento, acesso, correção, anonimização, portabilidade,
        eliminação e informações sobre compartilhamento. Para exercer seus direitos, contate {COMPANY.email}. Titulares
        que sejam contatos finais de um cliente devem, preferencialmente, contatar a empresa com quem se relacionam.
      </p>

      <H2>10. Cookies</H2>
      <p>
        Utilizamos cookies e tecnologias semelhantes estritamente necessários para autenticação e funcionamento da
        plataforma.
      </p>

      <H2>11. Transferência internacional</H2>
      <p>
        Alguns prestadores podem processar dados fora do Brasil. Nesses casos, adotamos salvaguardas adequadas conforme a
        LGPD.
      </p>

      <H2>12. Alterações</H2>
      <p>
        Podemos atualizar esta Política periodicamente. A data da última atualização é indicada no topo desta página.
      </p>

      <H2>13. Contato</H2>
      <p>
        Dúvidas sobre privacidade: <a className="text-brand hover:underline" href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> — {COMPANY.legalName}, CNPJ {COMPANY.cnpj}.
      </p>
    </LegalShell>
  )
}
