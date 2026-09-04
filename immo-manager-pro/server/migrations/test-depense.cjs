const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  console.log('prisma.depense type:', typeof p.depense);
  if (p.depense) {
    try {
      const count = await p.depense.count();
      console.log('✅ prisma.depense.count() =', count);
    } catch(e) {
      console.log('❌ Erreur depense.count:', e.message.slice(0, 200));
    }
  } else {
    console.log('❌ prisma.depense est undefined');
  }
  await p.$disconnect();
}
main();
