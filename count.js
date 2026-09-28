const { PrismaClient } = require('./immo-manager-pro/server/node_modules/@prisma/client');
const prisma = new PrismaClient();
async function count() {
  console.log('Clients:', await prisma.client.count());
  console.log('Leases:', await prisma.lease.count());
  console.log('Payments:', await prisma.payment.count());
  await prisma.$disconnect();
}
count();
