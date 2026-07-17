# UProCRM — Roadmap

Estado e próximos passos do produto. Atualizar conforme as coisas andam.
Última atualização: 2026-07-17.

## ✅ Concluído (recente)
- **Plano Promaster completo** (bot vendedor por feed XML/RAG) — ingestão, sync, tools do bot, planos no admin/landing/checkout/Mercado Pago. Ver seção 3 abaixo. 1º cliente ativo (bonitasnaweb.com.br, ~541 produtos sincronizados).
- **Admin — editar tenant** (plano, status, nome/e-mail, estender trial, redefinir senha) via modal no painel.
- **Admin — planos e preços** com 4 tiers (trial/básico/pro/promaster) em admin, landing e checkout + Mercado Pago (mensal/anual).
- **Admin — tema claro corrigido** (logo e textos brancos ilegíveis) + botão "Voltar ao dashboard" no painel.
- **Agenda — toggle de agendamento pelo bot** (`scheduling_enabled`): quando off, as ferramentas de agendamento nem são passadas ao modelo → o bot nunca oferece nem marca horários.
- **Contatos — excluir contato na lista** (funciona no PWA/mobile), com modal de confirmação.
- **Chat — fim da rolagem horizontal no PWA** (quebra de URLs/palavras longas nas mensagens).
- **Badge de conversas não vistas** no topo (PWA): conta conversas (não mensagens) com mensagem recebida após a última abertura; marca como vista ao abrir. Não interfere nos push.
- **Modelo default de IA corrigido** para `claude-sonnet-5` (`lib/ai.ts` e `lib/bot.ts`).
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

### ✅ 3. Plano **Promaster** — bot vendedor por feed XML de produtos (RAG) — IMPLEMENTADO
> **Implementado e em produção** (Fase 1 + Fase 2). 1º cliente ativo: bonitasnaweb.com.br (~541 produtos). Sync piggyback no cron de lembretes (re-sincroniza catálogos com feed a cada ~55min). Fechamento = só link da página (sem pagamento). Fase 3 (pgvector/busca semântica) segue como futuro opcional. Detalhes de referência abaixo.

Nova categoria de plano (acima do Pro). O tenant cadastra a **URL de um feed XML de produtos** e o bot vira um vendedor de e-commerce: responde sobre catálogo, preço, marca e disponibilidade, e **manda o link da página do produto** para o cliente concluir a compra na própria loja (sem integração de pagamento).

- **Formato do feed:** Google Merchant / RSS 2.0 (`<rss xmlns:g>` → `<channel>` → `<item>`). Exportado por Tray, Nuvemshop, VTEX, WooCommerce, Shopify, Bling — cobre a maioria. 1º caso validado: `bonitasnaweb.com.br` (~1.000+ SKUs, cosméticos).
  - Obs.: o servidor do feed pode bloquear fetch em ambientes restritos (403), mas em produção (Railway) baixa normal.
- **Mapeamento dos campos** (item → tabela `product` no schema do tenant):
  - `g:id`→feed_id (chave do upsert) · `title` · `description` (full-text) · `g:price` (`"R$ 189,90"` → **tirar "R$ " e trocar vírgula por ponto**) · `g:sale_price` (opcional) · `g:availability` (`in stock`/`out of stock`) · `g:brand` · `g:product_type`→category · `g:image_link` (+`additional_image_link`) · **`link`→url (é o que o bot envia)** · `g:gtin`/`g:mpn` · `g:installment` (months+amount).
  - Variações (cor/tom/tamanho) vêm como **SKUs separados** — sem aninhamento, cada `<item>` é um produto.
- **Fase 1 — Ingestão + Sync:** campo `products_feed_url` no tenant; parser do RSS (namespace `g:`); tabela `product` com `tsvector` (título+marca+categoria+descrição) e índices em `brand`, `price`, `in_stock`; **cron horário** re-baixa o XML e faz upsert (marca ausentes como fora de estoque — reaproveita a infra de cron de agendamentos).
- **Fase 2 — Bot (tool use, como `SCHEDULING_TOOLS`):** `buscar_produtos(query, marca?, preco_max?, so_em_estoque?)` → top N; `detalhes_produto(id)` → ficha + imagem + parcelamento + **link**. Só os produtos recuperados entram no prompt (RAG) → custo de token baixo.
- **Fechamento:** apenas **link da página do produto** (decisão do cliente) — sem Mercado Pago nesse plano. Cliente conclui na plataforma.
- **Escala:** ~1.000 SKUs → **full-text do Postgres basta**. `pgvector`/busca semântica fica para uma Fase 3 futura (perguntas vagas tipo "algo pra loiro sem amarelar"), só se justificar.

