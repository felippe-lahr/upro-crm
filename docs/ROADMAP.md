# UProCRM — Roadmap

Estado e próximos passos do produto. Atualizar conforme as coisas andam.
Última atualização: 2026-08-15.

## ✅ Concluído (sessão de ago/2026)
- **Resumo do atendimento configurável (4.0)** — `summary_instructions` por tenant guia o formato/foco do resumo gerado pela IA (Pro/Promaster).
- **Encaminhar resumo por WhatsApp (4.1)** — envio automático do resumo completo para um número, via template aprovado (`resumo_atendimento`), disparado quando a conversa é concluída (`concluded`) + fallback no cron. Entitlement `feature_summary_forward` liberado por tenant no admin. Trava anti-duplicação (`summary_forwarded_at`). Template criado automaticamente na WABA ao ligar o recurso. **Pré-requisito de entrega:** billing da WABA configurado (ver 131042 abaixo).
- **Etiquetas de leads (4.2)** — taxonomia por tenant (`lead_tags`), auto-tag pela IA com toggle `auto_tag_enabled`, classificação manual por dropdown na conversa. Múltiplas etiquetas coexistem.
- **Origem de tráfego (CTWA)** — tag automática de anúncio no webhook quando a 1ª mensagem traz `referral`. Diferencia **Instagram vs Facebook** (`anúncio Instagram`/`anúncio Facebook`) e guarda detalhes em `Contact.lead_source` (plataforma, título/campanha, URL). Destaque visual âmbar 📣 na lista e na conversa + selo "Lead veio de anúncio" no painel do contato. **Não é retroativo** (só vale para leads novos que cheguem por anúncio).
- **Lista de conversas** — data + hora nos cards (UTC-3), filtro por período personalizado com date-picker pt-BR (`DatePickerBR`, sempre dd/mm/aaaa).
- **Funil de vendas — drawer do lead** — clicar no card abre um drawer lateral (desliza da direita) para editar nome, e-mail, valor, etapa, observações e **etiquetas** (chips + dropdown); mostra **Resumo (IA)** e a **data do contato**; botões "Abrir conversa" e "WhatsApp". Filtro por **período personalizado** também no funil.
- **UX diversos** — logout redireciona para uprocrm.com.br **forçando tema escuro**; tema escuro é o padrão; rodapé da home "Desenvolvido por Studio44".
- **Ferramentas de diagnóstico** (token=NEXTAUTH_SECRET): `/api/admin/ai-health`, `/api/admin/bot-diagnose` (config, `?run=1`, `?forwardtest=1`, `last_send_status`), `create-summary-template`, `summary-template-status`, `set-plan`.
- **Correção crítica do bot mudo** — `chatAnthropic` passou a concatenar todos os blocos `type:'text'` (o `claude-sonnet-5` tem thinking ON e devolvia bloco `thinking` em `content[0]`, resultando em resposta vazia).

## ✅ Concluído (recente)
- **Resumo de pedido (feature_orders) — IMPLEMENTADO.** Recurso liberado por tenant no admin (entitlement `feature_orders`, modal "Editar tenant" → "Resumo de pedido"). O catálogo (≤200 produtos) vive no próprio `bot_prompt` do tenant; o bot monta o pedido conversando e chama a tool `registrar_pedido` UMA vez ao confirmar (itens = produto/quantidade/preço unitário conforme o catálogo). **Não conclui a venda** — é um resumo para um vendedor humano. Ao registrar: cria `Order` (schema do tenant) + `OrderRef` (índice público por token opaco), gera um **PDF** (`pdf-lib`, `lib/order-pdf.ts`) servido sob demanda em `/api/pedido/[token]`, **envia o PDF automaticamente ao cliente** pelo WhatsApp (documento por link), e marca no `ai_summary` do lead que houve pedido. Nova aba **"Pedidos"** no painel (só aparece com a flag ligada) lista os pedidos com itens, total, status editável (novo/em separação/concluído/cancelado, via `/api/orders/update`) e link do PDF. Rodapé do PDF deixa claro que não é nota fiscal nem confirmação de pagamento.
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
- ✅ **App Review da Meta APROVADO** (28/07/2026) — `whatsapp_business_messaging`, `whatsapp_business_management`, `public_profile` aprovados. → executar o checklist de segurança pós-aprovação (abaixo).

