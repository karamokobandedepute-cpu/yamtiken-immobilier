import express from 'express';
import prisma from '../lib/prisma.js';
import { verifyToken, isRecouvrement } from '../middlewares/auth.middleware.js';
import notificationService from '../services/notification.service.js';
import { getOrCompute, CACHE_KEYS } from '../lib/cache.js';

const router = express.Router();


// ============================================
// TABLEAU DE BORD AGENT DE RECOUVREMENT
// ============================================

// GET /api/recouvrement/dashboard - KPI du tableau de bord
router.get('/dashboard', verifyToken, isRecouvrement, async (req, res) => {
  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    
    // 1. Total encaissé ce mois
    const encaisseMois = await prisma.payment.aggregate({
      where: {
        datePaiement: { gte: startOfMonth }
      },
      _sum: { montantVerse: true }
    });
    
    // 2. Total encaissé cette année
    const encaisseAnnee = await prisma.payment.aggregate({
      where: {
        datePaiement: { gte: startOfYear }
      },
      _sum: { montantVerse: true }
    });
    
    // 3. Nombre de dossiers en retard (pas de paiement depuis 30 jours)
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const dossiersRetard = await prisma.lease.count({
      where: {
        statut: 'ACTIF',
        dateEntree: { not: null },
        payments: {
          none: {
            datePaiement: { gte: thirtyDaysAgo }
          }
        }
      }
    });
    
    // 4. Taux de recouvrement mensuel
    const totalAttenduMois = await prisma.lease.aggregate({
      where: {
        statut: 'ACTIF',
        dateEntree: { not: null }
      },
      _sum: { montantInitial: true }
    });
    
    // Calculer le montant attendu mensuel (montant initial / 12 pour l'année)
    const montantAttenduMois = totalAttenduMois._sum?.montantInitial 
      ? totalAttenduMois._sum.montantInitial / 12 
      : 0;
    
    const montantEncaisseMois = encaisseMois._sum.montantVerse || 0;
    const tauxRecouvrement = montantAttenduMois > 0 
      ? ((montantEncaisseMois / montantAttenduMois) * 100).toFixed(1)
      : 0;

    res.json({
      encaisseMois: montantEncaisseMois,
      encaisseAnnee: encaisseAnnee._sum.montantVerse || 0,
      dossiersRetard,
      tauxRecouvrement: parseFloat(tauxRecouvrement),
      montantAttenduMois
    });
  } catch (error) {
    console.error('[GET /recouvrement/dashboard]', error.message);
    res.status(500).json({ message: 'Erreur lors du chargement du dashboard' });
  }
});

// GET /api/recouvrement/clients-retard - Liste des clients avec solde dû
router.get('/clients-retard', verifyToken, isRecouvrement, async (req, res) => {
  try {
    const today = new Date();
    
    // Récupérer tous les baux actifs avec leurs paiements
    const leases = await prisma.lease.findMany({
      where: {
        statut: 'ACTIF',
        dateEntree: { not: null } // Ne recouvre que si les clés sont remises
      },
      include: {
        client: true,
        payments: {
          orderBy: { datePaiement: 'desc' }
        }
      },
      orderBy: {
        montantInitial: 'desc'
      }
    });

    // Calculer les soldes et les retards
    const clientsWithRetard = leases.map(lease => {
      const totalPaye = lease.payments.reduce((sum, p) => sum + p.montantVerse, 0);
      const resteDu = lease.montantInitial - totalPaye;
      
      // Calculer le nombre de jours de retard
      const lastPayment = lease.payments[0];
      let joursRetard = 0;
      
      if (lastPayment) {
        const lastPaymentDate = new Date(lastPayment.datePaiement);
        joursRetard = Math.floor((today - lastPaymentDate) / (1000 * 60 * 60 * 24));
      } else {
        // Jamais payé - calculer depuis la date de remise des clés (dateEntree)
        const dateEntree = new Date(lease.dateEntree);
        joursRetard = Math.floor((today - dateEntree) / (1000 * 60 * 60 * 24));
      }

      return {
        id: lease.id,
        client: lease.client,
        bien: {
          numeroBail: lease.numeroBail,
          uniteId: lease.uniteId,
          buildingId: lease.buildingId
        },
        montantDu: resteDu,
        joursRetard,
        lastPaymentDate: lastPayment?.datePaiement || null,
        totalPaye
      };
    }).filter(c => c.montantDu > 0); // Filtrer ceux qui ont encore un solde

    // Trier par montant dû décroissant
    clientsWithRetard.sort((a, b) => b.montantDu - a.montantDu);

    res.json(clientsWithRetard);
  } catch (error) {
    console.error('[GET /recouvrement/clients-retard]', error.message);
    res.status(500).json({ message: 'Erreur lors du chargement des clients' });
  }
});

