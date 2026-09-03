import prisma from '../lib/prisma.js';

const indexes = [
  `CREATE INDEX IF NOT EXISTS idx_client_type    ON clients("type")`,
  `CREATE INDEX IF NOT EXISTS idx_client_created ON clients("createdAt" DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_client_nom     ON clients("nom")`,
  `CREATE INDEX IF NOT EXISTS idx_bien_statut    ON biens("statut")`,
  `CREATE INDEX IF NOT EXISTS idx_bien_type      ON biens("type")`,
  `CREATE INDEX IF NOT EXISTS idx_bien_created   ON biens("createdAt" DESC)`,
];

async function run() {
  console.log('Ajout des index de performance...');
  for (const sql of indexes) {
    try {
      await prisma.$executeRawUnsafe(sql);
      const name = sql.match(/idx_\w+/)?.[0];
      console.log(`  ✅ ${name}`);
    } catch (e) {
      console.error(`  ❌ Erreur: ${e.message}`);
    }
  }
  await prisma.$disconnect();
  console.log('Terminé.');
}

run();
