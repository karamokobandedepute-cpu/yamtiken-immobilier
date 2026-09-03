import express from 'express';
import prisma from '../lib/prisma.js';
import { verifyToken, readOnlyDirection, isAdmin } from '../middlewares/auth.middleware.js';
import { getOrCompute, CACHE_KEYS, invalidateDashboard, getCacheStats } from '../lib/cache.js';
import logger from '../lib/logger.js';

const router = express.Router();


// ============================================
// DASHBOARD DIRECTION - 8 KPI CARDS
// ============================================

// GET /api/dashboard/kpi - 8 indicateurs clés
router.get('/kpi', verifyToken, readOnlyDirection, async (req, res) => {
  try {
    const data = await getOrCompute(CACHE_KEYS.DASHBOARD_KPI, async () => {
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const startOfYear = new Date(today.getFullYear(), 0, 1);

      const [
        revenusMois,
        revenusAnnee,
        creances,
        occupationStats,
        prevision30j,
        nouveauxClients,
        soldeCaisse,
        bauxExpirant
      ] = await Promise.all([
        prisma.payment.aggregate({
          where: { datePaiement: { gte: startOfMonth } },
          _sum: { montantVerse: true }
        }),
        prisma.payment.aggregate({
          where: { datePaiement: { gte: startOfYear } },
          _sum: { montantVerse: true }
        }),
        prisma.lease.aggregate({
          where: { statut: 'ACTIF' },
          _sum: { montantInitial: true }
        }).then(async (result) => {
          const totalDu = result._sum.montantInitial || 0;
          const totalPaye = await prisma.payment.aggregate({
            where: { lease: { statut: 'ACTIF' } },
            _sum: { montantVerse: true }
          });
          return totalDu - (totalPaye._sum.montantVerse || 0);
        }),
        Promise.all([
          prisma.lease.count({ where: { statut: 'ACTIF' } }),
          prisma.unite.count()
        ]).then(([actives, total]) => ({
          taux: total > 0 ? ((actives / total) * 100).toFixed(1) : 0,
          actives,
          total
        })),
        prisma.lease.aggregate({
          where: { statut: 'ACTIF', dateDebut: { lte: today } },
          _sum: { montantInitial: true }
        }).then((result) => (result._sum.montantInitial || 0) / 12),
        prisma.client.count({
          where: { createdAt: { gte: startOfMonth } }
        }),
        prisma.payment.aggregate({
          _sum: { montantVerse: true }
        }).then(async (encaissements) => {
          const commissionsPayees = await prisma.commission.aggregate({
            where: { statut: 'PAYEE' },
            _sum: { montant: true }
          });
          return (encaissements._sum.montantVerse || 0) - (commissionsPayees._sum.montant || 0);
        }),
        prisma.lease.count({
          where: {
            statut: 'ACTIF',
            dateFin: {
              gte: startOfMonth,
              lte: new Date(today.getFullYear(), today.getMonth() + 1, 0)
            }
          }
        })
      ]);

      return {
        revenusMois: revenusMois._sum.montantVerse || 0,
        revenusAnnee: revenusAnnee._sum.montantVerse || 0,
        creancesTotales: creances,
        tauxOccupation: parseFloat(occupationStats.taux),
        unitesOccupees: occupationStats.actives,
        unitesTotal: occupationStats.total,
        prevision30j,
        nouveauxClients,
        soldeCaisse,
        bauxExpirant
      };
    }, 180); // Cache 3 minutes

    res.json(data);
  } catch (error) {
    logger.error('[GET /dashboard/kpi]', { error: error.message });
    res.json({ revenusMois: 0, revenusAnnee: 0, creances: 0, tauxOccupation: 0, prevision30j: 0, nouveauxClients: 0, soldeCaisse: 0, bauxExpirant: 0 });
  }
});

