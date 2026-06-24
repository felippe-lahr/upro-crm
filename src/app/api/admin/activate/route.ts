export const dynamic = 'force-dynamic'

import { globalPrisma, getTenantPrisma } from '@/lib/prisma-tenant'

/**
 * Endpoint de ativação manual para testes (bypass de pagamento).
 * Uso: /api/admin/activate?token=<NEXTAUTH_SECRET>&email=<email-do-tenant>
 *
 * Ativa o tenant, provisiona o schema dedicado e popula com dados de demo.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  const email = url.searchParams.get('email')

  if (!token || token !== process.env.NEXTAUTH_SECRET) {
    return Response.json({ error: 'Token inválido' }, { status: 401 })
  }
  if (!email) {
    return Response.json({ error: 'Informe ?email=' }, { status: 400 })
  }

  const tenant = await globalPrisma.tenant.findUnique({ where: { email } })
  if (!tenant) {
    return Response.json({ error: 'Tenant não encontrado para esse email' }, { status: 404 })
  }

  const schemaName = tenant.schema_name
  const steps: Record<string, unknown> = { schemaName }

  // 1. Criar schema + tabelas do tenant
  try {
    await globalPrisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`)
    const { execSync } = await import('child_process')
    execSync('npx prisma db push --skip-generate --accept-data-loss', {
      env: {
        ...process.env,
        DATABASE_URL: `${process.env.DATABASE_URL}?schema=${schemaName}`
      },
      cwd: process.cwd(),
      stdio: 'pipe'
    })
    steps.schema = 'ok'
  } catch (error) {
    steps.schemaError = error instanceof Error ? error.message : String(error)
  }

  // 2. Ativar tenant
  await globalPrisma.tenant.update({
    where: { id: tenant.id },
    data: {
      status: 'active',
      plan: 'basic',
      trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  })
  steps.activated = true

  // 3. Popular com dados de demonstração
  if (steps.schema === 'ok') {
    try {
      const db = getTenantPrisma(schemaName)

      const existing = await db.contact.count()
      if (existing === 0) {
        await seedDemoData(db)
        steps.seeded = 'ok'
      } else {
        steps.seeded = 'já existiam dados'
      }
    } catch (error) {
      steps.seedError = error instanceof Error ? error.message : String(error)
    }
  }

  return Response.json({
    ok: true,
    message: 'Tenant ativado. Faça login para acessar o CRM.',
    loginUrl: `${process.env.NEXT_PUBLIC_URL}/login`,
    ...steps
  })
}

async function seedDemoData(db: any) {
  const now = Date.now()
  const demo = [
    {
      phone: '5511988887777',
      name: 'Maria Oliveira',
      messages: [
        { dir: 'inbound', text: 'Oi! Vi o anúncio de vocês, queria saber mais sobre os planos.', mins: 120 },
        { dir: 'outbound', text: 'Olá Maria! Claro 😊 Temos o plano Básico por R$97/mês com bot de IA incluso. Quer que eu te explique?', mins: 118, bot: true },
        { dir: 'inbound', text: 'Quero sim! O bot responde sozinho?', mins: 115 },
        { dir: 'outbound', text: 'Sim! Ele atende seus clientes 24/7 com o tom da sua marca. Você só configura uma vez.', mins: 113, bot: true }
      ]
    },
    {
      phone: '5521977776666',
      name: 'João Santos',
      messages: [
        { dir: 'inbound', text: 'Bom dia, vocês fazem integração com meu número atual?', mins: 60 },
        { dir: 'outbound', text: 'Bom dia João! Fazemos sim, pela API oficial da Meta. Conexão em 2 minutos, sem risco de ban.', mins: 58, bot: true },
        { dir: 'inbound', text: 'Perfeito, vou testar.', mins: 55 }
      ]
    },
    {
      phone: '5531966665555',
      name: 'Ana Costa',
      messages: [
        { dir: 'inbound', text: 'Qual o prazo do teste grátis?', mins: 20 },
        { dir: 'outbound', text: 'São 7 dias grátis, sem precisar cadastrar cartão 🎉', mins: 18, bot: true }
      ]
    }
  ]

  for (const c of demo) {
    const contact = await db.contact.create({
      data: {
        whatsapp_id: c.phone,
        phone: c.phone,
        name: c.name
      }
    })

    const conversation = await db.conversation.create({
      data: { contact_id: contact.id, status: 'open' }
    })

    for (const m of c.messages) {
      await db.message.create({
        data: {
          contact_id: contact.id,
          conversation_id: conversation.id,
          direction: m.dir,
          type: 'text',
          content: m.text,
          sent_by_bot: !!m.bot,
          timestamp: new Date(now - m.mins * 60 * 1000)
        }
      })
    }
  }
}
