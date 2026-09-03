import express from 'express';
import prisma from '../lib/prisma.js';
import { verifyToken, isAdmin } from '../middlewares/auth.middleware.js';
import { getOrCompute } from '../lib/cache.js';

const router = express.Router();

// Catégories valides
export const CATEGORIES_DEPENSE = [
  'SALAIRE',
  'FOURNITURE_BUREAU',
  'REPARATION',
  'TRANSPORT',
  'ELECTRICITE',
  'EAU',
  'LOYER_BUREAU',
  'COMMISSION_EXTERNE',
  'IMPOT_TAXE',
  'FRAIS_BANCAIRE',
  'ENTRETIEN',
  'COMMUNICATION',
  'AUTRE'
];

// Middleware : ADMIN/SUPER_ADMIN peuvent créer/modifier/supprimer
// SECRETAIRE peut uniquement voir et créer
const canModifyDepense = (req, res, next) => {
  const role = req.user?.role;
  if (!['SUPER_ADMIN', 'ADMIN'].includes(role)) {
    return res.status(403).json({ message: 'Accès refusé. Seuls les administrateurs peuvent modifier ou supprimer les dépenses.' });
  }
  next();
};

// ============================================
// GET /api/caisse/categories
// ============================================
router.get('/categories', verifyToken, (req, res) => {
  const categoriesList = CATEGORIES_DEPENSE.map(c => ({
    value: c,
    label: c.replace(/_/g, ' ').replace(/\w\S*/g, (w) => (w.replace(/^\w/, (c) => c.toUpperCase())))
  }));
  res.json(categoriesList);
});

