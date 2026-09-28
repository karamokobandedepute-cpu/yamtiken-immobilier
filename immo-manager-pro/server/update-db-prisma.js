import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS password TEXT, ADD COLUMN IF NOT EXISTS "scoreRisque" FLOAT, ADD COLUMN IF NOT EXISTS "niveauRisque" TEXT;`);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS tickets_maintenance (
        id SERIAL PRIMARY KEY,
        titre TEXT NOT NULL,
        description TEXT NOT NULL,
        statut TEXT DEFAULT 'NOUVEAU',
        urgence TEXT DEFAULT 'NORMALE',
        "clientId" INTEGER REFERENCES clients(id),
        "bienId" INTEGER REFERENCES biens(id),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("DB updated successfully");
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}
run();
