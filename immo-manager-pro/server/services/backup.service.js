import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

export const runDailyBackup = async () => {
  try {
    const backupDir = path.join(process.cwd(), '..', '..', 'sauvegardes_automatiques');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const dateStr = new Date().toISOString().split('T')[0];
    const backupPath = path.join(backupDir, `backup_${dateStr}.json`);

    const clients = await prisma.client.findMany();
    const leases = await prisma.lease.findMany();
    const payments = await prisma.payment.findMany();
    const biens = await prisma.bien.findMany();

    const data = {
      date: new Date().toISOString(),
      clients,
      leases,
      payments,
      biens
    };

    fs.writeFileSync(backupPath, JSON.stringify(data, null, 2));
    console.log('✅ Sauvegarde automatique locale reussie dans :', backupPath);
  } catch (error) {
    console.error('❌ Erreur lors de la sauvegarde :', error);
  }
};