// POST /api/recouvrement/encaissement-rapide - Encaissement rapide
router.post('/encaissement-rapide', verifyToken, isRecouvrement, async (req, res) => {
  try {
    const { leaseId, montantVerse, modePaiement, notes } = req.body;
    
    // Vérifier que le bail existe
    const lease = await prisma.lease.findUnique({
      where: { id: parseInt(leaseId) },
      include: { client: true }
    });
    
    if (!lease) {
      return res.status(404).json({ message: 'Bail non trouvé' });
    }

    // Générer le numéro de facture
    const year = new Date().getFullYear();
    const count = await prisma.payment.count({
      where: { numeroFacture: { startsWith: `FAC-${year}-` } }
    });
    const numeroFacture = `FAC-${year}-${String(count + 1).padStart(5, '0')}`;

    // Créer le paiement
    const payment = await prisma.payment.create({
      data: {
        numeroFacture,
        leaseId: parseInt(leaseId),
        montantVerse: parseFloat(montantVerse),
        modePaiement,
        notes,
        agentId: req.user.id,
        datePaiement: new Date()
      },
      include: {
        lease: {
          include: { client: true }
        },
        agent: {
          select: { prenom: true, nom: true }
        }
      }
    });

    // Calculer les nouveaux totaux
    const allPayments = await prisma.payment.findMany({
      where: { leaseId: parseInt(leaseId) }
    });
    const totalPaye = allPayments.reduce((sum, p) => sum + p.montantVerse, 0);

    res.status(201).json({
      message: 'Encaissement enregistré avec succès',
      payment,
      stats: {
        montantInitial: lease.montantInitial,
        totalPaye,
        resteDu: lease.montantInitial - totalPaye,
        progression: lease.montantInitial > 0 ? ((totalPaye / lease.montantInitial) * 100).toFixed(1) : '0.0'
      }
    });
  } catch (error) {
    console.error('[POST /recouvrement/encaissement]', error.message);
    res.status(500).json({ message: 'Erreur lors de l\'encaissement' });
  }
});

