# UProCRM — Prompt-Mestre de Reconstrução (do zero ao go-live)

> **Como usar este documento:** cole todo este arquivo numa conversa nova com o
> Claude e diga *"Construa este produto do zero seguindo esta especificação,
> passo a passo, do stack ao go-live."* É a fonte da verdade do produto: descreve o
> que o UProCRM é, os dois modelos de negócio, o stack, o schema completo do banco,
> **cada rota e cada módulo já implementados**, o comportamento exato do bot, as
> integrações, as variáveis de ambiente (só nomes — nunca cole valores/segredos) e o
> checklist de publicação na Meta. Ao final há um **changelog completo por commit**,
> refletindo tudo que foi construído até a data.
>
> Reflete o repositório em **2026-07-06**. Stack real: Next.js 14.2.35 / Prisma 5.22
> / PostgreSQL schema-per-tenant / NextAuth v5-beta / Railway.

---

## 1. Visão do produto

**UProCRM** é um SaaS multi-tenant de CRM para **WhatsApp Business**, para PMEs de
serviço no Brasil (escolas de dança, consultórios, clínicas, estúdios, prestadores).
Cada cliente (tenant) conecta um número de WhatsApp e passa a receber, responder e
organizar conversas numa **caixa de entrada compartilhada**, com um **bot de IA** que
qualifica leads, responde 24/7 e **agenda atendimentos** sozinho (tool-use), cobra
**sinal via Pix** quando configurado, envia **confirmações e lembretes** por WhatsApp
e e-mail, e organiza tudo num **funil Kanban** e numa **agenda** (dia/mês). Tem
**programa de afiliados**, **cobrança recorrente** (Mercado Pago), **cupons** e
**painel admin**.

Operado pela pessoa jurídica **Studio44 Vendas e Marketing No Digital LTDA** (nome
fantasia **S44 Digital**, CNPJ 23.192.161/0001-20). Produção: `uprocrm.com.br`.
Planos: **Básico** (menu bot, sem IA) e **Pro** (bot com IA, funil personalizável).

### 1.1 Os dois modelos de conexão (coexistem no mesmo app)

Ponto central de arquitetura — **não são exclusivos**:

1. **SaaS self-service (Tech Provider / Provedor de Tecnologia da Meta)** — modelo
   principal, escalável. O cliente clica "Conectar WhatsApp", faz o **Embedded
   Signup** (popup oficial via Facebook JS SDK) e conecta o próprio número sozinho.
   Exige o app da Meta em modo **Provedor de Tecnologia**, com **Advanced Access** a
   `whatsapp_business_management` e `whatsapp_business_messaging`, e **App Review**
   aprovado (screencast do fluxo ponta a ponta).

2. **Número próprio / projeto customizado** — modelo secundário, para clientes
   premium. O operador (S44) conecta manualmente informando `phone_number_id`,
   `access_token` (System User Token) e `waba_id`. **Não depende do App Review.**
   Implementado por `/api/admin/connect-whatsapp-manual` (protegido pelo token do
   operador) + **wizard "Conectar número próprio (avançado)" em `/settings`**.

> Migrar o app da Meta para "Provedor de Tecnologia" **habilita** o modelo 1 e
> **não remove** o modelo 2 — a conexão manual continua funcionando.

---

## 2. Stack de desenvolvimento

| Camada | Escolha |
|---|---|
| Framework | **Next.js 14.2.35**, App Router, TypeScript |
| Render | Server Components + Route Handlers (`app/api/**/route.ts`), todas com `export const dynamic = 'force-dynamic'` |
| Banco | **PostgreSQL** (schema-per-tenant) |
| ORM | **Prisma 5.22** (`@prisma/client` carregado via `require` para não quebrar antes do `generate`) |
| Auth tenants | **NextAuth v5-beta** (Credentials, `bcryptjs`), `trustHost: true` |
| Auth afiliados | sessão própria por cookie assinado, separada do NextAuth |
| IA | camada plugável `lib/ai.ts` → **Anthropic** (`claude-sonnet-4-6`) ou **Groq** (`llama-3.3-70b-versatile`) |
| Agendamento por IA | Anthropic **tool-use** (loop de até 5 iterações) |
| Transcrição de áudio | **Groq Whisper** (`whisper-large-v3`) |
| WhatsApp | **Meta WhatsApp Cloud API**, Graph API **v21.0** |
| Pagamentos SaaS | **Mercado Pago PreApproval** (recorrente) — Stripe como alternativa |
| Pagamentos sinal | **Mercado Pago Payment** (Pix) com token do lojista |
| E-mail | **Resend** (domínio `uprocrm.com.br` verificado) |
| Cripto | AES-256-GCM (`lib/crypto.ts`) para tokens |
| Estilo | **Tailwind CSS**, tokens semânticos (brand blue, light), fonte Poppins, `lucide-react` |
| Deploy | **Railway** (web + Postgres) |