// GET /api/dashboard/revenus-courbe - Données pour courbe 12 mois
router.get('/revenus-courbe', verifyToken, readOnlyDirection, async (req, res) => {
  try {
    const data = await getOrCompute(CACHE_KEYS.DASHBOARD_REVENUS, async () => {
      const aujourdhui = new Date();
      // Paralléliser les 12 requêtes au lieu de les faire séquentiellement
      const revenus = await Promise.all(
        Array.from({ length: 12 }, (_, idx) => {
          const i = 11 - idx;
          const mois = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth() - i, 1);
          const moisFin = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth() - i + 1, 0);
          return prisma.payment.aggregate({
            where: { datePaiement: { gte: mois, lte: moisFin } },
            _sum: { montantVerse: true }
          }).then(result => ({
            mois: mois.toLocaleString('fr-FR', { month: 'short' }),
            montant: result._sum.montantVerse || 0
          }));
        })
      );
      return revenus;
    }, 300); // Cache 5 minutes

    res.json(data);
  } catch (error) {
    logger.error('[GET /dashboard/revenus-courbe]', { error: error.message });
    res.json([]);
  }
});

// GET /api/dashboard/occupation-par-type - Données camembert
router.get('/occupation-par-type', verifyToken, readOnlyDirection, async (req, res) => {
  try {
    const data = await getOrCompute(CACHE_KEYS.DASHBOARD_OCCUPATION, async () => {
      const unites = await prisma.unite.findMany({
        select: { typeUnite: true, statut: true }
      });
      const grouped = {};
      unites.forEach(u => {
        if (!grouped[u.typeUnite]) {
          grouped[u.typeUnite] = { total: 0, occupees: 0 };
        }
        grouped[u.typeUnite].total += 1;
        if (u.statut === 'OCCUPE') {
          grouped[u.typeUnite].occupees += 1;
        }
      });
      return Object.entries(grouped).map(([type, stats]) => ({
        type,
        total: stats.total,
        occupees: stats.occupees,
        disponibles: stats.total - stats.occupees
      }));
    }, 300);

    res.json(data);
  } catch (error) {
    logger.error('[GET /dashboard/occupation-par-type]', { error: error.message });
    res.json([]);
  }
});

// GET /api/dashboard/revenus-par-immeuble - Données barres
router.get('/revenus-par-immeuble', verifyToken, readOnlyDirection, async (req, res) => {
  try {
    const data = await getOrCompute(CACHE_KEYS.DASHBOARD_REVENUS_IMMEUBLE, async () => {
      // Utiliser la relation Lease ↔ Building maintenant disponible
      const buildings = await prisma.building.findMany({
        select: {
          id: true,
          nom: true,
          leases: {
            select: {
              payments: {
                select: { montantVerse: true }
              }
            }
          }
        }
      });

      return buildings.map(b => ({
        nom: b.nom,
        revenus: b.leases.reduce((sum, l) =>
          sum + l.payments.reduce((s, p) => s + (p.montantVerse || 0), 0), 0)
      })).sort((a, b) => b.revenus - a.revenus);
    }, 300);

    res.json(data);
  } catch (error) {
    logger.error('[GET /dashboard/revenus-par-immeuble]', { error: error.message });
    res.json([]);
  }
});

// ============================================
// DONNÉES POUR RAPPORTS PDF
// ============================================

