/**
 * Passo de migração no boot, resiliente: aplica o schema público e o dos tenants,
 * mas NUNCA derruba o app. Se algo falhar (ex.: mudança sinalizada como "data loss"),
 * registra um aviso claro e segue — o `next start` roda em seguida de qualquer forma.
 *
 * Regra de ouro: mudanças de schema devem ser ADITIVAS (colunas anuláveis, índices
 * normais). @unique/drop/troca de tipo são "data loss" e exigem tratamento manual.
 */
const { execSync } = require('child_process')

function run(label, cmd) {
  try {
    execSync(cmd, { stdio: 'inherit', env: process.env })
    return true
  } catch (e) {
    console.error(`\n[boot-migrate] ⚠️  ${label} falhou — seguindo o boot mesmo assim.`)
    console.error('[boot-migrate] O app vai subir, mas o schema pode estar desatualizado. Verifique a mudança de schema (evite @unique/drop/troca de tipo sem migração manual).')
    return false
  }
}

// 1) Schema público
run('prisma db push (schema público)', 'npx prisma db push')

// 2) Schemas dos tenants (o próprio script já é resiliente por tenant)
run('migração dos schemas de tenants', 'node scripts/migrate-tenant-schemas.js')

// Sempre sai com sucesso para não bloquear o `next start`.
process.exit(0)
