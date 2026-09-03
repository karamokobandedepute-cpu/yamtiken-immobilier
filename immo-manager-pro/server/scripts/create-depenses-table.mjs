// Script de création de la table depenses via Prisma $queryRaw
import prisma from '../lib/prisma.js';

async function createDepensesTable() {
  try {
    // Vérifier si la table existe
    const result = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'depenses'
      ORDER BY ordinal_position
    `;
    
    if (result.length > 0) {
      console.log('Table depenses existe avec colonnes:', result.map(r => r.column_name).join(', '));
      
      // Vérifier si created_by_id existe
      const hasCreatedBy = result.some(r => r.column_name === 'created_by_id');
      if (!hasCreatedBy) {
        console.log('Ajout de la colonne created_by_id...');
        // Obtenir un user existant pour la contrainte NOT NULL
        const user = await prisma.user.findFirst({ select: { id: true } });
        await prisma.$executeRawUnsafe(`
          ALTER TABLE depenses 
          ADD COLUMN IF NOT EXISTS created_by_id INTEGER REFERENCES users(id) DEFAULT ${user?.id || 1} NOT NULL
        `);
      }
    } else {
      // Créer la table depuis zéro
      const user = await prisma.user.findFirst({ select: { id: true } });
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS depenses (
          id SERIAL PRIMARY KEY,
          motif TEXT NOT NULL,
          categorie TEXT NOT NULL,
          montant FLOAT NOT NULL,
          date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          description TEXT,
          reference TEXT,
          created_by_id INTEGER NOT NULL REFERENCES users(id) DEFAULT ${user?.id || 1},
          lease_id INTEGER REFERENCES leases(id),
          deleted_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
    }

    // Ajouter les colonnes manquantes
    await prisma.$executeRawUnsafe(`ALTER TABLE depenses ADD COLUMN IF NOT EXISTS motif TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE depenses ADD COLUMN IF NOT EXISTS categorie TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE depenses ADD COLUMN IF NOT EXISTS montant FLOAT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE depenses ADD COLUMN IF NOT EXISTS date TIMESTAMPTZ DEFAULT NOW()`);
    await prisma.$executeRawUnsafe(`ALTER TABLE depenses ADD COLUMN IF NOT EXISTS description TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE depenses ADD COLUMN IF NOT EXISTS reference TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE depenses ADD COLUMN IF NOT EXISTS lease_id INTEGER`);
    await prisma.$executeRawUnsafe(`ALTER TABLE depenses ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`);
    await prisma.$executeRawUnsafe(`ALTER TABLE depenses ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`);
    await prisma.$executeRawUnsafe(`ALTER TABLE depenses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`);

    // Créer les index
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_depenses_categorie ON depenses(categorie)`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_depenses_date ON depenses(date)`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_depenses_deleted_at ON depenses(deleted_at)`);
    
    // Vérification finale
    const final = await prisma.$queryRaw`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'depenses' ORDER BY ordinal_position
    `;
    console.log('✅ Table depenses prête avec colonnes:', final.map(r => r.column_name).join(', '));
    
  } catch (e) {
    console.error('❌ Erreur:', e.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

createDepensesTable();