// GET /api/dashboard/rapport-mensuel - Données rapport PDF mensuel
router.get('/rapport-mensuel', verifyToken, readOnlyDirection, async (req, res) => {
  try {
    const { mois, annee } = req.query;
    const targetMonth = parseInt(mois) || new Date().getMonth();
    const targetYear = parseInt(annee) || new Date().getFullYear();
    
    const startOfMonth = new Date(targetYear, targetMonth, 1);
    const endOfMonth = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);
    const startOfYear = new Date(targetYear, 0, 1);

    const [
      entrees,
      nouveauxClients,
      clientsActifs,
      clientsPartis,
      soldeCaisse,
      revenusParJour
    ] = await Promise.all([
      // Entrées (paiements)
      prisma.payment.aggregate({
        where: {
          datePaiement: { gte: startOfMonth, lte: endOfMonth }
        },
        _sum: { montantVerse: true }
      }),

      // Nouveaux clients
      prisma.client.count({
        where: { createdAt: { gte: startOfMonth, lte: endOfMonth } }
      }),

      // Clients actifs (avec bail en cours)
      prisma.client.count({
        where: {
          leases: {
            some: {
              statut: 'ACTIF',
              dateDebut: { lte: endOfMonth }
            }
          }
        }
      }),

      // Clients partis (baux terminés ce mois)
      prisma.lease.count({
        where: {
          statut: 'TERMINE',
          dateFin: { gte: startOfMonth, lte: endOfMonth }
        }
      }),

      // Solde de caisse
      prisma.payment.aggregate({
        where: { datePaiement: { lte: endOfMonth } },
        _sum: { montantVerse: true }
      }).then(async (total) => {
        const commissions = await prisma.commission.aggregate({
          where: { 
            statut: 'PAYEE',
            datePaiement: { lte: endOfMonth }
          },
          _sum: { montant: true }
        });
        return (total._sum.montantVerse || 0) - (commissions._sum.montant || 0);
      }),

      // Revenus par jour pour graphique
      prisma.payment.findMany({
        where: {
          datePaiement: { gte: startOfMonth, lte: endOfMonth }
        },
        select: {
          datePaiement: true,
          montantVerse: true
        }
      })
    ]);

    // Grouper les revenus par jour
    const revenusParJourGroupe = {};
    revenusParJour.forEach(p => {
      const jour = new Date(p.datePaiement).getDate();
      revenusParJourGroupe[jour] = (revenusParJourGroupe[jour] || 0) + p.montantVerse;
    });

    res.json({
      periode: `${startOfMonth.toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}`,
      entrees: entrees._sum.montantVerse || 0,
      nouveauxClients,
      clientsActifs,
      clientsPartis,
      soldeCaisse,
      revenusParJour: Object.entries(revenusParJourGroupe).map(([jour, montant]) => ({
        jour: parseInt(jour),
        montant
      }))
    });
  } catch (error) {
    logger.error('[GET /dashboard/rapport-mensuel]', { error: error.message });
    res.json({ periode: '', entrees: 0, nouveauxClients: 0, clientsActifs: 0, clientsPartis: 0, soldeCaisse: 0, revenusParJour: [] });
  }
});

// GET /api/dashboard/rapport-annuel - Données rapport PDF annuel
router.get('/rapport-annuel', verifyToken, readOnlyDirection, async (req, res) => {
  try {
    const { annee } = req.query;
    const targetYear = parseInt(annee) || new Date().getFullYear();
    
    const startOfYear = new Date(targetYear, 0, 1);
    const endOfYear = new Date(targetYear, 11, 31, 23, 59, 59);

    const [
      revenusMensuels,
      topClients,
      topBuildings,
      tauxRecouvrement
    ] = await Promise.all([
      // Revenus mensuels
      Promise.all(
        Array.from({ length: 12 }, (_, i) => {
          const start = new Date(targetYear, i, 1);
          const end = new Date(targetYear, i + 1, 0);
          return prisma.payment.aggregate({
            where: {
              datePaiement: { gte: start, lte: end }
            },
            _sum: { montantVerse: true }
          }).then(r => ({
            mois: start.toLocaleString('fr-FR', { month: 'short' }),
            montant: r._sum.montantVerse || 0
          }));
        })
      ),

      // Top 5 clients (par montant total payé)
      prisma.payment.groupBy({
        by: ['leaseId'],
        _sum: { montantVerse: true },
        where: {
          datePaiement: { gte: startOfYear, lte: endOfYear }
        },
        orderBy: { _sum: { montantVerse: 'desc' } },
        take: 5
      }).then(async (results) => {
        const detailed = await Promise.all(
          results.map(async (r) => {
            const lease = await prisma.lease.findUnique({
              where: { id: r.leaseId },
              include: { client: true }
            });
            return {
              client: lease?.client,
              montant: r._sum.montantVerse
            };
          })
        );
        return detailed.filter(d => d.client);
      }),

      // Top 3 immeubles (par revenus)
      Promise.all([
        prisma.building.findMany({ select: { id: true, nom: true } }),
        prisma.lease.findMany({ select: { id: true, buildingId: true } }),
        prisma.payment.findMany({
          where: { datePaiement: { gte: startOfYear, lte: endOfYear } },
          select: { leaseId: true, montantVerse: true }
        })
      ]).then(([buildings, leases, payments]) => {
        const leaseToBuilding = {};
        leases.forEach(l => { leaseToBuilding[l.id] = l.buildingId });
        const revenusByBuilding = {};
        payments.forEach(p => {
          const bId = leaseToBuilding[p.leaseId];
          if (bId) revenusByBuilding[bId] = (revenusByBuilding[bId] || 0) + (p.montantVerse || 0);
        });
        return buildings.map(b => ({
          nom: b.nom,
          revenus: revenusByBuilding[b.id] || 0
        })).sort((a, b) => b.revenus - a.revenus).slice(0, 3);
      }),

      // Taux de recouvrement global
      Promise.all([
        prisma.lease.aggregate({
          where: { statut: 'ACTIF' },
          _sum: { montantInitial: true }
        }),
        prisma.payment.aggregate({
          where: { datePaiement: { gte: startOfYear, lte: endOfYear } },
          _sum: { montantVerse: true }
        })
      ]).then(([attendu, recu]) => {
        const attenduAnnuel = (attendu._sum.montantInitial || 0);
        const recuAnnuel = recu._sum.montantVerse || 0;
        return attenduAnnuel > 0 ? ((recuAnnuel / attenduAnnuel) * 100).toFixed(1) : 0;
      })
    ]);

    res.json({
      annee: targetYear,
      revenusMensuels,
      topClients,
      topBuildings,
      tauxRecouvrement: parseFloat(tauxRecouvrement),
      totalAnnuel: revenusMensuels.reduce((sum, r) => sum + r.montant, 0)
    });
  } catch (error) {
    logger.error('[GET /dashboard/rapport-annuel]', { error: error.message });
    res.json({ annee: 0, revenusMensuels: [], topClients: [], topBuildings: [], tauxRecouvrement: 0, totalAnnuel: 0 });
  }
});

