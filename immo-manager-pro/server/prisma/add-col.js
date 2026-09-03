import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function addColumn() {
  try {
    console.log('Adding date_entree column to leases table...');
    await prisma.$executeRawUnsafe(`ALTER TABLE leases ADD COLUMN IF NOT EXISTS "dateEntree" timestamp(3) without time zone;`);
    console.log('Column added successfully.');
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('Column already exists, ignoring.');
    } else {
      console.error('Error adding column:', error);
      process.exit(1);
    }
  } finally {
    await prisma.$disconnect();
  }
}

addColumn();
