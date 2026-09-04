// Nettoie les espaces parasites dans les numéros de porte
// SAFE : utilise TRIM() SQL, aucune donnée supprimée
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Vérification des numéros de porte avec espaces parasites...');
  
  // Lister les unités avec espaces avant/après
  const unites = await prisma.$queryRaw`
    SELECT id, "numeroPorte" FROM public.unites 
    WHERE "numeroPorte" != TRIM("numeroPorte")
    ORDER BY id
  `;
  
  if (unites.length === 0) {
    console.log('✅ Aucun espace parasite trouvé. Rien à faire.');
    return;
  }
  
  console.log(`📋 ${unites.length} unité(s) avec espaces parasites :`);
  unites.forEach(u => console.log(`   ID ${u.id}: "${u.numeroPorte}" → "${u.numeroPorte.trim()}"`));
  
  // Appliquer TRIM sur tous
  const result = await prisma.$executeRaw`
    UPDATE public.unites 
    SET "numeroPorte" = TRIM("numeroPorte")
    WHERE "numeroPorte" != TRIM("numeroPorte")
  `;
  
  console.log(`\n✅ ${result} unité(s) nettoyée(s) avec succès.`);
  
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('❌ Erreur:', e.message);
  await prisma.$disconnect();
});