// POST /api/recouvrement/relance/:leaseId - Envoi de relance SMS / Alerte pour un locataire en retard
router.post('/relance/:leaseId', verifyToken, isRecouvrement, async (req, res) => {
  try {
    const { leaseId } = req.params;
    const lease = await prisma.lease.findUnique({
      where: { id: parseInt(leaseId) },
      include: {
        client: true,
        unite: true,
        building: true,
        payments: true
      }
    });

    if (!lease) {
      return res.status(404).json({ message: 'Bail non trouvé' });
    }

    const client = lease.client;
    const totalPaye = lease.payments.reduce((sum, p) => sum + (p.montantVerse || 0), 0);
    const resteDu = Math.max(0, (lease.montantInitial || 0) - totalPaye);
    const telephone = client.telephone || client.telephone2;

    const messageRelance = `YAMTIKEN: Cher(e) ${client.prenom} ${client.nom}, nous vous rappelons que votre solde pour le bail ${lease.numeroBail} (${lease.building?.nom || 'Immeuble'}) présente un restant dû de ${resteDu.toLocaleString('fr-FR')} FCFA. Merci de régulariser.`;

    // 1. Enregistrer dans la table des relances
    await prisma.relance.create({
      data: {
        type: 'PAIEMENT',
        destinataire: telephone || client.email || `${client.prenom} ${client.nom}`,
        message: messageRelance,
        referenceId: lease.id,
        referenceType: 'lease',
        statut: 'ENVOYE'
      }
    });

    // 2. Créer une alerte dans le système
    await prisma.alerte.create({
      data: {
        type: 'PAIEMENT_ECHEANCE',
        titre: `Relance envoyée : ${client.prenom} ${client.nom}`,
        description: `Relance enregistrée pour le bail ${lease.numeroBail}. Reste dû : ${resteDu.toLocaleString('fr-FR')} FCFA.`,
        referenceId: lease.id,
        referenceType: 'lease',
        dateEcheance: new Date()
      }
    });

    res.json({
      success: true,
      message: `Relance enregistrée et envoyée à ${client.prenom} ${client.nom} (${telephone || 'Notification'})`,
      destinataire: telephone || client.email,
      resteDu
    });
  } catch (error) {
    console.error('[POST /recouvrement/relance/:leaseId]', error.message);
    res.status(500).json({ message: 'Erreur lors de l\'envoi de la relance', error: error.message });
  }
});

// GET /api/recouvrement/droits-terre - Statut paiement mensuel par porte
router.get('/droits-terre', verifyToken, isRecouvrement, async (req, res) => {
  try {
    const data = await getOrCompute('recouvrement:droits-terre', async () => {
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      const leases = await prisma.lease.findMany({
        where: { 
          statut: 'ACTIF',
          dateEntree: { not: null }
        },
        include: {
          client: { select: { id: true, prenom: true, nom: true, telephone: true } },
          unite: { select: { id: true, numeroPorte: true, loyerBase: true, typeUnite: true } },
          building: { select: { id: true, nom: true } },
          payments: {
            where: { datePaiement: { gte: startOfMonth } },
            select: { montantVerse: true, datePaiement: true, numeroFacture: true }
          }
        },
        orderBy: { building: { nom: 'asc' } }
      });

      const result = leases.map(lease => {
        const droitTerre = parseFloat(lease.unite?.loyerBase || 0);
        const payedThisMonth = lease.payments.reduce((s, p) => s + p.montantVerse, 0);
        let status = 'IMPAYÉ';
        if (droitTerre === 0) status = 'N/A';
        else if (payedThisMonth >= droitTerre) status = 'PAYÉ';
        else if (payedThisMonth > 0) status = 'PARTIEL';

        return {
          leaseId: lease.id,
          numeroBail: lease.numeroBail,
          client: lease.client,
          unite: lease.unite,
          building: lease.building,
          droitTerre,
          payedThisMonth,
          resteThisMonth: Math.max(0, droitTerre - payedThisMonth),
          status,
          lastPayment: lease.payments[0] || null
        };
      });

      const grouped = {};
      result.forEach(r => {
        const key = r.building?.id || 'unknown';
        if (!grouped[key]) grouped[key] = { building: r.building, entries: [] };
        grouped[key].entries.push(r);
      });

      return { entries: result, grouped: Object.values(grouped) };
    }, 120); // Cache 2 minutes

    res.json(data);
  } catch (error) {
    console.error('[GET /recouvrement/droits-terre]', error.message);
    res.status(500).json({ message: 'Erreur lors du chargement des droits de terre', error: error.message });
  }
});