## ⏳ Em andamento
- **Checklist de segurança pós-aprovação** — agora liberado (ver seção 🔒 abaixo): apagar `analyst@`, rotacionar secrets no Railway, trocar senhas de teste.

## ✅ Rastreamento de anúncios Google Ads → WhatsApp (MVP implementado)
Mensuração de leads vindos do Google Ads e envio das conversões de volta ao Google (a conversa começa no WhatsApp, fora do site — resolvido com identificador que viaja até a conversa + reporte de volta).

**Fluxo real do tenant:** anúncio → **site do próprio tenant** (domínio dele) → botão de WhatsApp → conversa. O `gclid` cai no site do tenant; por isso a captura é feita por um **snippet no site dele** (não pela URL final do anúncio).

**Implementado:**
- `public/track.js` — snippet que o tenant cola no site (`<script src=".../track.js" data-tenant="<slug>">`). Captura `gclid`/UTMs (guarda 90 dias em localStorage) e **reescreve os botões de WhatsApp** para passar pelo `/r/wa` levando o `gclid`. Só age quando há `gclid` (visitante orgânico não é tocado). Cobre botões dinâmicos (MutationObserver).
- `/r/wa` (`src/app/r/wa/route.ts`) — recebe `t=<slug>` + `gclid`/UTMs, cria um `AdClick` (schema público) com código curto e **redireciona ao `wa.me`** do número do tenant com o marcador `#GAD:<code>` no texto.
- Webhook do WhatsApp — casa o marcador `#GAD:<code>` da 1ª mensagem com o `AdClick`, atribui ao lead `lead_source = {kind:'google_ads', gclid, utm...}` e a etiqueta **Google Ads**.
- Export `/api/leads/google-conversions` — CSV no formato **Importação de Conversões Offline (por gclid)** do Google Ads. Inclui leads com `gclid` que avançaram no funil.
- Config Tenant `ads_wa_number` + seção "Rastreamento de anúncios" nas Configurações (número + snippet copiável + passo a passo + download do CSV).
- Modelo `AdClick` no schema público (criado no boot via `prisma db push`).

**Ajustes feitos na validação em produção (site real da Cinthia — WordPress/BeTheme + Elementor + Social Chat/QLWAPP):**
- **Middleware** — `/r/` liberado como rota pública (`middleware.ts`); antes o redirecionador caía em `/login`.
- **track.js v2** — além de reescrever links `<a>`, intercepta botões que abrem via **`window.open`** (plugins de chat como Social Chat/QLWAPP e popups de formulário). Sem isso, o botão flutuante do plugin não era rastreado.
- **Marcador invisível (zero-width)** — `lib/ad-marker.ts` codifica o código do clique em caracteres de largura zero e o embute no meio da frase; o cliente vê só o texto natural (sem `#GAD` à mostra) e **não consegue apagar o marcador**. Webhook decodifica o invisível, com fallback para o `#GAD:` visível antigo.
- **Diagnóstico** `/api/admin/ads-diagnose?token=…[&code=…]` — lista os `AdClick` recentes e mostra se foram casados (`matched_at`).
- **UI** — etiqueta **Google Ads** agora com o mesmo visual âmbar + corneta 📣 das de Facebook/Instagram, na lista de conversas, na conversa e no funil (cards e drawer). Instrução do **auto-tagging** ("Codificação automática = Sim") adicionada na seção de rastreamento das Configurações.

**Aprendizados de teste (não são bugs):** no desktop o WhatsApp Web pede QR e **descarta o texto pré-preenchido** no login — testar no **celular** (fluxo real). Auto-tagging da conta da Cinthia confirmado LIGADO. Janela de atribuição do `track.js` fixada em **90 dias** (alinhada ao Google).

