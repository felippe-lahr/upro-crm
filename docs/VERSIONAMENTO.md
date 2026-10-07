# Versionamento do UProCRM

## Formato: `MAJOR.MINOR.PATCH` (versionamento semântico)

| Sobe | Quando | Exemplo |
|---|---|---|
| **PATCH** `1.0.x` | Só correções de bug, sem novidade para o usuário | token do WhatsApp, etiqueta errada, build quebrado |
| **MINOR** `1.x.0` | Funcionalidade nova que não quebra nada existente | Equipe, exportar CSV, tela de Diagnósticos |
| **MAJOR** `x.0.0` | Mudança grande ou incompatível | novo modelo de cobrança, migração que exige ação dos clientes, mudança de API |

Ao subir MINOR, o PATCH volta a 0 (`1.2.3` → `1.3.0`). Ao subir MAJOR, os dois voltam a 0.

Os commits já indicam o tipo: `fix:` → PATCH, `feat:` → MINOR. `docs:`, `style:`,
`chore:` e `perf:` normalmente não exigem versão sozinhos — entram na próxima.

## Onde a versão aparece

- `package.json` → campo `version` (fonte única).
- Exposta no build como `NEXT_PUBLIC_APP_VERSION` (`next.config.mjs`).
- Visível no rodapé da barra lateral do painel ("UProCRM v1.0.0") e no topo do admin.

## Como lançar uma versão

1. Durante o trabalho, anote cada mudança em `CHANGELOG.md` na seção **[Não lançado]**.
2. Ao lançar: renomeie **[Não lançado]** para **[x.y.z] — AAAA-MM-DD** e crie uma nova
   **[Não lançado]** vazia em cima.
3. Atualize `version` no `package.json`.
4. Commit: `chore: release vX.Y.Z`.
5. Tag: `git tag vX.Y.Z && git push origin vX.Y.Z`.

Para voltar a uma versão: `git checkout vX.Y.Z` mostra o código exato daquela versão.

## Relação com os outros documentos

- `docs/ROADMAP.md` → planejamento e decisões (o que vamos fazer e por quê).
- `CHANGELOG.md` → registro oficial do que foi lançado e quando.
- `docs/DESIGN.md` → diretrizes de interface.