**Scripts (`package.json`):**
- `dev`: `next dev`
- `build`: `prisma generate && next build`
- `start`: `node scripts/boot-migrate.js; next start`
- `lint`: `next lint`

**Dependências-chave:** `@anthropic-ai/sdk`, `@prisma/client`+`prisma`,
`next-auth@5-beta`, `mercadopago@3`, `resend@6`, `stripe`, `bcryptjs`,
`lucide-react`. ESLint: `no-explicit-any` desabilitado (build). `next.config.mjs`:
`serverExternalPackages` para Prisma; header **HSTS** para forçar HTTPS.

---

## 3. Multi-tenancy (schema-per-tenant)

- **Schema `public`** = modelos globais: `Tenant`, `Affiliate`,
  `AffiliateCommission`, `AppointmentPayment`, `TenantUser`, `SaasConfig`, `Coupon`.
- **Cada tenant** = schema PostgreSQL próprio (`schema_name`, formato
  `tenant_<slug com _>`), com: `Contact`, `Conversation`, `Message`, `QuickReply`,
  `Broadcast`, `Agent`, `Service`, `Availability`, `Appointment`.
- **`lib/prisma-tenant.ts`**: `globalPrisma` (schema `public`, singleton) +
  `getTenantPrisma(schemaName)` (client por schema, cacheado em `Map`). Usa
  `?schema=<name>` na `DATABASE_URL`.
- **`lib/provision-tenant.ts`**: `provisionTenant(tenantId)` cria o schema
  (`CREATE SCHEMA IF NOT EXISTS`), roda `prisma db push --skip-generate` apontando a
  `DATABASE_URL` ao schema, ativa o tenant (`status=active`, normaliza `trial`→`basic`,
  define `trial_ends_at` = +7 dias) e envia e-mail de boas-vindas (não-fatal).
- **`scripts/migrate-tenant-schemas.js`**: aplica o schema atual a **todos** os
  tenants. **`scripts/boot-migrate.js`**: roda isso no boot e **sempre sai com código
  0** (falha de migração nunca derruba o app).

**Regra de ouro:** `@unique` global adicionado depois a modelo tenant-scoped com
dados existentes faz `prisma db push` recusar por "data loss". Use `@@index([...])`
para identificadores como `bsuid`, **não** `@unique`.

---

## 4. Schema do banco (Prisma) — campos por modelo

### 4.1 Globais (schema `public`)

**Tenant** (`tenants`): `id` (uuid), `slug` @unique, `name`, `email` @unique,
`plan` (trial/basic/pro, default trial), `status` (default pending_payment),
`schema_name` @unique.
WhatsApp: `waba_id`, `phone_number_id`, `whatsapp_token` (criptografado),
`whatsapp_connected` (bool).
Bot: `bot_enabled`, `bot_prompt`, `menu_bot_enabled`, `menu_bot_greeting`,
`menu_bot_options` (Json), `handoff_pause`, `keep_responding_after_human`.
Funil Pro: `funnel_labels` (Json — { stageId: label }), `loss_reasons` (Json —
string[], até 10).
Agendamento (defaults do tenant): `booking_gap_min`, `booking_min_notice_min`.
Billing: `mp_subscription_id`, `mp_access_token` (Pix do lojista, criptografado),
`stripe_customer_id`, `trial_ends_at`.
Afiliado: `referred_by` (uuid → Affiliate). Timestamps `created_at`/`updated_at`.

**Affiliate** (`affiliates`): `name`, `email` @unique, `password_hash`, `code`
@unique, `commission_type` (percent/fixed), `commission_value` (Decimal, default 30),
`recurrence` (lifetime/first/12m), `status` (pending/active/rejected/suspended),
`pix_key`.

