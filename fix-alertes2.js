const fs = require('fs');
const file = 'immo-manager-pro/server/routes/alerte.routes.js';
let c = fs.readFileSync(file, 'utf8');

const correctQueries = `const [paiementsEcheance, bauxExpiration, relancesAujourdHui, totalNonLues] = await Promise.all([
      // Paiements Ã  Ã©chÃ©ance (aucun paiement dans les 30 derniers jours)
      prisma.lease.count({
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
      }),
      
      // Baux expirant dans <= 30 jours
      prisma.lease.count({
        where: {
          dateFin: {
            not: null,
            lte: thirtyDaysLater
          },
          statut: 'ACTIF',
          deletedAt: null,
          isDemo: false
        }
      }),
      
      // Relances visites prÃ©vues aujourd'hui
      prisma.visite.count({
        where: {
          relanceSouhait: true,
          dateRelance: {
            gte: new Date(today.setHours(0, 0, 0, 0)),
            lte: new Date(today.setHours(23, 59, 59, 999))
          },
          statutRelance: 'EN_ATTENTE',
          deletedAt: null,
          isDemo: false
        }
      }),
      
      // Total alertes non lues
      prisma.alerte.count({
        where: {
          estLue: false,
          estTraitee: false,
          deletedAt: null,
          isDemo: false
        }
      })
    ]);`;

c = c.replace(/const \[paiementsEcheance, bauxExpiration, relancesAujourdHui, totalNonLues\] = await Promise\.all\(\[[\s\S]*?\}\)\n    \]\);/, correctQueries);

fs.writeFileSync(file, c);