// GET /api/dashboard/etat-creances - Données état des créances PDF
router.get('/etat-creances', verifyToken, readOnlyDirection, async (req, res) => {
  try {
    const today = new Date();

    // Récupérer tous les clients avec solde > 0
    const leases = await prisma.lease.findMany({
      where: { statut: 'ACTIF' },
      include: {
        client: true,
        payments: {
          orderBy: { datePaiement: 'desc' }
        }
      }
    });

    // Calculer le solde et l'ancienneté pour chaque client
    const creances = leases.map(lease => {
      const totalPaye = lease.payments.reduce((sum, p) => sum + p.montantVerse, 0);
      const resteDu = lease.montantInitial - totalPaye;

      if (resteDu <= 0) return null;

      // Calculer les jours de retard
      const lastPayment = lease.payments[0];
      let joursRetard = 0;

      if (lastPayment) {
        joursRetard = Math.floor((today - new Date(lastPayment.datePaiement)) / (1000 * 60 * 60 * 24));
      } else {
        joursRetard = Math.floor((today - new Date(lease.dateDebut)) / (1000 * 60 * 60 * 24));
      }

      // Déterminer la catégorie
      let categorie = 'OK';
      if (joursRetard > 30) categorie = 'CRITIQUE';
      else if (joursRetard >= 8) categorie = 'ALERTE';

      return {
        client: lease.client,
        numeroBail: lease.numeroBail,
        montantInitial: lease.montantInitial,
        totalPaye,
        resteDu,
        joursRetard,
        categorie,
        dernierPaiement: lastPayment?.datePaiement || null
      };
    }).filter(c => c !== null);

    // Trier par ancienneté décroissante
    creances.sort((a, b) => b.joursRetard - a.joursRetard);

    // Totaux
    const totalCreances = creances.reduce((sum, c) => sum + c.resteDu, 0);
    const nbCritiques = creances.filter(c => c.categorie === 'CRITIQUE').length;
    const nbAlertes = creances.filter(c => c.categorie === 'ALERTE').length;

    res.json({
      dateGeneration: today,
      totalCreances,
      nbCreances: creances.length,
      nbCritiques,
      nbAlertes,
      creances
    });
  } catch (error) {
    logger.error('[GET /dashboard/etat-creances]', { error: error.message });
    res.json({ dateGeneration: new Date(), totalCreances: 0, nbCreances: 0, nbCritiques: 0, nbAlertes: 0, creances: [] });
  }
});