**Como o Google conta a conversão off-site:** via **Importação de Conversões Offline por gclid** (o clique carrega o gclid até o CRM; o CRM devolve a conversão ao Google com esse gclid). Alternativa equivalente é **Enhanced Conversions for Leads por telefone** (o telefone temos 100%, dispensa gclid) — não implementada, fica como opção.

**Pendências/refino (a fazer):**
- **Valor real da conversão:** usar o `deal_value` do lead no CSV em vez de valor fixo.
- **Etapa = conversão configurável:** hoje o critério é fixo (saiu de `novo_lead` e não está `perdido`); permitir escolher a etapa.
- **White-label:** servir o `track.js` e o redirect de um domínio neutro (sem `uprocrm.com.br` aparecer no site do cliente) — decidido começar pelo padrão; ligar white-label quando for posicionar para agências.
- **Fase 3 (futuro):** envio automático das conversões via **Google Ads API** (OAuth + developer token), dispensando o CSV manual.

## 🔜 Próximos passos (ordenados)

### ✅ 0. Disparos de consentimento (iniciar conversa pedindo permissão) — IMPLEMENTADO
Fluxo correto e dentro da política da Meta para **iniciar** conversas via template aprovado (substitui o disparo de texto livre, que só entregava dentro da janela de 24h).

**Decisão-chave (variável editável, sem re-aprovação):** em vez de gatear a edição do texto por entitlement (a ideia antiga `feature_broadcast_custom`, **descartada**), o texto que cada tenant escreve entra numa **variável `{{3}}`** do template. A estrutura é aprovada **uma vez** pela Meta; cada tenant só troca o miolo — **sem nova aprovação**. Todo tenant personaliza a própria mensagem.

**Template `consentimento_conversa` (MARKETING, pt_BR):**
> "Olá {{1}}, somos da {{2}}. {{3}}. Se tiver interesse digite SIM para continuar. Caso não queira mais receber esta mensagem digite SAIR."
> — `{{1}}`=nome (auto), `{{2}}`=empresa (auto), `{{3}}`=frase que o tenant escreve no envio.

**Implementado:**
- `lib/whatsapp-templates.ts`: `CONSENT_TEMPLATE_NAME` + `createConsentTemplate()` (com example dos 3 params); status via `getSummaryTemplateStatus` (genérico por nome).
- `api/broadcasts` (GET/POST): GET devolve status do modelo + etiquetas + empresa; POST envia via `sendWhatsAppTemplate` com `[nome, empresa, frase]`, **teto de 30**, exclui `opted_out`, cria o template no 1º uso (retorna 409 "aguardando aprovação"), intervalo de 400ms entre envios, grava no histórico.
- **Opt-in/opt-out no webhook:** resposta **SAIR** → `Contact.opted_out=true` + etiqueta `opt-out` (nunca mais entra em disparo — LGPD/Meta); **SIM** → etiqueta `consentiu`.
- UI `/broadcasts`: campo "sua mensagem" (`{{3}}`, máx. 500, 1 linha), **prévia** em tempo real, badge de status do modelo, seletor de etiqueta, avisos SIM/SAIR e de custo; botão travado até o modelo estar `APPROVED`.
- Schema: `Tenant.broadcast_consent_template`, `Contact.opted_out`.

**Pré-requisitos externos (para entregar de fato):** billing da WABA ok (erro **131042**) + aprovação do template pela Meta (assíncrona, por conta — disparada no 1º envio).

**Seleção manual de contatos (`contactIds`)** já é aceita pela API; falta só a UI de marcar contato a contato (hoje a seleção é por etiqueta/todos, com teto de 30). Backlog leve.

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

