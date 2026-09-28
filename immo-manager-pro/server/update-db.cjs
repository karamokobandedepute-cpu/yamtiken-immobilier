const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS password TEXT, ADD COLUMN IF NOT EXISTS "scoreRisque" FLOAT, ADD COLUMN IF NOT EXISTS "niveauRisque" TEXT;`);
    await client.query(`
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
    await client.end();
  }
}
run();
