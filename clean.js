const { PrismaClient } = require('./immo-manager-pro/server/node_modules/@prisma/client');
const prisma = new PrismaClient();
async function cleanup() {
  console.log('Demarrage...');
  const models = ['payment', 'lease', 'unite', 'building', 'client', 'facture', 'paiement', 'visite', 'commission', 'bien', 'referrer', 'user', 'alerte', 'notification', 'document', 'relance', 'auditLog', 'depense', 'contrat'];
  let total = 0;
  for (const m of models) {
    if (prisma[m]) {
      try {
        const res = await prisma[m].deleteMany({ where: { isDemo: true } });
        if (res.count > 0) { console.log(m + ': ' + res.count); total += res.count; }
      } catch(e) {}
    }
  }
  console.log('Total: ' + total);
  await prisma.$disconnect();
}
cleanup();
