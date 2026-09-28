const fs = require('fs');
const file = 'immo-manager-pro/server/routes/alerte.routes.js';
let c = fs.readFileSync(file, 'utf8');

c = c.replace(/prisma.payment.count\(\{[\s\S]*?lte: sevenDaysLater\s*\}\s*\}\s*\}\)/, prisma.lease.count({
        where: {
          statut: 'ACTIF',
          deletedAt: null,
          isDemo: false,
          payments: {
            none: {
              datePaiement: {
                gte: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
              },
              deletedAt: null,
              isDemo: false
            }
          }
        }
      }));

c = c.replace(/bauxExpiration:[\s\S]*?prisma.lease.count\(\{[\s\S]*?statut: 'ACTIF'\s*\}/, auxExpiration: prisma.lease.count({
        where: {
          dateFin: { not: null, lte: thirtyDaysLater },
          statut: 'ACTIF', deletedAt: null, isDemo: false
        });
// Wait, regex might fail. I will use simple replace for the whole array.
