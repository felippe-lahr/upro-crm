# UProCRM — Diretrizes de design

Fonte única do visual e da usabilidade do app. Toda tela nova segue este documento.
Os valores de cor ficam em `src/app/globals.css` (tokens) e são expostos ao Tailwind em
`tailwind.config.ts`. Nunca use cor literal em componente: use os tokens abaixo.

## Princípios

1. **Mobile-first.** O app roda como PWA no celular. Desenhe a tela primeiro a ~390px e
   depois amplie para o desktop (`sm:`, `md:`). Nada rola na horizontal.
2. **Tema escuro é o padrão**, o claro é igualmente cuidado. Toda cor vem de token, então
   os dois temas funcionam sem código extra.
3. **Uma ação principal por tela.** Um botão azul forte; o resto é secundário (contorno ou neutro).
4. **Estado visível de relance.** Chips e selos mostram status (responsável, etiqueta,
   origem de anúncio, aprovação) sem precisar abrir nada.
5. **Texto do lado do usuário.** Nomeie as coisas como o lojista reconhece ("Adicionar
   atendente", não "criar TenantUser"). Erro explica o que houve e como resolver.

## Cores (tokens)

| Token Tailwind | Uso |
|---|---|
| `bg-background` | Fundo da página |
| `bg-surface` | Cards, listas, modais |
| `bg-surface2` | Áreas secundárias dentro de cards, hover, chips neutros |
| `border-line` | Bordas e divisórias |
| `text-fg` | Texto principal |
| `text-muted` | Texto secundário |
| `text-faint` | Legendas, datas, placeholders |
| `bg-brand` / `text-brand` / `bg-brand/15` | Ação principal, links, chips de etiqueta |
| `brand-600` | Hover do botão principal |

Cores semânticas (fora da marca): **âmbar** para aviso e origem de anúncio (📣),
**vermelho** para erro e ações destrutivas, **verde** para presença online / sucesso.

## Tipografia

- Fonte: **Poppins** (`font-sans`). Pesos: 400 texto, 600 rótulos e botões, 700–800 títulos.
- Escala: título de página `text-2xl font-bold`; título de card `text-[15px] font-semibold`;
  texto `text-sm`; legenda `text-xs`; selo `text-[11px] font-bold`.
- Números que se alinham (valores, contadores): `tabular-nums`.

## Forma e espaço

- Raio: cards e listas `rounded-2xl`; botões e campos `rounded-xl`; chips `rounded-full`;
  folha por baixo `rounded-t-3xl`.
- Respiro: página `p-4 sm:p-8`; card `p-3.5`–`p-4`; entre itens de lista `gap-2.5`.
- Alvo de toque mínimo **44px** de altura no celular (botões `py-3`/`py-3.5`).
- Use `gap` em flex/grid, não margens soltas entre irmãos.

## Componentes

- **Botão principal:** `bg-brand text-white rounded-xl font-semibold shadow-lg shadow-brand/25`,
  `hover:bg-brand-600`. No celular, largura total quando é a ação principal da tela.
- **Botão secundário:** `border border-line text-muted hover:bg-surface2`.
- **Destrutivo:** `bg-red-500 text-white`, sempre com confirmação **inline** (não `confirm()`).
- **Chip de etiqueta:** `rounded-full bg-brand/15 text-brand text-xs px-2 py-0.5`.
  Origem de anúncio usa âmbar com 📣.
- **Selo de papel/status:** `rounded-full text-[11px] font-bold` (Admin = marca; Atendente = neutro).
- **Avatar:** círculo com iniciais, cor derivada do e-mail (estável por pessoa).
- **Filtros:** chips roláveis na horizontal com contador; o ativo fica `bg-brand text-white`.
- **Folha por baixo (bottom sheet):** padrão para formulários no celular — sobe de baixo com
  alça, respeita `env(safe-area-inset-bottom)`; no desktop vira janela central (`sm:rounded-3xl`).
- **Menu ⋮:** ações de um item (redefinir, mudar papel, remover); remover sempre por último e em vermelho.
- **Aviso:** caixa `bg-brand/10 text-brand` (informação) ou âmbar (atenção), com texto curto.

## Padrões de interação

- Confirmações acontecem na própria tela (linha que expande no card), não em `alert/confirm`.
- Depois de uma ação, mostre o resultado em uma frase ("Acesso criado para Larissa.").
- Listas longas: filtro e busca no topo; estado vazio explica o que aparece ali e como começar.
- Drawer lateral no desktop, tela cheia/folha no celular.

## Checklist antes de subir uma tela

- [ ] Funciona a 390px sem rolagem horizontal; alvos de toque ≥ 44px.
- [ ] Só tokens de cor; conferido no tema escuro e no claro.
- [ ] Uma ação principal clara; destrutivo com confirmação inline.
- [ ] Textos no vocabulário do lojista; erros dizem como resolver.
- [ ] `npx tsc --noEmit` e `npx next lint` sem erros.