// ============================================
// GET /api/caisse/dashboard — KPI solde caisse
// ============================================
router.get('/dashboard', verifyToken, async (req, res) => {
  try {
    const { periode = 'mois' } = req.query; // mois | annee | tout
    const now = new Date();
    let dateDebut;

    if (periode === 'mois') {
      dateDebut = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (periode === 'annee') {
      dateDebut = new Date(now.getFullYear(), 0, 1);
    } else {
      dateDebut = new Date('2020-01-01');
    }

    const cacheKey = `caisse:dashboard:${periode}`;

    const data = await getOrCompute(cacheKey, async () => {
      const [entreesMois, depensesMois, entreesAnnee, depensesAnnee, depensesRecentes] = await Promise.all([
        // Entrées (paiements) de la période
        prisma.payment.aggregate({
          where: { datePaiement: { gte: dateDebut }, deletedAt: null },
          _sum: { montantVerse: true },
          _count: true
        }),
        // Dépenses de la période
        prisma.depense.aggregate({
          where: { date: { gte: dateDebut }, deletedAt: null },
          _sum: { montant: true },
          _count: true
        }),
        // Entrées année (pour référence si période=mois)
        prisma.payment.aggregate({
          where: { datePaiement: { gte: new Date(now.getFullYear(), 0, 1) }, deletedAt: null },
          _sum: { montantVerse: true }
        }),
        // Dépenses année
        prisma.depense.aggregate({
          where: { date: { gte: new Date(now.getFullYear(), 0, 1) }, deletedAt: null },
          _sum: { montant: true }
        }),
        // 5 dernières dépenses pour le widget
        prisma.depense.findMany({
          where: { deletedAt: null },
          include: { createdBy: { select: { prenom: true, nom: true } } },
          orderBy: { date: 'desc' },
          take: 5
        })
      ]);

      const totalEntrees = Number(entreesMois._sum.montantVerse) || 0;
      const totalDepenses = Number(depensesMois._sum.montant) || 0;
      const soldeNet = totalEntrees - totalDepenses;
      const tauxDepense = totalEntrees > 0 ? ((totalDepenses / totalEntrees) * 100).toFixed(1) : 0;

      return {
        periode,
        totalEntrees,
        totalDepenses,
        soldeNet,
        tauxDepense: parseFloat(tauxDepense),
        nbEntrees: entreesMois._count || 0,
        nbDepenses: depensesMois._count || 0,
        annee: {
          totalEntrees: Number(entreesAnnee._sum.montantVerse) || 0,
          totalDepenses: Number(depensesAnnee._sum.montant) || 0
        },
        depensesRecentes
      };
    }, 30); // Cache 30 secondes (données financières sensibles)

    res.json(data);
  } catch (error) {
    console.error('[GET /caisse/dashboard]', error.message);
    res.json({
      totalEntrees: 0, totalDepenses: 0, soldeNet: 0, tauxDepense: 0,
      nbEntrees: 0, nbDepenses: 0, depensesRecentes: []
    });
  }
});

// ============================================
// GET /api/caisse/audit — Timeline audit financier mixte
// ============================================
router.get('/audit', verifyToken, async (req, res) => {
  try {
    const { dateDebut, dateFin, limit = 100 } = req.query;
    const take = Math.min(parseInt(limit) || 100, 500);

    let where = { deletedAt: null };
    const wherePaiement = {};
    if (dateDebut) {
      where.date = { ...(where.date || {}), gte: new Date(dateDebut) };
      wherePaiement.datePaiement = { ...(wherePaiement.datePaiement || {}), gte: new Date(dateDebut) };
    }
    if (dateFin) {
      where.date = { ...(where.date || {}), lte: new Date(dateFin) };
      wherePaiement.datePaiement = { ...(wherePaiement.datePaiement || {}), lte: new Date(dateFin) };
    }

    const [depenses, paiements] = await Promise.all([
      prisma.depense.findMany({
        where,
        include: {
          createdBy: { select: { id: true, prenom: true, nom: true, role: true } },
          lease: { select: { numeroBail: true } }
        },
        orderBy: { date: 'desc' },
        take
      }),
      prisma.payment.findMany({
        where: { ...wherePaiement, deletedAt: null },
        include: {
          agent: { select: { id: true, prenom: true, nom: true, role: true } },
          lease: {
            select: {
              numeroBail: true,
              client: { select: { prenom: true, nom: true } }
            }
          }
        },
        orderBy: { datePaiement: 'desc' },
        take
      })
    ]);

    // Fusionner et normaliser en événements
    const evenements = [
      ...depenses.map(d => ({
        id: `dep-${d.id}`,
        type: 'DEPENSE',
        date: d.date,
        montant: d.montant,
        libelle: d.motif,
        categorie: d.categorie,
        description: d.description,
        par: d.createdBy ? `${d.createdBy.prenom} ${d.createdBy.nom}` : 'Système',
        parRole: d.createdBy?.role,
        reference: d.reference,
        bail: d.lease?.numeroBail || null,
        rawId: d.id
      })),
      ...paiements.map(p => ({
        id: `pay-${p.id}`,
        type: 'ENTREE',
        date: p.datePaiement,
        montant: p.montantVerse,
        libelle: `Paiement bail ${p.lease?.numeroBail || p.numeroFacture}`,
        categorie: 'LOYER',
        description: p.notes || null,
        par: p.agent ? `${p.agent.prenom} ${p.agent.nom}` : 'Système',
        parRole: p.agent?.role,
        reference: p.numeroFacture,
        bail: p.lease?.numeroBail || null,
        client: p.lease?.client ? `${p.lease.client.prenom} ${p.lease.client.nom}` : null,
        rawId: p.id
      }))
    ];

    // Trier par date décroissante
    evenements.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Calculer le solde cumulé courant
    let soldeRunning = 0;
    const evenementsAvecSolde = [...evenements].reverse().map(e => {
      if (e.type === 'ENTREE') soldeRunning += e.montant;
      else soldeRunning -= e.montant;
      return { ...e, soldeCumulatif: soldeRunning };
    }).reverse();

    // Stats globales
    const totalEntrees = paiements.reduce((s, p) => s + p.montantVerse, 0);
    const totalDepenses = depenses.reduce((s, d) => s + d.montant, 0);

    res.json({
      evenements: evenementsAvecSolde.slice(0, take),
      stats: {
        totalEntrees,
        totalDepenses,
        soldeNet: totalEntrees - totalDepenses,
        nbEvenements: evenementsAvecSolde.length
      }
    });
  } catch (error) {
    console.error('[GET /caisse/audit]', error.message);
    res.status(500).json({ message: 'Erreur lors du chargement de l\'audit', error: error.message });
  }
});

// ============================================
// GET /api/caisse/bilan-mensuel — 12 mois revenus vs dépenses
// ============================================
router.get('/bilan-mensuel', verifyToken, async (req, res) => {
  try {
    const data = await getOrCompute('caisse:bilan-mensuel', async () => {
      const now = new Date();
      const debut12mois = new Date(now.getFullYear(), now.getMonth() - 11, 1);

      const [revenuRows, depenseRows] = await Promise.all([
        prisma.$queryRaw`
          SELECT
            DATE_TRUNC('month', "datePaiement") AS mois,
            SUM("montantVerse") AS montant,
            COUNT(*) AS nb
          FROM payments
          WHERE "datePaiement" >= ${debut12mois} AND "deletedAt" IS NULL
          GROUP BY DATE_TRUNC('month', "datePaiement")
          ORDER BY mois ASC
        `,
        prisma.$queryRaw`
          SELECT
            DATE_TRUNC('month', "date") AS mois,
            SUM("montant") AS montant,
            COUNT(*) AS nb
          FROM depenses
          WHERE "date" >= ${debut12mois} AND "deleted_at" IS NULL
          GROUP BY DATE_TRUNC('month', "date")
          ORDER BY mois ASC
        `
      ]);

      const revenuMap = {};
      for (const row of revenuRows) {
        const d = new Date(row.mois);
        revenuMap[`${d.getFullYear()}-${d.getMonth()}`] = Number(row.montant) || 0;
      }
      const depenseMap = {};
      for (const row of depenseRows) {
        const d = new Date(row.mois);
        depenseMap[`${d.getFullYear()}-${d.getMonth()}`] = Number(row.montant) || 0;
      }

      const bilan = Array.from({ length: 12 }, (_, idx) => {
        const i = 11 - idx;
        const mois = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${mois.getFullYear()}-${mois.getMonth()}`;
        const entrees = revenuMap[key] || 0;
        const depenses = depenseMap[key] || 0;
        return {
          mois: mois.toLocaleString('fr-FR', { month: 'short', year: 'numeric' }),
          entrees,
          depenses,
          solde: entrees - depenses
        };
      });

      return bilan;
    }, 120);

    res.json(data);
  } catch (error) {
    console.error('[GET /caisse/bilan-mensuel]', error.message);
    res.json([]);
  }
});

// ============================================
// GET /api/caisse/bilan-categorie — Par catégorie
// ============================================
router.get('/bilan-categorie', verifyToken, async (req, res) => {
  try {
    const { dateDebut, dateFin } = req.query;
    const now = new Date();
    const debut = dateDebut ? new Date(dateDebut) : new Date(now.getFullYear(), now.getMonth(), 1);
    const fin = dateFin ? new Date(dateFin) : now;

    const data = await prisma.depense.groupBy({
      by: ['categorie'],
      where: { date: { gte: debut, lte: fin }, deletedAt: null },
      _sum: { montant: true },
      _count: { id: true },
      orderBy: { _sum: { montant: 'desc' } }
    });

    const totalGlobal = data.reduce((s, row) => s + (Number(row._sum.montant) || 0), 0);

    const result = data.map(row => ({
      categorie: row.categorie,
      montant: Number(row._sum.montant) || 0,
      nb: row._count.id,
      pourcentage: totalGlobal > 0
        ? parseFloat(((Number(row._sum.montant) / totalGlobal) * 100).toFixed(1))
        : 0
    }));

    res.json({ categories: result, totalDepenses: totalGlobal });
  } catch (error) {
    console.error('[GET /caisse/bilan-categorie]', error.message);
    res.json({ categories: [], totalDepenses: 0 });
  }
});

// ============================================
// GET /api/caisse/depenses — Liste des dépenses
// ============================================
router.get('/depenses', verifyToken, async (req, res) => {
  try {
    const { categorie, dateDebut, dateFin, search, limit = 200 } = req.query;
    const take = Math.min(parseInt(limit) || 200, 500);

    const where = { deletedAt: null };
    if (categorie) where.categorie = categorie;
    if (dateDebut || dateFin) {
      where.date = {};
      if (dateDebut) where.date.gte = new Date(dateDebut);
      if (dateFin) where.date.lte = new Date(dateFin);
    }
    if (search) {
      where.OR = [
        { motif: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { reference: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [depenses, total] = await Promise.all([
      prisma.depense.findMany({
        where,
        include: {
          createdBy: { select: { id: true, prenom: true, nom: true, role: true } },
          lease: { select: { numeroBail: true, client: { select: { prenom: true, nom: true } } } }
        },
        orderBy: { date: 'desc' },
        take
      }),
      prisma.depense.aggregate({
        where,
        _sum: { montant: true },
        _count: true
      })
    ]);

    res.json({
      depenses,
      total: Number(total._sum.montant) || 0,
      count: total._count || 0
    });
  } catch (error) {
    console.error('[GET /caisse/depenses]', error.message);
    res.status(500).json({ message: 'Erreur lors du chargement des dépenses', error: error.message });
  }
});

// ============================================
// POST /api/caisse/depenses — Créer une dépense
// ============================================
router.post('/depenses', verifyToken, async (req, res) => {
  try {
    const role = req.user?.role;
    if (!['SUPER_ADMIN', 'ADMIN', 'SECRETAIRE'].includes(role)) {
      return res.status(403).json({ message: 'Accès refusé.' });
    }

    const { motif, categorie, montant, date, description, reference, leaseId } = req.body;

    if (!motif || !categorie || !montant) {
      return res.status(400).json({ message: 'Motif, catégorie et montant sont obligatoires.' });
    }
    if (!CATEGORIES_DEPENSE.includes(categorie)) {
      return res.status(400).json({ message: `Catégorie invalide. Valeurs acceptées : ${CATEGORIES_DEPENSE.join(', ')}` });
    }
    if (parseFloat(montant) <= 0) {
      return res.status(400).json({ message: 'Le montant doit être supérieur à 0.' });
    }

    const depense = await prisma.depense.create({
      data: {
        motif: motif.trim(),
        categorie,
        montant: parseFloat(montant),
        date: date ? new Date(date) : new Date(),
        description: description?.trim() || null,
        reference: reference?.trim() || null,
        createdById: req.user.id,
        leaseId: leaseId ? parseInt(leaseId) : null
      },
      include: {
        createdBy: { select: { id: true, prenom: true, nom: true } }
      }
    });

    // Invalider le cache caisse
    const { invalidateKey } = await import('../lib/cache.js');
    ['caisse:dashboard:mois', 'caisse:dashboard:annee', 'caisse:dashboard:tout', 'caisse:bilan-mensuel'].forEach(k => invalidateKey(k));

    res.status(201).json(depense);
  } catch (error) {
    console.error('[POST /caisse/depenses]', error.message);
    res.status(500).json({ message: 'Erreur lors de la création de la dépense', error: error.message });
  }
});

// ============================================
// PUT /api/caisse/depenses/:id — Modifier
// ============================================
router.put('/depenses/:id', verifyToken, canModifyDepense, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { motif, categorie, montant, date, description, reference, leaseId } = req.body;

    const existing = await prisma.depense.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return res.status(404).json({ message: 'Dépense introuvable.' });

    if (categorie && !CATEGORIES_DEPENSE.includes(categorie)) {
      return res.status(400).json({ message: 'Catégorie invalide.' });
    }

    const updated = await prisma.depense.update({
      where: { id },
      data: {
        ...(motif && { motif: motif.trim() }),
        ...(categorie && { categorie }),
        ...(montant !== undefined && { montant: parseFloat(montant) }),
        ...(date && { date: new Date(date) }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(reference !== undefined && { reference: reference?.trim() || null }),
        ...(leaseId !== undefined && { leaseId: leaseId ? parseInt(leaseId) : null })
      },
      include: { createdBy: { select: { prenom: true, nom: true } } }
    });

    const { invalidateKey } = await import('../lib/cache.js');
    ['caisse:dashboard:mois', 'caisse:dashboard:annee', 'caisse:dashboard:tout', 'caisse:bilan-mensuel'].forEach(k => invalidateKey(k));

    res.json(updated);
  } catch (error) {
    console.error('[PUT /caisse/depenses/:id]', error.message);
    res.status(500).json({ message: 'Erreur lors de la modification', error: error.message });
  }
});

// ============================================
// DELETE /api/caisse/depenses/:id — Supprimer
// ============================================
router.delete('/depenses/:id', verifyToken, canModifyDepense, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.depense.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return res.status(404).json({ message: 'Dépense introuvable.' });

    await prisma.depense.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    const { invalidateKey } = await import('../lib/cache.js');
    ['caisse:dashboard:mois', 'caisse:dashboard:annee', 'caisse:dashboard:tout', 'caisse:bilan-mensuel'].forEach(k => invalidateKey(k));

    res.json({ message: 'Dépense supprimée avec succès.' });
  } catch (error) {
    console.error('[DELETE /caisse/depenses/:id]', error.message);
    res.status(500).json({ message: 'Erreur lors de la suppression', error: error.message });
  }
});

// ============================================
// GET /api/caisse/categories — Liste des catégories
// ============================================
router.get('/categories', verifyToken, (req, res) => {
  const labels = {
    SALAIRE: 'Salaire & RH',
    FOURNITURE_BUREAU: 'Fournitures bureau',
    REPARATION: 'Réparations & Travaux',
    TRANSPORT: 'Transport & Déplacement',
    ELECTRICITE: 'Électricité',
    EAU: 'Eau',
    LOYER_BUREAU: 'Loyer bureau',
    COMMISSION_EXTERNE: 'Commission externe',
    IMPOT_TAXE: 'Impôts & Taxes',
    FRAIS_BANCAIRE: 'Frais bancaires',
    ENTRETIEN: 'Entretien & Nettoyage',
    COMMUNICATION: 'Communication & Internet',
    AUTRE: 'Autre'
  };
  res.json(CATEGORIES_DEPENSE.map(c => ({ value: c, label: labels[c] || c })));
});

export default router;
