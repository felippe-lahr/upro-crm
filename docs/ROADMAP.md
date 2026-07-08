# UProCRM — Roadmap

Estado e próximos passos do produto. Atualizar conforme as coisas andam.
Última atualização: 2026-07-07.

## ✅ Concluído (recente)
- Número próprio conectado e validado (mensagem chegando no CRM ponta a ponta)
- Wizard de conexão de número próprio em `/settings` (sem `curl`)
- Upload de logo do cliente → foto de perfil do WhatsApp Business
- Inbox com atualização em tempo real (polling 2s) + webhook de recebimento reforçado
- App da Meta migrado para **Provedor de Tecnologia (Independent Tech Provider)**
- **App Review enviado** (whatsapp_business_messaging, whatsapp_business_management, public_profile) — status "Análise em andamento"
- Conta de revisão sem acesso ao `/admin` (`analyst@uprocrm.com.br`, role admin no tenant master)

## ⏳ Em andamento
- **App Review da Meta** — aguardando resposta (prazo até ~20 dias). Não apagar `analyst@`, não desconectar o WhatsApp da conta master, não rotacionar `NEXTAUTH_SECRET` até aprovar.

## 🔜 Próximos passos (ordenados)

### 1. Multicanal — Instagram + Messenger
Colocar o mesmo bot para atender no Instagram Direct e no Messenger.
- Reaproveita ~70%: `lib/bot.ts` e `lib/ai.ts` já são agnósticos de canal.
- Novo: webhook `/api/webhooks/messenger` (payload da Messenger Platform, diferente do WhatsApp), `sendMessengerMessage` (Send API com Page Access Token), conexão de Página FB + conta IG, campo `channel` em Contact/Message.
- Meta: novas permissões (`instagram_manage_messages`, `pages_messaging`, `pages_manage_metadata`) + outra rodada de App Review.
- Esforço: código ~2-4 dias + review Meta. **Fazer só depois da aprovação do WhatsApp** (não abrir duas frentes de review juntas). Fazer IG + Messenger juntos (compartilham a Send API).

### ✅ Billing anual em 12x sem juros (implementado — validar com pagamento real)
- Mensal: assinatura recorrente (PreApproval) — inalterado.
- Anual: pagamento único parcelado em até 12x no cartão (API Payment) + ativação via webhook.
- **Pendente de config na conta MP:** ativar "parcelamento sem juros" (12x) no painel do Mercado Pago para o cliente não pagar juros; senão o MP aplica juros. Testar um pagamento anual real de ponta a ponta.

### 2. Bot agente de vendas para e-commerce (integração de carrinho)
Bot de IA como vendedor para lojas que usam o botão "Comprar no WhatsApp" (a mensagem já chega com nome do produto + link).
- **Fase A — Bot vendedor por contexto:** detectar o link do produto na mensagem, obter nome/preço/estoque (via API da plataforma ou extração da página), injetar no contexto do bot + prompt de vendas; taggear o produto de interesse no CRM/funil.
- **Fase B — Carrinho pré-preenchido:** montar a URL "adicionar ao carrinho" da plataforma (padrão varia: Loja Integrada `/carrinho/adicionar/{id}`, Nuvemshop `/comprar/{id}`, Tray `?add_to_cart=`, WooCommerce `?add-to-cart=`, VTEX `/checkout/cart/add?sku=`, Shopify `/cart/{variant}:1`). Bot manda o link e o cliente finaliza a compra na própria loja (sem integrar pagamento).
- **Plataforma do 1º cliente (bonitasnaweb.com.br): Tray.** Tem **Tray Commerce API** (OAuth token) → obter produto/preço/estoque/variações de forma confiável (a página bloqueia fetch server-side com 403, então usar a API). Tray também tem link nativo de adicionar ao carrinho (confirmar formato exato na doc na implementação).
- Pendências para começar: credenciais da Tray API do cliente (consumer_key/secret + code) e confirmar o padrão da URL de carrinho da Tray.

### Responsividade mobile (em andamento)
O app era desktop-first; passada para funcionar bem no celular (o atendente usa via PWA).
- ✅ Shell responsivo: sidebar vira drawer com hambúrguer (animado); conteúdo full-width; item ativo destacado.
- ✅ Conversas: sem overflow horizontal; cabeçalho compacto (status vira bolinhas no mobile); barra global oculta na conversa aberta (sem gap); campo de mensagem 16px (sem zoom iOS) + botão Enviar full-width abaixo.
- ✅ Funil: botão "mover" em cada card (tap-to-move) além do drag no desktop.
- ✅ Agenda: barra de ações quebra linha; cards com ações em linha própria.
- ✅ Dashboard: cards 2 colunas no mobile; alerta empilha.
- ✅ Contatos: tabela com rolagem horizontal; padding reduzido no mobile.
- ✅ Padding responsivo (p-4 sm:p-8) em todas as telas do painel.
- 🔜 Opcional futuro: áreas de toque maiores, safe-area no notch.

### 3. PWA da inbox (app no celular sem App Store)
Transformar a inbox web num app instalável ("Adicionar à Tela de Início"), resolvendo a objeção "quero um app tipo WhatsApp" sem custo/revisão de loja.
- **Fase A (feita ✅):** manifest (`app/manifest.ts`) + meta tags de app (appleWebApp) + service worker (`public/sw.js`) → inbox instalável no celular (iOS/Android), abre em tela cheia. start_url `/conversations`. Ícone atual = logo.svg (no iOS, adicionar um PNG 180/192/512 depois deixa o ícone perfeito).
- **Fase B (próxima):** **notificações push** de mensagem nova (Web Push API + VAPID; iOS 16.4+ para PWA instalada). Requer armazenar subscription por usuário e disparar push no webhook de mensagem inbound.
- App nativo iOS (App Store) fica como fase 2 futura, só se houver motivo comercial (marca na loja/escala). Muito mais esforço (conta Apple, revisão, APNs, manutenção).

### 4. Roteamento inteligente + resumo de atendimento
Bot coleta infos definidas no prompt, classifica e encaminha o resumo da conversa para o destino certo (por setor/produto/etc.).
- Config por tenant: lista de destinos (rótulo → número WhatsApp / e-mail / API Digisac).
- Nova tool do bot `encaminhar_atendimento(destino, resumo)`; reaproveita o `ai_summary` já existente.
- Gatilho: no handoff para humano (marcador `[ESCALAR]`) ou conversa concluída.
- Entrega: WhatsApp (exige template fora da janela 24h), **e-mail** ou **API da Digisac** (sem template, mais limpo).
- Caso concreto: cliente que usa Digisac — bot pré-atende e joga o resumo na Digisac.

### 5. Disparo em massa (templates)
Envio de mensagens em massa via templates aprovados (respeitando janela de 24h e categorias). Depende de templates aprovados na WABA.

### 6. Refresh automático do token de 60 dias do WhatsApp
Rotina para renovar o token antes de expirar, evitando desconexão silenciosa.

## 🔒 Pós-aprovação (checklist de segurança)
- Apagar o usuário `analyst@uprocrm.com.br`
- Rotacionar `NEXTAUTH_SECRET`, `ENCRYPTION_KEY` e `META_APP_SECRET` no Railway (apareceram em URLs/prints)
- Trocar senhas de contas de teste

## 💡 Backlog / ideias
- Preview da foto de perfil atual do WhatsApp dentro de `/settings`
- Two-track: SaaS self-service (Tech Provider) + projetos customizados número próprio (já suportado, manter)
