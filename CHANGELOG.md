# Histórico de versões — UProCRM

Todas as mudanças relevantes do UProCRM, da mais recente para a mais antiga.
Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e
versionamento semântico — regras em `docs/VERSIONAMENTO.md`.

Seções de cada versão: **Adicionado** (novidade), **Alterado** (mudança em algo
existente), **Corrigido** (bug), **Removido**, **Segurança**.

## [Não lançado]

### Adicionado
- **Guardar imagens e documentos** recebidos no WhatsApp (recurso liberado por tenant pelo superadmin em "Recursos liberados"). Arquivos no Cloudflare R2, exibidos na conversa por link temporário protegido; apagados ao excluir o contato.

## [1.0.0] — 2026-10-07

Primeira versão oficial. Consolida tudo o que estava em produção até esta data.

### Adicionado
- **CRM multi-empresa** com WhatsApp Business oficial (API da Meta), conexão pelo popup da Meta ou por número próprio.
- **Conversas** em tempo real, com não lidas, filtros por período (Hoje, Ontem, 7/30 dias, período) e etiquetas, numeração da fila (1º, 2º…) e ordem configurável (recentes primeiro / fila de chegada).
- **Funil de vendas** (Kanban) com etapas e motivos de perda personalizáveis (Pro/Promaster), detalhe do lead, filtros e **responsável por lead** (puxar pra mim / soltar / reatribuir).
- **Equipe**: vários acessos por empresa, papéis Admin e Atendente.
- **Contatos**: importação CSV com modelo, etiquetagem em lote, filtros por período e etiqueta, **exportação CSV** (nome, telefone, e-mail, resumo).
- **Bot com IA** (Claude): atendimento 24/7, resumo do lead, etiquetagem automática, transcrição de **áudio** (Groq Whisper), agendamento com sinal via Pix, catálogo de produtos por feed XML (Promaster) e **resumo de pedido com PDF**.
- **Disparos de consentimento** (SIM/SAIR) em lotes de 30, com modelo aprovado pela Meta e aviso de boas práticas.
- **Rastreamento de anúncios**: Click-to-WhatsApp (Instagram/Facebook) e Google Ads → site → WhatsApp.
- **Dashboard** com conversas do dia, pipeline e vendas fechadas.
- **Painel superadmin** com tenants, planos, cupons, afiliados e **Diagnósticos** (tokens, WhatsApp, IA, bot, áudio, anúncios, migração).
- **Recuperação de senha**, mostrar/ocultar senha e bloqueio contra força bruta no login.
- App instalável (**PWA**) com notificações.

### Corrigido
- Bot respondendo "instabilidade momentânea": tokens do WhatsApp que venciam (~60 dias) foram trocados pelo **token permanente da plataforma**, com migração automática e aviso no painel antes de vencer.
- Lista de conversas mostrava só parte das conversas (limite de 400 mensagens).
- Etiqueta "consentiu" aplicada a qualquer "sim" dito ao bot.
- Webhook do WhatsApp passou a responder na hora à Meta (evita reenvios e duplicatas).

### Segurança
- Chave de administração separada do segredo de sessão; endpoints de diagnóstico só para superadmin.
- Validação de assinatura dos webhooks (Meta e Mercado Pago).
- Isolamento de dados por empresa (schema por tenant, sempre derivado da sessão).