**AffiliateCommission** (`affiliate_commissions`): `affiliate_id`, `tenant_id`,
`amount`, `base_amount`, `reference_month` ("2026-06"), `status` (pending/paid).
`@@unique([affiliate_id, tenant_id, reference_month])` — idempotência por mês.

**AppointmentPayment** (`appointment_payments`): `payment_id` @unique (id do
pagamento MP), `tenant_id`, `schema_name`, `appointment_id`, `amount`, `status`
(pending/approved/expired). Roteia o webhook Pix ao schema/agendamento certo.

**TenantUser** (`tenant_users`): `tenant_id`, `email`, `name`, `role` (default
agent), `password_hash`. `@@unique([tenant_id, email])`.

**SaasConfig** (`saas_config`, singleton id="singleton"): `price_basic` (97),
`price_pro` (197), `annual_discount` (20).

**Coupon** (`coupons`): `code` @unique, `description`, `discount_type`
(percent/fixed), `discount_value`, `max_uses`, `uses_count`, `expires_at`, `active`.

### 4.2 Tenant-scoped

**Contact** (`contacts`): `whatsapp_id` @unique (id endereçável do webhook — telefone
ou BSUID), `bsuid` (`@@index` — Business-Scoped User ID), `name`, `phone`, `email`,
`stage` (default novo_lead), `deal_value`, `notes`, `ai_summary`, `loss_reason`,
`tags` (string[]).

**Conversation** (`conversations`): `contact_id`, `status` (open/pending/…),
`assigned_to`.
**Message** (`messages`): `whatsapp_id` @unique?, `contact_id`, `conversation_id?`,
`direction` (inbound/outbound), `type` (default text), `content`, `media_url`,
`sent_by_bot` (bool), `timestamp`.

**QuickReply** (`quick_replies`): `shortcut` @unique, `content`.
**Broadcast** (`broadcasts`): `message`, `status` (draft/…), `total`, `sent_count`,
`failed_count`, `filter_tag`, `sent_at`.
**Agent** (`agents`): `email` @unique, `name`, `role`.

**Service** (`services`): `name`, `duration_min` (60), `price?`, `active`,
`gap_min` (intervalo entre atendimentos), `min_notice_min` (antecedência mínima),
`charge_mode` (none/fixed/percent/full), `charge_value?`, `hold_minutes` (30, prazo
p/ pagar o sinal). **Cada serviço tem config de horário/gap/antecedência/cobrança
independente.**

**Availability** (`availability`): `service_id?` (null = padrão do tenant),
`weekday` (0=Dom…6=Sáb), `start_min`, `end_min` (minutos desde 00:00).
`@@index([service_id, weekday])`.

**Appointment** (`appointments`): `contact_id?`, `service_id?`,
`customer_name` (**para quem é** — participante: aluno/paciente/próprio),
`customer_phone`, `customer_email`, `booked_by` (**quem agendou** — responsável),
`title`, `start_at`, `end_at`, `status`
(scheduled/confirmed/cancelled/done/no_show/pending_payment),
`amount_due?`, `payment_id?`, `payment_status?` (pending/approved/expired),
`hold_expires_at?`, `reminder_sent` (véspera), `day_reminder_sent` (no dia).
`@@index([start_at])`.

---

## 5. Bibliotecas centrais (`src/lib/`) — comportamento exato

### 5.1 `crypto.ts`
AES-256-GCM. `encrypt(text)`/`decrypt(payload)` usando `ENCRYPTION_KEY` (32 bytes).
Formato armazenado inclui IV + authTag. Usado para `whatsapp_token` e
`mp_access_token`.

### 5.2 `ai.ts` (camada de IA plugável)
`chatComplete({ system, messages, maxTokens })`. `resolveProvider()`: usa
`AI_PROVIDER` se for `anthropic`/`groq`; senão Anthropic se `ANTHROPIC_API_KEY`
começa com `sk-ant`, caindo para Groq. Modelos por `ANTHROPIC_MODEL`
(`claude-sonnet-4-6`) / `GROQ_MODEL` (`llama-3.3-70b-versatile`). Groq via endpoint
OpenAI-compat.