### Responsividade mobile (em andamento)
O app era desktop-first; passada para funcionar bem no celular (o atendente usa via PWA).
- ✅ Shell responsivo: sidebar vira drawer com hambúrguer (animado); conteúdo full-width; item ativo destacado.
- ✅ Conversas: sem overflow horizontal (mensagens com URL/palavra longa quebram — `break-words`/`overflow-wrap:anywhere`); cabeçalho compacto (status vira bolinhas no mobile); barra global oculta na conversa aberta (sem gap); campo de mensagem 16px (sem zoom iOS) + botão Enviar full-width abaixo.
- ✅ Funil: botão "mover" em cada card (tap-to-move) além do drag no desktop.
- ✅ Agenda: barra de ações quebra linha; cards com ações em linha própria.
- ✅ Dashboard: cards 2 colunas no mobile; alerta empilha.
- ✅ Contatos: tabela com rolagem horizontal; padding reduzido no mobile; **excluir contato direto na lista** (modal de confirmação, funciona no PWA).
- ✅ Padding responsivo (p-4 sm:p-8) em todas as telas do painel.
- 🔜 Opcional futuro: áreas de toque maiores, safe-area no notch.

### 3. PWA da inbox (app no celular sem App Store)
Transformar a inbox web num app instalável ("Adicionar à Tela de Início"), resolvendo a objeção "quero um app tipo WhatsApp" sem custo/revisão de loja.
- **Fase A (feita ✅):** manifest (`app/manifest.ts`) + meta tags de app (appleWebApp) + service worker (`public/sw.js`) → inbox instalável no celular (iOS/Android), abre em tela cheia. start_url `/conversations`. Ícone atual = logo.svg (no iOS, adicionar um PNG 180/192/512 depois deixa o ícone perfeito).
- **Fase B (feita ✅):** **notificações push** de mensagem nova (Web Push + VAPID). Modelo PushSubscription; /api/push/{subscribe,unsubscribe,test}; lib/push.ts; service worker push+notificationclick; toggle "Ativar notificações" + "Enviar teste" em Configurações; webhook dispara push a cada inbound. VAPID em env (4 vars) no Railway. Testado no iPhone (PWA instalado). Obs.: chaves VAPID precisam de .trim() (quebra de linha ao colar).
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

## ✅ Melhorias recentes do bot / UX
- Indicador "digitando…" no WhatsApp antes do bot responder (Cloud API typing_indicator + status:read → marca como lida). Vale para bot IA e menu bot.
- Prompt de bot por cliente (ex.: Cinthia Claro Arquitetura) — configurado via campo bot_prompt no tenant.

## 💡 Backlog / ideias
- **Badge de não vistas — evoluções (obs.):** o `last_read_at` é **global por conta** (não por atendente) — decisão consciente (YAGNI): hoje o acesso é por um login de tenant, então funciona bem. Quando existir multi-atendente com logins separados, evoluir para leitura por usuário (tabela `conversation_reads` por usuário+contato; o `last_read_at` atual vira fallback). ✅ **Badge ao vivo feito** (auto-refresh 30s + foco da aba + troca de rota, via `/api/conversations/unread`). Ideia restante: **ordenar a lista** colocando as conversas não vistas no topo.
- **Número no ícone do PWA (badge no home screen) — fora de escopo (decidido):** exige a App Badging API (`navigator.setAppBadge`). **Android** suportaria; **iOS não suporta** para PWA (só app nativo da App Store). Como o público-alvo é majoritariamente iOS e ficaria inconsistente, **decidimos não implementar**. O número fica só dentro do app + push notifications. Reabrir só se houver app nativo iOS no futuro.
- Preview da foto de perfil atual do WhatsApp dentro de `/settings`
- Two-track: SaaS self-service (Tech Provider) + projetos customizados número próprio (já suportado, manter)
