import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function clean() {
  console.log('Suppression des donnees...');
  try {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "clients", "referrers", "commissions", "leases", "payments", "factures", "biens", "contrats", "paiements", "visites", "alertes", "notifications", "documents", "relances", "buildings", "unites", "audit_logs", "depenses", "tickets_maintenance" CASCADE;');
    console.log('Nettoyage termine avec succes ! Toutes les donnees de demo sont supprimees.');
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
clean();
