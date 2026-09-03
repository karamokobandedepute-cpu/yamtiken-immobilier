import express from 'express';
import prisma from '../lib/prisma.js';
import { verifyToken, isAdmin } from '../middlewares/auth.middleware.js';
import { getOrCompute, CACHE_KEYS } from '../lib/cache.js';

const router = express.Router();


// ============================================
// ROUTES ALERTES AUTOMATIQUES
// ============================================

// GET /api/alertes - Liste des alertes
router.get('/', verifyToken, async (req, res) => {
  try {
    const { type, lues, traitees } = req.query;
    const where = {};
    if (type) where.type = type;
    if (lues !== undefined) where.estLue = lues === 'true';
    if (traitees !== undefined) where.estTraitee = traitees === 'true';
    const alertes = await prisma.alerte.findMany({ where, orderBy: [{ estLue: 'asc' }, { dateEcheance: 'asc' }], take: 200 });
    res.json(alertes);
  } catch (error) {
    console.error('[alertes/]', error.message);
    res.json([]);
  }
});

// GET /api/alertes/count - Nombre d'alertes en attente (pour badge sidebar)
router.get('/count', verifyToken, async (req, res) => {
  try {
    // Cache court (10s) pour éviter les appels répétés depuis la sidebar
    const count = await getOrCompute(CACHE_KEYS.ALERTES_COUNT, async () => {
      return prisma.alerte.count({ where: { estLue: false, estTraitee: false } });
    }, 10);
    res.json({ count });
  } catch (error) {
    console.error('[alertes/count]', error.message);
    res.json({ count: 0 });
  }
});

// GET /api/alertes/non-lues - Nombre d'alertes non lues (alias pour compatibilité)
router.get('/non-lues/count', verifyToken, async (req, res) => {
  try {
    const count = await getOrCompute(CACHE_KEYS.ALERTES_COUNT, async () => {
      return prisma.alerte.count({ where: { estLue: false, estTraitee: false } });
    }, 10);
    res.json({ count });
  } catch (error) {
    console.error('[alertes/non-lues/count]', error.message);
    res.json({ count: 0 });
  }
});

// GET /api/alertes/dashboard - Alertes pour le dashboard
router.get('/dashboard/urgentes', verifyToken, async (req, res) => {
  try {
    const today = new Date();
    const sevenDaysLater = new Date(today);
    sevenDaysLater.setDate(today.getDate() + 7);
    const thirtyDaysLater = new Date(today);
    thirtyDaysLater.setDate(today.getDate() + 30);

    const [paiementsEcheance, bauxExpiration, relancesAujourdHui, totalNonLues] = await Promise.all([
      // Paiements à échéance dans ≤ 7 jours
      prisma.payment.count({
        where: {
          datePaiement: {
            lte: sevenDaysLater
          }
        }
      }),
      
      // Baux expirant dans ≤ 30 jours
      prisma.lease.count({
        where: {
          dateFin: {
            not: null,
            lte: thirtyDaysLater
          },
          statut: 'ACTIF'
        }
      }),
      
      // Relances visites prévues aujourd'hui
      prisma.visite.count({
        where: {
          relanceSouhait: true,
          dateRelance: {
            gte: new Date(today.setHours(0, 0, 0, 0)),
            lte: new Date(today.setHours(23, 59, 59, 999))
          },
          statutRelance: 'EN_ATTENTE'
        }
      }),
      
      // Total alertes non lues
      prisma.alerte.count({
        where: {
          estLue: false,
          estTraitee: false
        }
      })
    ]);

    res.json({
      paiementsEcheance,
      bauxExpiration,
      relancesAujourdHui,
      totalNonLues,
      totalUrgentes: paiementsEcheance + bauxExpiration + relancesAujourdHui
    });
  } catch (error) {
    console.error('[alertes/dashboard/urgentes]', error.message);
    res.json({ paiementsEcheance: 0, bauxExpiration: 0, relancesAujourdHui: 0, totalNonLues: 0, totalUrgentes: 0 });
  }
});

// POST /api/alertes - Créer une alerte
router.post('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const data = req.body;
    
    if (data.dateEcheance) {
      data.dateEcheance = new Date(data.dateEcheance);
    }

    const alerte = await prisma.alerte.create({
      data
    });

    res.status(201).json({ 
      message: 'Alerte créée avec succès',
      alerte 
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la création de l\'alerte' });
  }
});

// PUT /api/alertes/:id/lue - Marquer comme lue
router.put('/:id/lue', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const alerte = await prisma.alerte.update({
      where: { id: parseInt(id) },
      data: { estLue: true }
    });

    res.json({ 
      message: 'Alerte marquée comme lue',
      alerte 
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour' });
  }
});

// PUT /api/alertes/:id/traiter - Marquer comme traitée
router.put('/:id/traiter', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const alerte = await prisma.alerte.update({
      where: { id: parseInt(id) },
      data: { 
        estTraitee: true,
        dateTraitement: new Date()
      }
    });

    res.json({ 
      message: 'Alerte marquée comme traitée',
      alerte 
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors du traitement' });
  }
});

// DELETE /api/alertes/:id
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.alerte.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Alerte supprimée avec succès' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la suppression' });
  }
});

export default router;