// Ancien endpoint revenus conservé pour compatibilité (redirige vers revenus-courbe)
router.get('/revenus', verifyToken, readOnlyDirection, async (req, res) => {
  try {
    const data = await getOrCompute(CACHE_KEYS.DASHBOARD_REVENUS, async () => {
      const aujourdhui = new Date();
      const debut12mois = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth() - 11, 1);

      // 1 seule requête SQL au lieu de 12 requêtes parallèles
      const rows = await prisma.$queryRaw`
        SELECT 
          DATE_TRUNC('month', "datePaiement") AS mois,
          SUM("montantVerse") AS montant
        FROM payments
        WHERE "datePaiement" >= ${debut12mois}
        GROUP BY DATE_TRUNC('month', "datePaiement")
        ORDER BY mois ASC
      `;

      // Construire un map pour lookup rapide
      const rowMap = {};
      for (const row of rows) {
        const d = new Date(row.mois);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        rowMap[key] = Number(row.montant) || 0;
      }

      // Générer les 12 mois dans l'ordre avec 0 si aucun paiement
      const revenus = Array.from({ length: 12 }, (_, idx) => {
        const i = 11 - idx;
        const mois = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth() - i, 1);
        const key = `${mois.getFullYear()}-${mois.getMonth()}`;
        return {
          mois: mois.toLocaleString('fr-FR', { month: 'short', year: 'numeric' }),
          montant: rowMap[key] || 0
        };
      });

      return revenus;
    }, 300);
    res.json(data);
  } catch (error) {
    logger.error('[GET /dashboard/revenus]', { error: error.message });
    res.json([]);
  }
});

// Paiements en retard (corrigé pour utiliser les bons modèles Prisma)
router.get('/retards', verifyToken, readOnlyDirection, async (req, res) => {
  try {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const leasesEnRetard = await prisma.lease.findMany({
      where: {
        statut: 'ACTIF',
        payments: {
          none: {
            datePaiement: { gte: thirtyDaysAgo }
          }
        }
      },
      include: {
        client: { select: { nom: true, prenom: true, telephone: true } },
        building: { select: { nom: true, adresse: true } },
        payments: {
          orderBy: { datePaiement: 'desc' },
          take: 1
        }
      },
      orderBy: { montantInitial: 'desc' },
      take: 20
    });

    const retards = leasesEnRetard.map(lease => {
      const totalPaye = lease.payments.reduce((s, p) => s + p.montantVerse, 0);
      const lastPayment = lease.payments[0];
      const joursRetard = lastPayment
        ? Math.floor((today - new Date(lastPayment.datePaiement)) / (1000 * 60 * 60 * 24))
        : Math.floor((today - new Date(lease.dateDebut)) / (1000 * 60 * 60 * 24));

      return {
        id: lease.id,
        numeroBail: lease.numeroBail,
        client: lease.client,
        building: lease.building,
        montantInitial: lease.montantInitial,
        resteDu: lease.montantInitial - totalPaye,
        joursRetard,
        dernierPaiement: lastPayment?.datePaiement || null
      };
    });

    res.json(retards);
  } catch (error) {
    logger.error('[GET /dashboard/retards]', { error: error.message });
    res.json([]);
  }
});