### 4.0 Resumo do atendimento configurável pelo prompt (Pro, GERAL) — ESPECIFICADO, pré-requisito do 4.1
Hoje o resumo (`ai_summary`) é gerado por um **prompt FIXO** em `extractContactInfo` (`bot.ts`) → JSON `{name, email, summary, qualified}`, resumo de 1–2 frases. Tornar o **conteúdo do resumo definível pelo negócio**.

- **Campo novo (Tenant, Pro):** `summary_instructions String?` — o cliente descreve o que o resumo deve conter e em que formato. Ex.: *"Inclua sempre: nome, telefone, e-mail e serviço de interesse; se houver, orçamento e prazo."*
- **Como injetar:** o prompt de extração passa a combinar (a) **contexto do negócio** — reaproveitar o `bot_prompt` como pano de fundo para o extrator entender o domínio — e (b) as **`summary_instructions`** ("monte o resumo seguindo estas orientações"). Continua respondendo em JSON; o campo `summary` passa a seguir as instruções.
- **Telefone:** já disponível (é o número do contato) — incluir automaticamente quando as instruções pedirem, sem depender do cliente digitar.
- **Fallback:** `summary_instructions` vazio → mantém o comportamento fixo atual (não quebra quem já usa).
- **Formato livre:** permitir tanto texto corrido quanto rótulos ("Nome: … / Serviço: …"), conforme o cliente descrever.
- **UI/API:** campo de texto em Configurações (gated a `['pro','promaster']`), via `/api/tenant/settings`.

### ✅ 4.1 Encaminhar resumo do atendimento para WhatsApp do gestor (Pro) — IMPLEMENTADO
> **Implementado.** Falta só, por tenant: (1) admin liga o entitlement no modal "Editar tenant" (cria o template na WABA automaticamente); (2) o cliente preenche o número em Configurações (nome do template é automático; selo mostra status de aprovação). Envio dispara ao qualificar o lead (1x), com trava `summary_forwarded_at`.
>
> ⚠️ **PRÉ-REQUISITO OBRIGATÓRIO — billing da WABA do cliente:** template é mensagem **cobrada** (iniciada pelo negócio). Se a WhatsApp Business Account do cliente **não tiver forma de pagamento + moeda/país configurados**, a Meta **aceita mas NÃO entrega** — falha com **erro 131042** ("Business eligibility payment issue / currency is not configured"). As respostas do bot funcionam mesmo assim (janela de 24h), mas o template não. Correção (na conta Meta do cliente): Central de faturamento → adicionar cartão + definir país/moeda para a WABA. Diagnóstico: `bot-diagnose?...&forwardtest=1` → depois ler `last_send_status` (status `delivered` = ok; `failed`+131042 = billing pendente). Confirmado em produção com Cinthia Claro (ago/2026).
>
> **Ferramentas de suporte:** `create-summary-template` e `summary-template-status` (token-guarded); `bot-diagnose?...&forwardtest=1` dispara envio de teste e captura `last_send_status` (callback de entrega da Meta, gravado pelo webhook).

Quando o bot qualifica um lead, enviar automaticamente o **resumo do atendimento (`ai_summary`)** para um **número de WhatsApp cadastrado** (o gestor/dono). **Depende do 4.0** (o resumo já sai no formato que o negócio quer). Decisões já tomadas com o cliente:

