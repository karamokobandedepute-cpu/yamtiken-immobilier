// Test final complet après corrections
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const results = [];
  
  const test = async (label, fn) => {
    try {
      const r = await fn();
      results.push(`✅ ${label}`);
    } catch(e) {
      results.push(`❌ ${label} → ${e.message.slice(0, 120)}`);
    }
  };

  await test('prisma.depense.count()', () => prisma.depense.count());
  await test('prisma.relance.count()', () => prisma.relance.count());
  await test('prisma.alerte.count()', () => prisma.alerte.count());
  await test('prisma.lease.count({ isDemo })', () => prisma.lease.count({ where: { isDemo: true } }));
  await test('prisma.payment.count({ isDemo })', () => prisma.payment.count({ where: { isDemo: true } }));
  await test('prisma.building.findFirst()', () => prisma.building.findFirst());
  await test('prisma.unite.count()', () => prisma.unite.count());
  await test('prisma.client.count()', () => prisma.client.count());
  await test('prisma.depense.findMany(limit 1)', () => prisma.depense.findMany({ take: 1 }));
  await test('getBuildingsStats SQL', () => prisma.$queryRaw`
    SELECT COUNT(*) as total FROM public.buildings WHERE "deletedAt" IS NULL
  `);
  await test('getClientStats SQL', () => prisma.$queryRaw`
    SELECT COUNT(*) as total FROM public.clients
  `);
  await test('numeroPorte TRIM check', () => prisma.$queryRaw`
    SELECT COUNT(*) as espaces FROM public.unites WHERE "numeroPorte" != TRIM("numeroPorte")
  `);

  console.log('\n=== RÉSULTAT FINAL ===');
  results.forEach(r => console.log(r));
  
  const errors = results.filter(r => r.startsWith('❌'));
  if (errors.length === 0) {
    console.log('\n🎉 TOUT EST OPÉRATIONNEL ! Vous pouvez démarrer le serveur.');
  } else {
    console.log(`\n⚠️  ${errors.length} problème(s) restant(s).`);
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