// Dernières activités (corrigé pour utiliser les bons modèles)
router.get('/activites', verifyToken, readOnlyDirection, async (req, res) => {
  try {
    const data = await getOrCompute(CACHE_KEYS.DASHBOARD_ACTIVITES, async () => {
      const [
        derniersPaiements,
        derniersLeases,
        prochainesVisites
      ] = await Promise.all([
        prisma.payment.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            lease: {
              include: {
                client: { select: { nom: true, prenom: true } }
              }
            },
            agent: { select: { prenom: true, nom: true } }
          }
        }),
        prisma.lease.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            client: { select: { nom: true, prenom: true } },
            building: { select: { nom: true } }
          }
        }),
        prisma.visite.findMany({
          take: 5,
          where: { dateVisite: { gte: new Date() } },
          orderBy: { dateVisite: 'asc' }
        })
      ]);

      return {
        derniersPaiements: derniersPaiements.map(p => ({
          id: p.id,
          montant: p.montantVerse,
          date: p.datePaiement,
          client: p.lease?.client ? `${p.lease.client.prenom} ${p.lease.client.nom}` : 'N/A',
          agent: p.agent ? `${p.agent.prenom} ${p.agent.nom}` : 'N/A',
          type: 'paiement'
        })),
        derniersContrats: derniersLeases.map(l => ({
          id: l.id,
          numeroBail: l.numeroBail,
          client: l.client ? `${l.client.prenom} ${l.client.nom}` : 'N/A',
          building: l.building?.nom || 'N/A',
          date: l.createdAt,
          type: 'bail'
        })),
        prochainesVisites: prochainesVisites.map(v => ({
          id: v.id,
          visiteur: v.visiteurNom,
          date: v.dateVisite,
          motif: v.motif,
          type: 'visite'
        }))
      };
    }, 120); // Cache 2 minutes

    res.json(data);
  } catch (error) {
    logger.error('[GET /dashboard/activites]', { error: error.message });
    res.json({ derniersPaiements: [], derniersContrats: [], prochainesVisites: [] });
  }
});

// ============================================
// SSE TEMPS RÉEL - Dashboard live
// ============================================
router.get('/kpi/live', verifyToken, (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  // Envoyer un heartbeat toutes les 15s et les KPI toutes les 30s
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 15000);

  const sendKPI = async () => {
    try {
      invalidateDashboard(); // Forcer recalcul
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      const [revenusMois, nbClients, nbLeases] = await Promise.all([
        prisma.payment.aggregate({
          where: { datePaiement: { gte: startOfMonth } },
          _sum: { montantVerse: true }
        }),
        prisma.client.count(),
        prisma.lease.count({ where: { statut: 'ACTIF' } })
      ]);

      const kpi = {
        revenusMois: revenusMois._sum.montantVerse || 0,
        totalClients: nbClients,
        bauxActifs: nbLeases,
        timestamp: new Date().toISOString()
      };

      res.write(`data: ${JSON.stringify(kpi)}\n\n`);
    } catch (error) {
      logger.error('[SSE /dashboard/kpi/live]', { error: error.message });
    }
  };

  // Premier envoi immédiat puis toutes les 30s
  sendKPI();
  const kpiInterval = setInterval(sendKPI, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    clearInterval(kpiInterval);
  });
});

