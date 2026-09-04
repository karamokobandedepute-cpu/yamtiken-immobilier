const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const results = [];
  
  const test = async (label, fn) => {
    try {
      const r = await fn();
      results.push(`✅ ${label}: OK (${JSON.stringify(r)})`);
    } catch(e) {
      results.push(`❌ ${label}: ERREUR → ${e.message.slice(0, 150)}`);
    }
  };

  // Models DB
  await test('contrat.count', () => prisma.contrat.count());
  await test('lease.count isDemo', () => prisma.lease.count({ where: { isDemo: true } }));
  await test('payment.count isDemo', () => prisma.payment.count({ where: { isDemo: true } }));
  await test('client.count isDemo', () => prisma.client.count({ where: { isDemo: true } }));
  await test('building.count isDemo', () => prisma.building.count({ where: { isDemo: true } }));
  await test('unite.count isDemo', () => prisma.unite.count({ where: { isDemo: true } }));
  await test('relance.count', () => prisma.relance.count());
  await test('visite.count isDemo', () => prisma.visite.count({ where: { isDemo: true } }));
  await test('commission.count isDemo', () => prisma.commission.count({ where: { isDemo: true } }));
  await test('bien.count', () => prisma.bien.count());
  await test('facture.count', () => prisma.facture.count());
  await test('alerte.count', () => prisma.alerte.count());
  await test('depense.count', () => prisma.depense.count());
  await test('referrer.count isDemo', () => prisma.referrer.count({ where: { isDemo: true } }));
  await test('building stats overview', () => prisma.building.findFirst({ include: { unites: true } }));
  await test('lease.aggregate montantInitial', () => prisma.lease.aggregate({ _sum: { montantInitial: true }, where: { statut: 'ACTIF' } }));
  await test('clients/stats groupBy', () => prisma.client.groupBy({ by: ['type'], _count: true }));
  await test('contrats stats groupBy statut', () => prisma.contrat.groupBy({ by: ['statut'], _count: { statut: true } }));

  results.forEach(r => console.log(r));
  await prisma.$disconnect();
}

main().catch(console.error);