// GET /api/recouvrement/statistiques-mensuelles - Stats sur 12 mois
router.get('/statistiques-mensuelles', verifyToken, isRecouvrement, async (req, res) => {
  try {
    const data = await getOrCompute(CACHE_KEYS.RECOUVREMENT_STATS_MENSUELLES, async () => {
      const today = new Date();
      const year = today.getFullYear();
      const startOfYear = new Date(year, 0, 1);

      // 1 seule requête SQL groupée pour les paiements de l'année
      const paymentRows = await prisma.$queryRaw`
        SELECT
          EXTRACT(MONTH FROM "datePaiement") - 1 AS mois_idx,
          SUM("montantVerse") AS montant
        FROM payments
        WHERE "datePaiement" >= ${startOfYear}
        GROUP BY EXTRACT(MONTH FROM "datePaiement")
      `;

      const paymentByMonth = {};
      for (const row of paymentRows) {
        paymentByMonth[Number(row.mois_idx)] = Number(row.montant) || 0;
      }

      const leases = await prisma.lease.findMany({
        where: { statut: 'ACTIF', dateEntree: { not: null } },
        select: { montantInitial: true }
      });
      const montantMensuelAttendu = leases.reduce((sum, l) => sum + l.montantInitial, 0) / 12;

      const moisLabels = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];
      let totalAttendu = 0;
      let totalEncaisse = 0;
      const statsMensuelles = [];

      for (let i = 0; i < 12; i++) {
        const montantEncaisse = paymentByMonth[i] || 0;
        const taux = montantMensuelAttendu > 0
          ? ((montantEncaisse / montantMensuelAttendu) * 100).toFixed(1)
          : 0;
        totalAttendu += montantMensuelAttendu;
        totalEncaisse += montantEncaisse;
        statsMensuelles.push({
          mois: moisLabels[i],
          attendu: Math.round(montantMensuelAttendu),
          encaisse: montantEncaisse,
          taux: parseFloat(taux),
          ecart: Math.round(montantMensuelAttendu - montantEncaisse)
        });
      }

      const moisRestants = 12 - today.getMonth() - 1;
      const projectionEncaisse = totalEncaisse + ((statsMensuelles[today.getMonth()]?.encaisse || 0) * moisRestants);

      return {
        statsMensuelles,
        totalAttendu: Math.round(totalAttendu),
        totalEncaisse,
        tauxGlobal: totalAttendu > 0 ? ((totalEncaisse / totalAttendu) * 100).toFixed(1) : 0,
        projectionFinAnnee: Math.round(projectionEncaisse),
        ecartProjection: Math.round(totalAttendu - projectionEncaisse)
      };
    }, 300); // Cache 5 minutes

    res.json(data);
  } catch (error) {
    console.error('[GET /recouvrement/stats]', error.message);
    res.status(500).json({ message: 'Erreur lors du chargement des statistiques' });
  }
});

// GET /api/recouvrement/export-excel - Export Excel du rapport
router.get('/export-excel', verifyToken, isRecouvrement, async (req, res) => {
  try {
    const { mois, annee } = req.query;
    const targetMonth = parseInt(mois) || new Date().getMonth();
    const targetYear = parseInt(annee) || new Date().getFullYear();
    
    const startOfMonth = new Date(targetYear, targetMonth, 1);
    const endOfMonth = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);

    // Récupérer les paiements du mois
    const payments = await prisma.payment.findMany({
      where: {
        datePaiement: {
          gte: startOfMonth,
          lte: endOfMonth
        }
      },
      include: {
        lease: {
          include: { client: true }
        },
        agent: {
          select: { prenom: true, nom: true }
        }
      },
      orderBy: { datePaiement: 'desc' }
    });

    // Formater pour Excel (CSV simple)
    const csvHeader = 'Date,Numero Facture,Client,Montant,Mode,Agent\n';
    const csvRows = payments.map(p => {
      const date = new Date(p.datePaiement).toLocaleDateString('fr-FR');
      const client = `${p.lease.client.prenom} ${p.lease.client.nom}`;
      return `${date},${p.numeroFacture},"${client}",${p.montantVerse},${p.modePaiement},"${p.agent.prenom} ${p.agent.nom}"`;
    }).join('\n');

    const csvContent = csvHeader + csvRows;
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="recouvrement-${targetMonth + 1}-${targetYear}.csv"`);
    res.send(csvContent);
  } catch (error) {
    console.error('[GET /recouvrement/export]', error.message);
    res.status(500).json({ message: 'Erreur lors de l\'export' });
  }
});

export default router;
