const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tables = ['relances', 'alertes', 'notifications'];
  
  for (const table of tables) {
    const cols = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${table}
      ORDER BY ordinal_position
    `;
    if (cols.length === 0) {
      console.log(`❌ Table "${table}" n'existe pas`);
    } else {
      console.log(`\n✅ Table "${table}" (${cols.length} colonnes):`);
      cols.forEach(c => console.log(`   ${c.column_name}: ${c.data_type}`));
    }
  }
  
  await prisma.$disconnect();
}
main().catch(console.error);