// ============================================
// PREDICTION IA - Retards de paiement
// ============================================
router.get('/predictions/retards', verifyToken, readOnlyDirection, async (req, res) => {
  try {
    const leases = await prisma.lease.findMany({
      where: { statut: 'ACTIF' },
      include: {
        client: { select: { id: true, nom: true, prenom: true, telephone: true } },
        building: { select: { nom: true } },
        payments: {
          orderBy: { datePaiement: 'asc' },
          select: { datePaiement: true, montantVerse: true }
        }
      }
    });

    const predictions = leases.map(lease => {
      const payments = lease.payments;
      if (payments.length < 2) {
        return {
          client: lease.client,
          building: lease.building?.nom,
          numeroBail: lease.numeroBail,
          risque: payments.length === 0 ? 'ELEVE' : 'INCONNU',
          score: payments.length === 0 ? 90 : 50,
          raison: payments.length === 0 ? 'Aucun paiement enregistré' : 'Données insuffisantes',
          prochainPaiementEstime: null
        };
      }

      // Calcul des intervalles entre paiements
      const intervals = [];
      for (let i = 1; i < payments.length; i++) {
        const diff = (new Date(payments[i].datePaiement) - new Date(payments[i-1].datePaiement)) / (1000 * 60 * 60 * 24);
        intervals.push(diff);
      }

      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const stdDev = Math.sqrt(intervals.reduce((sum, val) => sum + Math.pow(val - avgInterval, 2), 0) / intervals.length);

      const lastPayment = payments[payments.length - 1];
      const daysSinceLast = (Date.now() - new Date(lastPayment.datePaiement).getTime()) / (1000 * 60 * 60 * 24);

      // Score de risque (0-100)
      let score = 0;
      if (daysSinceLast > avgInterval * 2) score = 95;
      else if (daysSinceLast > avgInterval * 1.5) score = 75;
      else if (daysSinceLast > avgInterval * 1.2) score = 50;
      else if (daysSinceLast > avgInterval) score = 30;
      else score = 10;

      // Augmenter le score si les paiements sont irréguliers
      if (stdDev > avgInterval * 0.5) score = Math.min(score + 15, 100);

      // Montant moyen vs montant dû
      const avgAmount = payments.reduce((s, p) => s + p.montantVerse, 0) / payments.length;
      const totalPaye = payments.reduce((s, p) => s + p.montantVerse, 0);
      const resteDu = lease.montantInitial - totalPaye;

      let risque = 'FAIBLE';
      if (score >= 70) risque = 'ELEVE';
      else if (score >= 40) risque = 'MOYEN';

      const prochainPaiementEstime = new Date(
        new Date(lastPayment.datePaiement).getTime() + avgInterval * 86400000
      );

      return {
        client: lease.client,
        building: lease.building?.nom,
        numeroBail: lease.numeroBail,
        risque,
        score: Math.round(score),
        intervalMoyen: Math.round(avgInterval),
        joursSansPaiement: Math.round(daysSinceLast),
        montantMoyen: Math.round(avgAmount),
        resteDu,
        prochainPaiementEstime,
        raison: score >= 70
          ? `Retard de ${Math.round(daysSinceLast - avgInterval)} jours par rapport à la moyenne`
          : score >= 40
          ? 'Paiements irréguliers détectés'
          : 'Paiements réguliers'
      };
    });

    // Trier par score décroissant
    predictions.sort((a, b) => b.score - a.score);

    const stats = {
      totalBaux: predictions.length,
      risqueEleve: predictions.filter(p => p.risque === 'ELEVE').length,
      risqueMoyen: predictions.filter(p => p.risque === 'MOYEN').length,
      risqueFaible: predictions.filter(p => p.risque === 'FAIBLE').length
    };

    res.json({ stats, predictions });
  } catch (error) {
    logger.error('[GET /dashboard/predictions/retards]', { error: error.message });
    res.json({ stats: { totalBaux: 0, risqueEleve: 0, risqueMoyen: 0, risqueFaible: 0 }, predictions: [] });
  }
});

// ============================================
// GET /api/dashboard/stats - Alias vers KPI (compatibilité frontend)
// ============================================
router.get('/stats', verifyToken, readOnlyDirection, async (req, res) => {
  try {
    const data = await getOrCompute(CACHE_KEYS.DASHBOARD_KPI, async () => {
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const startOfYear = new Date(today.getFullYear(), 0, 1);
      const [revenusMois, revenusAnnee, totalClients, totalBiens, bauxActifs, totalPaiements] = await Promise.all([
        prisma.payment.aggregate({ where: { datePaiement: { gte: startOfMonth } }, _sum: { montantVerse: true } }),
        prisma.payment.aggregate({ where: { datePaiement: { gte: startOfYear } }, _sum: { montantVerse: true } }),
        prisma.client.count(),
        prisma.unite.count(),
        prisma.lease.count({ where: { statut: 'ACTIF' } }),
        prisma.payment.aggregate({ _sum: { montantVerse: true } })
      ]);
      return {
        revenusMois: revenusMois._sum.montantVerse || 0,
        revenusAnnee: revenusAnnee._sum.montantVerse || 0,
        totalClients,
        totalBiens,
        bauxActifs,
        totalEncaissements: totalPaiements._sum.montantVerse || 0
      };
    }, 180);
    res.json(data);
  } catch (error) {
    logger.error('[GET /dashboard/stats]', { error: error.message });
    res.json({ revenusMois: 0, revenusAnnee: 0, totalClients: 0, totalBiens: 0, bauxActifs: 0, totalEncaissements: 0 });
  }
});

// ============================================
// CACHE MANAGEMENT
// ============================================
router.post('/cache/invalidate', verifyToken, isAdmin, (req, res) => {
  invalidateDashboard();
  res.json({ message: 'Cache invalidé', stats: getCacheStats() });
});

router.get('/cache/stats', verifyToken, isAdmin, (req, res) => {
  res.json(getCacheStats());
});

export default router;