### 5.3 `scheduling.ts`
- `weekdayOf`/`weekdayName` (fuso BR fixo `-03:00`, sem horário de verão).
- `getAvailableSlots(prisma, dateStr, durationMin, gapMin=0, minNoticeMin=0, serviceId=null)`:
  busca `Availability` do `weekday` **daquele serviço** (fallback ao padrão do
  tenant quando serviceId null); gera slots em passo `durationMin + gapMin`;
  aplica **antecedência mínima** (`now + minNoticeMin`); trata o **gap como bloqueio
  antes/depois** de cada agendamento existente (overlap com `gapMs`); **ignora
  pré-reservas `pending_payment` expiradas** (`hold_expires_at < now`); ignora
  cancelled/no_show.
- `brDateTime(dateStr, hm)` monta `Date` no fuso BR.

### 5.4 `pix.ts`
`createPixCharge({ accessToken, amount, description, payerEmail, externalReference,
notificationUrl, expiresMinutes })` → cria Payment Pix no MP do **lojista**, retorna
`{ paymentId, qrCode (copia-e-cola), qrCodeBase64, ticketUrl, amount }`.
`getPixPaymentStatus(accessToken, paymentId)`. `external_reference` =
`appt:<schema>:<appointmentId>`.

### 5.5 `email.ts` (Resend)
`getResend()` (lazy). `FROM_ADDRESS = EMAIL_FROM_ADDRESS || 'noreply@uprocrm.com.br'`.
- `sendWelcomeEmail({ to, name, loginUrl })`.
- `sendAppointmentEmail({ to, businessName, replyTo, serviceName, whenLabel, kind,
  attendeeName, bookedBy })`, `kind` ∈ created/confirmed/cancelled/reminder. HTML
  com tabela: Serviço, **Para** (participante), **Agendado por** (responsável), Data
  e horário. `from` = nome do negócio; `replyTo` = e-mail do tenant.
- `sendPasswordResetEmail`.
- ⚠️ O SDK Resend retorna `{ data, error }` e **não lança** — sempre checar `error`.

### 5.6 `bot.ts` (o coração)
- **`extractContactInfo(tenant, contact)`**: lê últimas 30 mensagens, pede ao LLM um
  JSON `{name, email, summary, qualified}`, preenche campos vazios do contato e
  avança `novo_lead`→`em_atendimento` quando qualificado. Best-effort/silencioso.
- **Constantes**: `HUMAN_TAKEOVER_MINUTES=30` (bot silencia após humano),
  `HISTORY_LIMIT=25`, `ESCALATE_MARKER='[ESCALAR]'`, `HANDOFF_NOTICE`, `GUARDRAIL`
  (anti-alucinação: só responde com base no fornecido, escala assuntos sensíveis,
  pede nome/e-mail naturalmente).
- **`SCHEDULING_TOOLS`** (tool-use): `verificar_horarios(data, servico?)`,
  `agendar(data, hora, servico?, nome, agendado_por?, email?)`,
  `reagendar(...)` (idêntico + cancela agendamentos futuros ativos do contato antes
  de criar). `nome` = participante; `agendado_por` = responsável.
- **`resolveService`**: casa por nome (`includes`) ou pega o primeiro ativo; devolve
  duration/gap/minNotice/chargeMode/chargeValue/holdMinutes/price.
- **`computeChargeAmount`**: fixed → valor; percent → `price*value/100`; full →
  price; none → 0.
- **`runSchedulingTool`**: valida horário contra `getAvailableSlots` (rejeita se não
  estiver livre); em serviço com cobrança cria Appointment `pending_payment`
  (`hold_expires_at`), gera Pix, grava `AppointmentPayment` global, envia Pix
  copia-e-cola + link ao cliente por WhatsApp, e retorna `aguardando_pagamento`
  (o bot NÃO diz "confirmado"); sem cobrança cria `scheduled` e dispara e-mail
  `created`. Guarda o e-mail no contato.
- **`aiReplyWithScheduling`**: loop de até 5 turns de tool-use com o Anthropic SDK.
- **`processBotResponse`**: aplica pausa por humano (30 min) e handoff; monta
  histórico; injeta saudação de primeiro contato (pede nome/e-mail); ativa
  agendamento se provider=Anthropic **e** o tenant tem `Availability` cadastrada;
  injeta *hint* rígido de agendamento (data de hoje BR, nunca calcular dia da semana,
  sempre verificar_horarios antes, usar reagendar para remarcação, tratar
  aguardando_pagamento); detecta `[ESCALAR]` → marca conversa `pending`; envia
  resposta e persiste.