- **Método de envio: TEMPLATE aprovado** (não é dentro da janela 24h). Mensagem iniciada pelo negócio → a Meta exige template. Precisa existir/estar aprovado na **WABA de cada tenant**.
- **Gatilho: ao qualificar o lead — 1x por lead.** Reaproveitar a transição que já existe em `extractContactInfo` (`bot.ts`): `if (data.qualified && current.stage === 'novo_lead') → em_atendimento`. Enviar exatamente nessa transição (dispara uma única vez por contato). Opcional: gravar `summary_forwarded_at` no Contact como trava extra anti-duplicação.
- **Destino: um número por conta (tenant), em Configurações.** Também exibir/editar no painel da conversa, **abaixo do bloco "Resumo (IA)"** (só reflete o mesmo número global do tenant). **Campo dedicado e validado (E.164)** — decidido NÃO colocar o número solto no `bot_prompt` (risco de dígito errado → destino errado; sem validação). Evolução futura possível: **roteamento por rótulo** (lista de destinos validados + prompt escolhe o setor) — ver item 4 "Roteamento inteligente".
- **Liberação por tenant, controlada pelo superadmin (entitlement).** Esta é uma feature de nicho (uso inicial: ~2 clientes), então **NÃO** exposta a todo o Pro. Novo campo `feature_summary_forward Boolean @default(false)` no Tenant, ligado/desligado **só no painel admin** (modal "Editar tenant"). A seção de config (número + on/off) só **aparece nas Configurações do cliente quando essa flag está ligada**; para os demais, fica invisível. Ligar para um novo cliente = um clique no admin, sem deploy.
- **Escopo do gate (DECIDIDO):** prender **apenas o encaminhamento (4.1)** atrás de `feature_summary_forward`. O **4.0 (resumo configurável)** é **geral do Pro** — liberado para todos os tenants Pro/Promaster, sem entitlement.
- **Exclusivo do plano Pro** (e Promaster) **+ entitlement do admin**.

**Desenho técnico:**
- **Schema (Tenant, público):** `summary_forward_enabled Boolean @default(false)`, `summary_forward_number String?` (E.164, só dígitos), `summary_forward_template String?` (nome do template aprovado; default ex.: `resumo_atendimento`).
- **Template na WABA:** categoria *utility*, idioma `pt_BR`, corpo com 1–2 parâmetros. Ex.: corpo = `Novo resumo de atendimento ({{1}}):\n\n{{2}}` → `{{1}}` = nome/telefone do contato, `{{2}}` = `ai_summary`. Duas opções de provisionamento: (a) **auto-criar** via WhatsApp Business Management API `POST /{waba_id}/message_templates` quando o tenant ativa a função (aprovação é assíncrona — guardar o nome e só enviar após aprovado); (b) o operador cria manualmente e cadastra o nome. Recomendação: auto-criar, com fallback claro se ainda não aprovado.
- **Envio:** nova função `sendWhatsAppTemplate(tenant, to, templateName, lang, bodyParams[])` espelhando `sendWhatsAppMessage`/`sendWhatsAppButtons` (POST em `graph.facebook.com/v21.0/{phone_number_id}/messages`, `type: "template"`, `components: [{ type: "body", parameters: [{type:"text", text:...}] }]`). Token via `decrypt(tenant.whatsapp_token)`.
- **Ponto de disparo:** `extractContactInfo` passa a receber os campos de forward do tenant (ou retornar `{ qualifiedNow, summary }` para o webhook, que já tem o tenant completo, fazer o envio). Enviar só se `summary_forward_enabled && summary_forward_number && summary_forward_template` e a transição de qualificação ocorreu. Tudo em try/catch silencioso (nunca quebrar o atendimento).
- **Config API/UI:** estender `/api/tenant/settings` (GET/PATCH) com os 3 campos, gated a `['pro','promaster']`; campos em `settings/page.tsx` (componente novo tipo "Encaminhar resumo") e um campo espelho abaixo do resumo em `conversation-thread.tsx`.

**Riscos/observações:**
- Template precisa estar **aprovado** antes do primeiro envio — prever estado "aguardando aprovação".
- Validar o número de destino (E.164) e evitar enviar para o próprio número do tenant.
- Custo: cada envio é uma conversa *utility* iniciada pelo negócio (tarifada pela Meta) — avisar o cliente.
- Alternativa mais simples que ficou **descartada** pelo cliente: enviar por **e-mail** (sem template/janela).

### 5. Disparo em massa (templates) — coberto pelo item ✅ 0 (disparos de consentimento)
Envio via templates aprovados já implementado no item 0 (teto de 30 + opt-out). Evolução futura possível: volumes maiores com fila/rate-limit dedicado e outras categorias de template.

