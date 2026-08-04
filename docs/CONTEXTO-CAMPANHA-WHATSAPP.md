# Contexto — UProCRM + WhatsApp Business API (para configurar campanha Click to WhatsApp)

> Documento de briefing autossuficiente. Cole numa conversa nova com o Claude
> para pedir ajuda **específica com a configuração de anúncios "Click to
> WhatsApp" (CTWA) no Gerenciador de Anúncios da Meta**, usando um número que
> já está na WhatsApp Business API. Não é sobre programação — é sobre a
> configuração no ecossistema Meta (Business Manager, WABA, conta de anúncios).

---

## 1. Quem é quem

- **UProCRM** — plataforma SaaS (CRM multicliente para WhatsApp) que opera como
  **Provedor de Tecnologia (Independent Tech Provider)** aprovado pela Meta.
  App já passou pelo **App Review** (permissões `whatsapp_business_messaging`,
  `whatsapp_business_management`, `public_profile` aprovadas).
- **Studio44** — o **Portfólio de Negócios (Meta Business)** do operador do
  UProCRM. **É o portfólio dono do app UProCRM.** É aqui que ficam hospedados os
  WABAs dos clientes (modelo de agência).
- **Cliente (ex.: Cinthia Claro Arquitetura)** — negócio final que usa o CRM.
  Tem (ou terá) seu próprio Portfólio de Negócios. Pode ter uma **conta de
  anúncios** própria.

## 2. Como o número foi conectado (importante)

- Os números dos clientes entram via **Embedded Signup** (fluxo oficial da Meta,
  botão "Conectar WhatsApp" no CRM). Isso cria/anexa um **WABA (WhatsApp Business
  Account) + número** na **Cloud API**, sob um Portfólio de Negócios.
- **Restrição conhecida:** no Embedded Signup **não é possível** selecionar a
  **Studio44** como portfólio do cliente, porque a Studio44 é a dona do app —
  a Meta bloqueia onboardar cliente no mesmo portfólio que possui o app. O WABA
  do cliente precisa morar em **outro** portfólio (o do próprio cliente, ou um
  novo).
- Para o operador gerenciar o WABA de um cliente, ele precisa ser **Admin
  (Pessoa)** do Portfólio de Negócios do cliente — vínculo de **Parceiro**
  (empresa-com-empresa) **não** basta para criar/gerenciar o WABA via Embedded
  Signup, só para compartilhar ativos já existentes.
- O número é **novo/dedicado**, migrado para a Cloud API (não usa o app comum do
  WhatsApp naquele aparelho). Verificação por SMS/ligação no ato da conexão.

## 3. O que já funciona hoje

- Mensagens recebidas no número **caem no CRM** (via webhook) e o **bot de IA
  responde** (planos Pro/Promaster com bot habilitado).
- Ou seja: qualquer conversa iniciada no WhatsApp (inclusive vinda de anúncio)
  já é atendida pelo bot e registrada no funil.

## 4. O objetivo AGORA (a ajuda que preciso)

Rodar anúncios **"Click to WhatsApp" (Clique para o WhatsApp)** no Gerenciador de
Anúncios da Meta, usando **este número que está na WhatsApp Business API**, de
forma que o clique abra uma conversa nesse número (e o bot atenda).

### Perguntas/dúvidas típicas a resolver com o Claude na outra conversa
1. Como garantir que a **conta de anúncios** e a **WABA/número** estejam no
   **mesmo Portfólio de Negócios** (ou corretamente compartilhados entre o
   portfólio da Studio44 e o do cliente)?
2. Passo a passo em **Configurações do Negócio → Contas → Contas do WhatsApp**
   para atribuir a WABA à conta de anúncios / ao usuário que vai criar o anúncio.
3. Qual **objetivo de campanha** e configuração de destino "WhatsApp" usar no
   Gerenciador de Anúncios para CTWA.
4. Se a WABA está hospedada na **Studio44** e a **conta de anúncios é do
   cliente** (ou vice-versa): como conectar os dois (parceria de ativos vs.
   admin de pessoa) sem quebrar a posse.
5. Requisitos/limitações da Meta para CTWA com número em Cloud API (ex.: número
   precisa estar aprovado, política de qualidade, janela de 24h, etc.).

## 5. Restrições e princípios a respeitar

- **Posse dos ativos:** idealmente o WABA e a conta de anúncios do cliente ficam
  sob o portfólio **do cliente**; a Studio44 gerencia via acesso. Para teste,
  hospedar sob a Studio44 é aceitável, mas planejar a transferência/compartilhamento.
- **Não** misturar isso com a base de código do CRM — a configuração é toda no
  **ecossistema Meta** (business.facebook.com + Gerenciador de Anúncios). Nenhum
  ajuste de código é necessário para o CTWA funcionar (o webhook já recebe as
  mensagens).
- Segurança: não expor tokens (WhatsApp/Meta) em prints ou URLs.

## 6. Oportunidade futura (opcional, do lado do CRM — NÃO é o foco agora)

As mensagens vindas de CTWA chegam no webhook com um campo **`referral`**
(identifica o anúncio: título, corpo, `source_url`, `ctwa_clid`). Hoje o UProCRM
**não** guarda isso. Evolução possível: taggear automaticamente no funil "veio do
anúncio X" para medir ROI. Mencionar apenas se a conversa derivar para o produto;
o foco imediato é **configurar a campanha na Meta**.

---

### Resumo em uma frase
Tenho um número na **WhatsApp Business API (Cloud API)**, conectado via UProCRM
(Tech Provider), com WABA hospedada no portfólio **Studio44**; quero rodar
anúncios **Click to WhatsApp** apontando para esse número e preciso acertar a
configuração de **Business Manager + conta de anúncios + WABA** na Meta.