- **Menu bot** (`processMenuBotResponse`): clique em botão → resposta cadastrada;
  senão envia saudação + até 3 botões interativos (`sendWhatsAppButtons`).
- **`sendWhatsAppMessage` / `sendWhatsAppButtons`**: POST à Graph API v21.0 com token
  descriptografado.

### 5.7 `transcribe.ts`
`transcribeWhatsAppAudio(tenant, mediaId)`: resolve URL do mídia na Graph API, baixa
o binário, envia ao **Groq Whisper** (`whisper-large-v3`, pt). Sem `GROQ_API_KEY` →
null (bot ignora áudio).

### 5.8 `funnel.ts`
`FUNNEL_STAGES` (novo_lead, em_atendimento, proposta, negociacao, ganho, perdido);
`LOST_STAGE_ID='perdido'`; `resolveStages(labels)` mescla rótulos personalizados (Pro).

### 5.9 `affiliate.ts`
`generateAffiliateCommission(tenantId, baseAmount, when)`: acha `referred_by`, valida
afiliado ativo, aplica recorrência (`first` → 1, `12m` → 12, `lifetime` → sempre),
calcula percent/fixed, faz **upsert** idempotente por `(afiliado, tenant, mês)`.

### 5.10 `auth.ts` / `auth.config.ts` / `affiliate-auth.ts`
NextAuth v5 dividido em config (para o middleware) + `auth()` wrapper; `trustHost`.
Sessão de afiliado por cookie próprio.

---

## 6. Rotas da aplicação (App Router)

### 6.1 Páginas
- **Públicas** `(public)`: `/` (landing com hero animado — borda sutil + feixe de luz
  girando a cada 10s, `logo.svg` + wordmark), `/login`, `/signup`, `/checkout`
  (seletor Básico/Pro + MP Card Brick transparente, sem redirect), `/afiliados`.
- **Legais**: `/privacidade`, `/termos`, `/exclusao-de-dados` (LGPD + pré-requisito
  Meta) via `components/legal/legal-shell.tsx` (constante `COMPANY` com dados da
  Studio44). Linkadas no rodapé.
- **Tenant** `(tenant)`: `/dashboard`, `/conversations` + `/conversations/[id]`
  (inbox), `/contacts`, `/funnel` (Kanban), `/agenda` (dia/mês + editor de serviço +
  novo agendamento com "Para quem é" e "Agendado por"), `/broadcasts`, `/settings`,
  `/onboarding/connect-whatsapp` (Embedded Signup).
- **Onboarding pós-pagamento**: `/onboarding`.
- **Admin**: `/admin` (preços, cupons, afiliados, comissões, deletar tenant/afiliado
  com type-to-confirm, superadmin).
- **Afiliado**: `/afiliado`, `/afiliado/login`.

### 6.2 API (todas `force-dynamic`)
- **Auth**: `/api/auth/[...nextauth]`, `/api/affiliate/login`, `/api/affiliate/logout`.
- **Signup/onboarding**: `/api/signup`, `/api/health`.
- **WhatsApp**: `/api/webhooks/whatsapp` (GET verify + POST assinado),
  `/api/whatsapp/connect` (POST Embedded Signup / DELETE desconectar),
  `/api/admin/connect-whatsapp-manual` (número próprio, protegido).
- **Billing**: `/api/billing/mercadopago/create-subscription`, `/api/billing/status`,
  `/api/billing/cancel`, `/api/billing/stripe/create-checkout`,
  `/api/webhooks/mercadopago`, `/api/webhooks/stripe`.
- **Agendamento**: `/api/scheduling/services`, `/api/scheduling/availability`,
  `/api/scheduling/appointments`.
- **CRM**: `/api/contacts/{update,delete,import}`, `/api/conversations/{send,status}`,
  `/api/quick-replies`, `/api/broadcasts`, `/api/leads/stage`, `/api/funnel/config`,
  `/api/coupons/validate`, `/api/tenant/settings`.