### 6. Refresh automático do token de 60 dias do WhatsApp
Rotina para renovar o token antes de expirar, evitando desconexão silenciosa.

## 🔒 Segurança — revisão para comercialização (ago/2026)

**✅ Feito e verificado nesta rodada:**
- **`NEXTAUTH_SECRET` rotacionado** no Railway (invalidou o valor que vazou em URLs de diagnóstico). Login e cron confirmados OK após a troca.
- **Backdoor `make-superadmin` lacrado** — desativado por padrão; só responde com `ENABLE_BOOTSTRAP_ADMIN=true` (mantida DESLIGADA).
- **`ADMIN_API_SECRET` dedicado** (`lib/admin-auth.ts`) — separa a autenticação de administração/diagnóstico do secret de sessão. Aplicado nos 11 endpoints admin. **Verificado:** token novo abre, `NEXTAUTH_SECRET` é rejeitado. Usar valor **hex** (`openssl rand -hex 32`) para não quebrar na URL (base64 tem `+`/`/`).
- **Crons** passam a exigir só `CRON_SECRET` (removido o fallback `NEXTAUTH_SECRET`).
- **Webhook Mercado Pago** — validação de assinatura (`timingSafeEqual`) em **modo monitor** (só loga). Setar `MP_WEBHOOK_STRICT=true` para rejeitar forjados (fazer após confirmar no log que a assinatura valida num pagamento real). Log deixou de despejar o corpo inteiro.
- **`/r/wa`** — rate limit por IP + expurgo de `AdClick` com +30 dias (no cron).
- **Isolamento multi-tenant auditado** — todos os endpoints derivam o `schemaName` da **sessão**, nunca do input do cliente. OK.
- **Webhook WhatsApp** — assinatura `X-Hub-Signature-256` já era validada. OK.

**✅ Página de login endurecida (ago/2026):**
- **Recuperação de senha** — `/forgot-password` + `/reset-password`, token de uso único (guarda só o hash, expira em 1h) enviado por e-mail (Resend). Resposta genérica (não revela se o e-mail existe). Modelo `PasswordReset` (schema público).
- **Mostrar/ocultar senha** no login e no reset.
- **Proteção contra força bruta** — no `authorize` (`lib/auth.ts`): 6 falhas por e-mail → bloqueio de 15 min (em memória).
- Rotas `/forgot-password` e `/reset-password` liberadas no middleware.
- Pré-requisito: domínio verificado no Resend (ou `EMAIL_FROM_ADDRESS=onboarding@resend.dev` para teste).
- Futuro opcional: 2FA (código por e-mail/app), rate limit por IP no request de reset.

**⏳ Pendências (pré-venda):**
- **`ENABLE_BOOTSTRAP_ADMIN`** — manter ausente/false em produção.
- **`MP_WEBHOOK_STRICT=true`** — ligar após validar o log num pagamento real.
- **Rotacionar `ENCRYPTION_KEY` e `META_APP_SECRET`** — ⚠️ `ENCRYPTION_KEY` criptografa tokens de WhatsApp/Mercado Pago dos tenants; rotacionar **quebra os já salvos** → exige migração (re-encriptar). Planejar à parte.
- Apagar o usuário `analyst@uprocrm.com.br` e trocar senhas de contas de teste.
- (Hardening futuro) mover tokens de diagnóstico de query string para header/POST; rate limit em `/api/signup` e login; monitoramento de erros (Sentry) + backup testado.
- **Legal/LGPD:** revisar Política de Privacidade/Termos, DPA com o lojista (ele é controlador dos dados dos leads; a plataforma é operadora), consentimento nos disparos.

