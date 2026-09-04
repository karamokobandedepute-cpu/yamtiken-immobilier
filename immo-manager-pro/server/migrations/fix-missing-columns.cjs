const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🔧 Application des migrations manquantes...');
    
    // Ajouter is_demo sur leases si manquante
    await prisma.$executeRawUnsafe(`ALTER TABLE leases ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false`);
    console.log('✅ Colonne is_demo ajoutee sur la table leases');
    
    // Ajouter is_demo sur payments si manquante  
    await prisma.$executeRawUnsafe(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false`);
    console.log('✅ Colonne is_demo ajoutee sur la table payments');

    console.log('🎉 Migration terminee avec succes !');
  } catch(e) {
    console.error('❌ Erreur migration:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