- **Cron**: `/api/cron/reminders` (protegido por `CRON_SECRET`, fallback
  `NEXTAUTH_SECRET`).
- **Admin**: `/api/admin/{activate,config,coupons,make-superadmin,migrate-schemas}`,
  `/api/admin/affiliates` (+ `/commissions`), `/api/admin/tenants/delete`.

### 6.3 Webhook WhatsApp — fluxo detalhado
Verifica assinatura HMAC-SHA256 (`META_APP_SECRET`, `timingSafeEqual`); resolve o
tenant por `phone_number_id`; resolve o contato por **BSUID > whatsapp_id > phone**
(evita duplicar quando o telefone é ocultado); atualiza nome/bsuid/phone; transcreve
áudio; grava a mensagem inbound; se for clique de botão `appt_*` chama
`handleAppointmentButton` (confirmar → status confirmed + e-mail confirmed; cancelar
→ cancelled + e-mail; remarcar → conversa pending); senão roteia: **Pro + bot_enabled**
→ `processBotResponse` + `extractContactInfo`; senão **menu_bot** → `processMenuBotResponse`.

### 6.4 Cron de lembretes — fluxo
`GET ?token=`: para cada tenant ativo/conectado, **expira** pré-reservas vencidas
(`pending_payment` + `hold_expires_at < now` → cancelled/expired); busca agendamentos
scheduled/confirmed nas próximas 24h ainda não lembrados; decide `day` (é hoje) vs
`before` (véspera); envia botões **Confirmar/Cancelar/Remarcar** por WhatsApp; marca
`day_reminder_sent`/`reminder_sent`; envia lembrete por e-mail também.

---

## 7. Integrações externas

### 7.1 Meta WhatsApp Cloud API (Graph v21.0)
- **Modelo 1 (Tech Provider):** caso de uso "Torne-se um Provedor de Tecnologia";
  **Login for Business** config (config_id); Embedded Signup com `response_type:'code'`
  + `override_default_response_type:true` + `extras.sessionInfoVersion:'3'`; o popup
  envia `waba_id`/`phone_number_id` via `postMessage` (`WA_EMBEDDED_SIGNUP`); backend
  troca `code`→token (client_id/secret; tentar variações de `redirect_uri` derivadas
  do host) **ou** usa fallback session-info + `META_SYSTEM_USER_TOKEN`; registra o
  número (`/register`, pin `000000`) e assina o app (`/subscribed_apps`). Requer
  **Business Verification** + **Advanced Access** + **App Review** (screencast).
- **Modelo 2 (número próprio):** `phone_number_id` + `access_token` (System User Token)
  + `waba_id`; register + subscribed_apps. Sem App Review.
- **Webhook:** GET `verify_token` (`META_WEBHOOK_VERIFY_TOKEN`); POST assinatura
  `x-hub-signature-256` com `META_APP_SECRET`.

### 7.2 Mercado Pago
- **PreApproval** (assinatura recorrente do SaaS): checkout transparente com Card
  Brick, `auto_recurring`, status `authorized`; `PreApproval.get({ id })`.
- **Payment (Pix)** para sinal com token do lojista; webhook único
  (`/api/webhooks/mercadopago`) roteando por `AppointmentPayment` e gerando comissão
  de afiliado no pagamento do SaaS.

### 7.3 Resend
Domínio `uprocrm.com.br` verificado (SPF/DKIM na Hostinger). Ver 5.5.

### 7.4 IA (Anthropic / Groq)
`AI_PROVIDER`; chat + tool-use (Anthropic) e transcrição (Groq Whisper).

---

## 8. Variáveis de ambiente (apenas nomes — nunca cole valores/segredos)

**Infra:** `DATABASE_URL`, `NODE_ENV`, `NEXT_PUBLIC_URL`
**Auth:** `NEXTAUTH_SECRET`, `CRON_SECRET`
**Cripto:** `ENCRYPTION_KEY` (32 bytes p/ AES-256-GCM)
**Meta/WhatsApp:** `META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`,
`META_SYSTEM_USER_TOKEN`, `NEXT_PUBLIC_META_APP_ID`, `NEXT_PUBLIC_META_CONFIG_ID`
**Mercado Pago:** `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `NEXT_PUBLIC_MP_PUBLIC_KEY`
**Stripe (opcional):** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`
**IA:** `AI_PROVIDER`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `GROQ_API_KEY`, `GROQ_MODEL`
**E-mail:** `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`