### ✅ 4.2 Etiquetagem automática de leads (Pro) — IMPLEMENTADO (v1)
Tagueamento do **lead (contato)**, abordagem híbrida:
- **Taxonomia por tenant:** campo `lead_tags` (Tenant), editável em Configurações (chips), gated a Pro/Promaster. A IA só usa etiquetas desta lista — nunca inventa.
- **Auto-tag da IA:** no `extractContactInfo` (mesma chamada do resumo), a IA escolhe tags da taxonomia e faz **união** com as manuais (não remove o que o atendente pôs).
- **Manuais:** continua (add/remove na conversa).
- **Origem de anúncio (CTWA):** mensagens com `referral` recebem a etiqueta `anúncio` automaticamente (webhook).
- Filtro por etiqueta na lista de conversas já existia.
- **Futuro:** disparos segmentados por tag; relatórios por tag; taguear mensagem individual (baixa prioridade).

## 🩺 Diagnóstico / suporte (ferramentas permanentes)
Endpoints token-guarded (`?token=<NEXTAUTH_SECRET>`) para depurar o bot sem acesso aos logs do Railway:
- **`/api/admin/ai-health`** — faz uma chamada de IA real e devolve provider/modelo/chaves + o erro exato (billing, auth, modelo).
- **`/api/admin/bot-diagnose?email=<tenant>[&phone=][&run=1&text=]`** — mostra os flags do tenant (plano, `bot_enabled`, `handoff_pause`, pausa de 30 min, WhatsApp), as últimas mensagens do contato e, com `run=1`, **gera a resposta com o prompt real** (sem enviar ao WhatsApp), capturando caminho (`chatComplete`/`aiReplyWithTools`) e erro.

### 🐛 Bug resolvido — "bot teclando mas não responde" (causa raiz)
- **Sintoma:** IA com crédito e chave OK, `ai-health` respondia "OK", mas o bot ficava mudo no WhatsApp (várias mensagens sem resposta, sem ser a pausa de 30 min).
- **Causa:** o `claude-sonnet-5` vem com **thinking adaptativo ligado por padrão** → a resposta traz um bloco `thinking` antes do `text`. O `chatAnthropic` (`lib/ai.ts`) lia só `response.content[0]`; como o primeiro bloco era o thinking, retornava **string vazia** e o bot caía em `if (!botReply) return`. O `ai-health` passava porque o prompt trivial não disparava thinking.
- **Correção:** `chatComplete` passou a **filtrar e concatenar todos os blocos `type: text`** (o caminho de tools já fazia isso). Vale para qualquer tenant no caminho `chatComplete` (sem horários/catálogo).
- **Pendência de segurança:** `NEXTAUTH_SECRET` apareceu em prints durante a depuração → **rotacionar** (ver checklist pós-aprovação).

## ✅ Melhorias recentes do bot / UX
- Indicador "digitando…" no WhatsApp antes do bot responder (Cloud API typing_indicator + status:read → marca como lida). Vale para bot IA e menu bot.
- Prompt de bot por cliente (ex.: Cinthia Claro Arquitetura) — configurado via campo bot_prompt no tenant.

## 💡 Backlog / ideias
- **Badge de não vistas — evoluções (obs.):** o `last_read_at` é **global por conta** (não por atendente) — decisão consciente (YAGNI): hoje o acesso é por um login de tenant, então funciona bem. Quando existir multi-atendente com logins separados, evoluir para leitura por usuário (tabela `conversation_reads` por usuário+contato; o `last_read_at` atual vira fallback). ✅ **Badge ao vivo feito** (auto-refresh 30s + foco da aba + troca de rota, via `/api/conversations/unread`). Ideia restante: **ordenar a lista** colocando as conversas não vistas no topo.
- **Número no ícone do PWA (badge no home screen) — fora de escopo (decidido):** exige a App Badging API (`navigator.setAppBadge`). **Android** suportaria; **iOS não suporta** para PWA (só app nativo da App Store). Como o público-alvo é majoritariamente iOS e ficaria inconsistente, **decidimos não implementar**. O número fica só dentro do app + push notifications. Reabrir só se houver app nativo iOS no futuro.
- Preview da foto de perfil atual do WhatsApp dentro de `/settings`
- Two-track: SaaS self-service (Tech Provider) + projetos customizados número próprio (já suportado, manter)
