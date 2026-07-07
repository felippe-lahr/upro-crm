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

### 2. Disparo em massa (templates)
Envio de mensagens em massa via templates aprovados (respeitando janela de 24h e categorias). Depende de templates aprovados na WABA.

### 3. Billing anual em 12x
Pagamento anual parcelado (installment único vs assinatura recorrente). Decidir sem/com juros.

### 4. Refresh automático do token de 60 dias do WhatsApp
Rotina para renovar o token antes de expirar, evitando desconexão silenciosa.

## 🔒 Pós-aprovação (checklist de segurança)
- Apagar o usuário `analyst@uprocrm.com.br`
- Rotacionar `NEXTAUTH_SECRET`, `ENCRYPTION_KEY` e `META_APP_SECRET` no Railway (apareceram em URLs/prints)
- Trocar senhas de contas de teste

## 💡 Backlog / ideias
- Preview da foto de perfil atual do WhatsApp dentro de `/settings`
- Two-track: SaaS self-service (Tech Provider) + projetos customizados número próprio (já suportado, manter)