> **Segurança:** gere segredos novos por ambiente. Nunca ponha `NEXTAUTH_SECRET` em
> serviços de terceiros (use `CRON_SECRET` para crons externos). Rotacione
> `ENCRYPTION_KEY`, `NEXTAUTH_SECRET` e `META_APP_SECRET` antes de produção se já
> foram expostos. Token do WhatsApp expira em 60 dias — planejar refresh.

---

## 9. Estrutura de pastas

```
prisma/schema.prisma
scripts/boot-migrate.js, migrate-tenant-schemas.js
public/logo.svg
src/middleware.ts   # matcher exclui /api, _next e arquivos com extensão (.*\..*)
src/app/(public)/   signup, login, checkout, afiliados
src/app/(tenant)/   dashboard, conversations[/id], contacts, funnel, agenda,
                    broadcasts, settings, onboarding/connect-whatsapp, layout
src/app/{privacidade,termos,exclusao-de-dados}/
src/app/admin/, src/app/afiliado/, src/app/onboarding/
src/app/api/**      auth, webhooks{whatsapp,mercadopago,stripe}, whatsapp/connect,
                    billing, scheduling, contacts, conversations, quick-replies,
                    broadcasts, leads, funnel, coupons, tenant, cron, admin, health
src/lib/            prisma-tenant, provision-tenant, auth(.config), affiliate(-auth),
                    bot, ai, scheduling, pix, email, crypto, funnel, transcribe
src/components/      landing, legal(legal-shell), ui(kanban, conversations,
                    import-contacts, theme-toggle, sign-out, conversation-thread)
docs/MASTER_BUILD_PROMPT.md   # este arquivo
```

O `matcher` do middleware exclui arquivos estáticos
(`'/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'`) para não redirecionar
`/logo.svg` ao login; prefixos públicos incluem as páginas legais.

---

## 10. Deploy (Railway) e go-live

1. **Serviços:** Postgres + web (Next.js). `start` roda `boot-migrate.js` (migra todos
   os schemas, resiliente) e depois `next start`.
2. **Variáveis:** todas de §8 no serviço web.
3. **Domínio/DNS:** apontar `uprocrm.com.br`; Resend (SPF/DKIM); webhooks Meta e MP
   nas URLs de produção; cron de lembretes agendado (a cada ~15 min) com `CRON_SECRET`.
4. **Checklist Meta — SaaS (modelo 1):**
   - [ ] Business Verification aprovada
   - [ ] App em modo **Provedor de Tecnologia**
   - [ ] Login for Business config criado (config_id)
   - [ ] Advanced Access: `whatsapp_business_management`, `whatsapp_business_messaging`
   - [ ] App Review submetido com screencast do Embedded Signup ponta a ponta
   - [ ] App publicado (Live)
5. **Checklist número próprio (modelo 2):** System User Token + IDs do número;
   conectar pelo wizard de `/settings`. Não depende de App Review.
6. **Pós-deploy:** testar webhook (mensagem real chega no CRM), agendamento pelo bot
   com sinal Pix, e-mails created/confirmed/cancelled/reminder, e o cron.

---

## 11. Ordem sugerida de construção

1. Stack + Prisma + multi-tenancy (§2–4) + `prisma-tenant`/`provision-tenant`.
2. NextAuth + signup + provisionamento de tenant + páginas legais.
3. Webhook WhatsApp + envio + conexão manual (modelo 2) — já dá para operar.
4. IA (`ai.ts`) → menu bot → bot com IA + guardrails + extração de lead.
5. Agendamento (services/availability/slots, agenda dia/mês, editor por serviço).
6. Tool-use de agendamento no bot (verificar/agendar/reagendar).
7. Pix (sinal, pré-reserva, webhook MP) + e-mails (Resend) + cron de lembretes.
8. Funil Kanban (+ Pro: rótulos e motivos de perda) + afiliados + billing recorrente
   + cupons + admin.
9. Landing + hero animado + branding.
10. Embedded Signup (modelo 1) + App Review Meta + deploy Railway + go-live.

---

## 12. Changelog completo (por commit, mais recente primeiro)

Reflete tudo que foi desenvolvido. Datas em 2026.

