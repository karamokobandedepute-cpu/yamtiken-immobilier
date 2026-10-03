import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

// Configuration du dossier de sauvegarde : un dossier "sauvegardes" dans le projet immo-manager-pro
const getBackupDir = () => {
  const dir = path.join(process.cwd(), 'sauvegardes');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

// Exporter TOUTE la base
export const exportFullDatabase = async () => {
  const users = await prisma.user.findMany();
  const clients = await prisma.client.findMany();
  const referrers = await prisma.referrer.findMany();
  const buildings = await prisma.building.findMany();
  const unites = await prisma.unite.findMany();
  const biens = await prisma.bien.findMany();
  const leases = await prisma.lease.findMany();
  const payments = await prisma.payment.findMany();
  const commissions = await prisma.commission.findMany();
  const visites = await prisma.visite.findMany();
  const documents = await prisma.document.findMany();

  return {
    version: '1.0',
    date: new Date().toISOString(),
    data: { users, clients, referrers, buildings, unites, biens, leases, payments, commissions, visites, documents }
  };
};

// Restaurer TOUTE la base
export const restoreFullDatabase = async (backupData) => {
  if (!backupData || !backupData.data) throw new Error('Format de sauvegarde invalide');
  const { users = [], clients = [], referrers = [], buildings = [], unites = [], biens = [], leases = [], payments = [], commissions = [], visites = [], documents = [] } = backupData.data;

  await prisma.$transaction(async (tx) => {
    await tx.document.deleteMany({});
    await tx.visite.deleteMany({});
    await tx.commission.deleteMany({});
    await tx.payment.deleteMany({});
    await tx.lease.deleteMany({});
    await tx.unite.deleteMany({});
    await tx.building.deleteMany({});
    await tx.bien.deleteMany({});
    await tx.referrer.deleteMany({});
    await tx.client.deleteMany({});

    if (users.length > 0) {
      for (const u of users) {
        await tx.user.upsert({ where: { id: u.id }, create: u, update: u });
      }
    }

    if (clients.length > 0) await tx.client.createMany({ data: clients });
    if (referrers.length > 0) await tx.referrer.createMany({ data: referrers });
    if (buildings.length > 0) await tx.building.createMany({ data: buildings });
    if (unites.length > 0) await tx.unite.createMany({ data: unites });
    if (biens.length > 0) await tx.bien.createMany({ data: biens });
    if (leases.length > 0) await tx.lease.createMany({ data: leases });
    if (payments.length > 0) await tx.payment.createMany({ data: payments });
    if (commissions.length > 0) await tx.commission.createMany({ data: commissions });
    if (visites.length > 0) await tx.visite.createMany({ data: visites });
    if (documents.length > 0) await tx.document.createMany({ data: documents });
  });

  return { success: true, message: "Restauration réussie !" };
};

// Exécuter la sauvegarde automatique locale (et garder 3 jours)
export const runDailyBackup = async () => {
  try {
    const backupDir = getBackupDir();
    const dateStr = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const backupPath = path.join(backupDir, `backup_${dateStr}.json`);

    const data = await exportFullDatabase();
    fs.writeFileSync(backupPath, JSON.stringify(data, null, 2));
    console.log('âœ… Sauvegarde créée :', backupPath);

    // Nettoyer pour ne garder que les 3 dernières sauvegardes
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('backup_') && f.endsWith('.json'))
      .map(f => ({ name: f, time: fs.statSync(path.join(backupDir, f)).mtime.getTime() }))
      .sort((a, b) => b.time - a.time);

    if (files.length > 3) {
      const filesToDelete = files.slice(3);
      for (const f of filesToDelete) {
        fs.unlinkSync(path.join(backupDir, f.name));
        console.log('ðŸ—‘ï¸  Ancienne sauvegarde supprimée :', f.name);
      }
    }
  } catch (error) {
    console.error('â Œ Erreur lors de la sauvegarde automatique :', error);
  }
};

// Obtenir la liste des sauvegardes locales
export const getLocalBackups = () => {
  const backupDir = getBackupDir();
  return fs.readdirSync(backupDir)
    .filter(f => f.startsWith('backup_') && f.endsWith('.json'))
    .map(f => {
      const stat = fs.statSync(path.join(backupDir, f));
      return {
        filename: f,
        date: stat.mtime,
        size: (stat.size / 1024 / 1024).toFixed(2) + ' MB'
      };
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));
};

// Restaurer depuis un fichier local
export const restoreFromLocalBackup = async (filename) => {
  const backupPath = path.join(getBackupDir(), filename);
  if (!fs.existsSync(backupPath)) throw new Error("Le fichier n'existe pas");
  
  const content = fs.readFileSync(backupPath, 'utf8');
  const backupData = JSON.parse(content);
  return await restoreFullDatabase(backupData);
};
