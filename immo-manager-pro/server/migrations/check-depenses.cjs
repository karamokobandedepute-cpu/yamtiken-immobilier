// Script pour inspecter la table depenses en DB
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Vérifier si la table depenses existe
  try {
    const tableCheck = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'depenses'
      ORDER BY ordinal_position
    `;
    if (tableCheck.length === 0) {
      console.log('❌ Table "depenses" N\'EXISTE PAS en base de données');
    } else {
      console.log('✅ Table "depenses" trouvée avec les colonnes :');
      tableCheck.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'nullable'}`);
      });
    }
  } catch(e) {
    console.error('Erreur:', e.message);
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