**WhatsApp Embedded Signup (jul/05):** marker v4 na página de conexão; espera até 4s
pelo session-info antes do backend; fallback session-info + System User Token; idas e
vindas no fluxo OAuth (code vs token, variações de `redirect_uri` derivadas do host,
surfacing do erro/subcode da Meta); botão Desconectar + rota DELETE.

**Legais e branding (jul/04):** rodapé sem "Entrar", CNPJ em 2 linhas; página de
exclusão de dados + links no rodapé; middleware exclui assets estáticos; `logo.svg`
vetorial com `viewBox` (escala em `<img>`); wordmark UProCRM; páginas de Privacidade
e Termos; pasta `public/` para brand.

**Deploy resiliente (jul/02):** boot nunca derruba o app por falha de migração;
`bsuid` como índice (não `@unique`) para evitar falha de "data loss"; suporte a
**BSUID** (usernames).

**Agendamento — participante x responsável (jul/02):** `booked_by` explícito vs
participante, exibido na agenda e nos e-mails; campo de nome do participante na
reserva manual; agenda mostra o nome do participante (aluno/paciente), não só o
contato do WhatsApp; **reagendar cancela o agendamento anterior** (ferramenta
`reagendar`).

**Landing e funil (jul/01):** hero com borda sutil + feixe de luz girando a cada 10s;
funil Pro (renomear etapas + até 10 motivos de perda com seletor ao soltar em
Perdido).

**Agendamento — Pix, e-mails, config por serviço (jul/01):** sinal via Pix por serviço
(pré-reserva com prazo); e-mails de cancelamento e lembrete; auto-migração de todos os
schemas no start; e-mail configurável (`EMAIL_FROM_ADDRESS`); confirmação por e-mail
(Resend); **disponibilidade, gap e antecedência mínima por serviço**; editar serviços
inline (afetando só futuros); coletar e-mail na reserva; lembrete no dia + confirmação
anuncia os dois lembretes; antecedência mínima com seletor min/horas/dias; **calendário
do mês** + gap configurável; validação de reserva contra disponibilidade + dia da
semana correto.

**Agendamento — base (jun/29–30):** fases 1–3 (agenda manual → lembretes+confirmação →
agendamento por IA); cron aceita `CRON_SECRET`; modelos Service/Availability/Appointment.

**Admin e afiliados (jun/27):** deletar tenant/afiliado com type-to-confirm; persistir
`?ref` na landing até o signup; afiliados fases 1–4 (schema+atribuição+página pública →
geração de comissão no webhook → painel admin → login+dashboard do afiliado); seletor
de plano no checkout + preços dinâmicos; redesign do checkout 2 colunas; padronização
visual (brand blue, tokens light, sidebar lucide).

**Bot e IA (jun/26–27):** tags nas conversas/funil + filtros; toggles Pro (handoff
pause, keep-responding); saudação pede nome/e-mail no 1º contato; **provider de IA
plugável (Claude/Groq)**; qualificação ativa + extração estruturada; upgrades do bot
(takeover humano, anti-alucinação, handoff, memória, áudio); gate do bot IA ao Pro +
menu bot nos demais; helper admin de conexão manual de WhatsApp (+ set plan +
disconnect); link Admin na sidebar p/ superadmins; cancelamento de assinatura com
retenção + type-to-confirm.

**Billing / Mercado Pago (jun/24–26):** checkout transparente com Card Brick (sem
redirect); correções MP (init_point fallback, back_url, CPF, PreApproval.get,
try/catch, status authorized, mount único do Brick); onboarding + billing status +
webhook MP; assinatura dinâmica (`auto_recurring`, sem `MP_PLAN_ID`).

**Fundação (jun/24):** scaffold SaaS multi-tenant; correções de build (force-dynamic,
prisma v5, lazy-init de SDKs, generate antes do build); tema escuro + inbox
compartilhada + landing; **funil Kanban**; split do auth config + `trustHost` +
`auth()` no middleware; endpoint de ativação manual + seed de demo; `/api/health`;
sistema de cupons + config de preços + superadmin; rename WaCRM→UProCRM.

---

_Fim da especificação. Mantenha este arquivo versionado como a fonte da verdade do
produto e atualize-o a cada mudança estrutural._
