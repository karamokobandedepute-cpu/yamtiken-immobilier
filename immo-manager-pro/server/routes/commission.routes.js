import express from 'express';
import prisma from '../lib/prisma.js';
import { verifyToken, isAdmin } from '../middlewares/auth.middleware.js';
import { getOrCompute, CACHE_KEYS } from '../lib/cache.js';

const router = express.Router();


// ============================================
// ROUTES APPORTEURS (REFERRERS)
// ============================================

// GET /api/commissions/referrers - Liste des apporteurs avec statistiques
router.get('/referrers', verifyToken, async (req, res) => {
  try {
    const { search } = req.query;
    
    const where = {};
    // Note: isActive n'existe pas dans la base actuelle, on l'ignore
    if (search) {
      where.OR = [
        { nom: { contains: search, mode: 'insensitive' } },
        { prenom: { contains: search, mode: 'insensitive' } }
      ];
    }

    const referrers = await prisma.referrer.findMany({
      where,
      orderBy: { nom: 'asc' }
    });

    // Calculer les statistiques pour chaque apporteur
    const referrersWithStats = await Promise.all(referrers.map(async (referrer) => {
      try {
        const nbClients = await prisma.client.count({ where: { temoinId: referrer.id } }).catch(() => 0);
        const commissions = await prisma.commission.findMany({ where: { referrerId: referrer.id } }).catch(() => []);
        const totalCommissions = commissions.reduce((sum, c) => sum + (c.montant || 0), 0);
        const commissionsPayees = commissions.filter(c => c.statut === 'PAYEE').reduce((sum, c) => sum + (c.montant || 0), 0);
        const commissionsAttente = commissions.filter(c => c.statut === 'EN_ATTENTE').reduce((sum, c) => sum + (c.montant || 0), 0);
        return { ...referrer, nbClients, totalCommissions, commissionsPayees, commissionsAttente, chiffreAffaires: 0 };
      } catch (e) {
        return { ...referrer, nbClients: 0, totalCommissions: 0, commissionsPayees: 0, commissionsAttente: 0, chiffreAffaires: 0 };
      }
    }));

    res.json(referrersWithStats);
  } catch (error) {
    console.error('[referrers] Erreur:', error.message);
    res.status(500).json({ message: 'Erreur lors de la récupération des apporteurs', detail: error.message });
  }
});

// GET /api/commissions/referrers/classement - Classement des apporteurs
router.get('/referrers/classement', verifyToken, async (req, res) => {
  try {
    const data = await getOrCompute(CACHE_KEYS.COMMISSIONS_CLASSEMENT, async () => {
      const referrers = await prisma.referrer.findMany({ orderBy: { nom: 'asc' } }).catch(() => []);
      if (referrers.length === 0) return { topByClients: [], topByCA: [], totalApporteurs: 0 };

      const referrerIds = referrers.map(r => r.id);

      // 2 requêtes groupées au lieu de N*2 requêtes séparées
      const [clientCounts, commissionRows] = await Promise.all([
        prisma.client.groupBy({
          by: ['temoinId'],
          where: { temoinId: { in: referrerIds } },
          _count: { id: true }
        }).catch(() => []),
        prisma.commission.groupBy({
          by: ['referrerId'],
          where: { referrerId: { in: referrerIds } },
          _sum: { montant: true }
        }).catch(() => [])
      ]);

      const clientCountMap = {};
      for (const row of clientCounts) {
        if (row.temoinId) clientCountMap[row.temoinId] = row._count.id;
      }
      const commissionMap = {};
      for (const row of commissionRows) {
        if (row.referrerId) commissionMap[row.referrerId] = Number(row._sum.montant) || 0;
      }

      const referrersWithStats = referrers.map(referrer => ({
        id: referrer.id,
        nom: referrer.nom || '',
        prenom: referrer.prenom || '',
        photoUrl: referrer.photoUrl,
        nbClients: clientCountMap[referrer.id] || 0,
        totalCommissions: commissionMap[referrer.id] || 0,
        chiffreAffaires: 0,
        tauxCommission: referrer.tauxCommission,
        typeCommission: referrer.typeCommission
      }));

      const topByClients = [...referrersWithStats].sort((a, b) => b.nbClients - a.nbClients).slice(0, 10);
      const topByCA = [...referrersWithStats].sort((a, b) => b.chiffreAffaires - a.chiffreAffaires).slice(0, 10);

      return { topByClients, topByCA, totalApporteurs: referrers.length };
    }, 120); // Cache 2 minutes

    res.json(data);
  } catch (error) {
    console.error('[classement] Erreur:', error.message);
    res.status(200).json({ topByClients: [], topByCA: [], totalApporteurs: 0 });
  }
});

// GET /api/commissions/referrers/:id - Détail d'un apporteur
router.get('/referrers/:id', verifyToken, async (req, res) => {
  try {
    const rid = parseInt(req.params.id);

    const [referrers, clients, commissions] = await Promise.all([
      prisma.$queryRaw`
        SELECT id, nom, prenom, contact, email, "photoUrl", adresse,
               "tauxCommission", "typeCommission", "isActive", "createdAt"
        FROM public.referrers WHERE id = ${rid} LIMIT 1
      `,
      prisma.$queryRaw`
        SELECT c.id, c.nom, c.prenom, c.telephone, c.email, c.actif,
               l.id as "leaseId", l."numeroBail", l."montantInitial", l.statut as "leaseStatut",
               COALESCE((SELECT SUM(p."montantVerse") FROM public.payments p WHERE p."leaseId" = l.id), 0) as "totalPaye"
        FROM public.clients c
        LEFT JOIN public.leases l ON l."clientId" = c.id
        WHERE c."temoinId" = ${rid}
        ORDER BY c.id
      `,
      prisma.$queryRaw`
        SELECT co.id, co.montant, co."datePaiement", co.statut, co.description, co."createdAt",
               cl.id as "clientId", cl.nom as "clientNom", cl.prenom as "clientPrenom"
        FROM public.commissions co
        LEFT JOIN public.clients cl ON cl.id = co."clientId"
        WHERE co."referrerId" = ${rid}
        ORDER BY co."createdAt" DESC
      `
    ]);

    if (!referrers || referrers.length === 0) {
      return res.status(404).json({ message: 'Apporteur non trouvé' });
    }

    const referrer = referrers[0];

    const clientsMap = {};
    clients.forEach(row => {
      if (!clientsMap[row.id]) {
        clientsMap[row.id] = { id: row.id, nom: row.nom, prenom: row.prenom, telephone: row.telephone, email: row.email, actif: row.actif, leases: [] };
      }
      if (row.leaseId) {
        clientsMap[row.id].leases.push({ id: row.leaseId, numeroBail: row.numeroBail, montantInitial: Number(row.montantInitial), statut: row.leaseStatut, totalPaye: Number(row.totalPaye) });
      }
    });
    const clientsList = Object.values(clientsMap);

    const commissionsList = commissions.map(c => ({
      id: c.id, montant: Number(c.montant), datePaiement: c.datePaiement,
      statut: c.statut, description: c.description, createdAt: c.createdAt,
      client: { id: c.clientId, nom: c.clientNom, prenom: c.clientPrenom }
    }));

    const totalCommissions = commissionsList.reduce((s, c) => s + c.montant, 0);
    const commissionsPayees = commissionsList.filter(c => c.statut === 'PAYEE').reduce((s, c) => s + c.montant, 0);
    const commissionsAttente = commissionsList.filter(c => c.statut === 'EN_ATTENTE').reduce((s, c) => s + c.montant, 0);
    const chiffreAffaires = clientsList.reduce((s, cl) => s + cl.leases.reduce((ls, l) => ls + l.montantInitial, 0), 0);

    res.json({
      ...referrer,
      clients: clientsList,
      commissions: commissionsList,
      stats: {
        nbClients: clientsList.length,
        totalCommissions,
        commissionsPayees,
        commissionsAttente,
        chiffreAffaires,
        nbCommissions: commissionsList.length
      }
    });
  } catch (error) {
    console.error('[referrers/:id] Erreur:', error.message, error.code);
    res.status(500).json({ message: 'Erreur lors de la récupération du détail', detail: error.message });
  }
});

// POST /api/commissions/referrers - Créer un apporteur
router.post('/referrers', verifyToken, isAdmin, async (req, res) => {
  try {
    const data = req.body;
    
    const referrer = await prisma.referrer.create({
      data: {
        nom: data.nom,
        prenom: data.prenom,
        contact: data.contact,
        email: data.email,
        photoUrl: data.photoUrl,
        adresse: data.adresse,
        tauxCommission: parseFloat(data.tauxCommission) || 5.0,
        typeCommission: data.typeCommission || 'POURCENTAGE',
        isActive: data.isActive !== undefined ? data.isActive : true
      }
    });

    res.status(201).json({ 
      message: 'Apporteur créé avec succès',
      referrer 
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la création' });
  }
});

// PUT /api/commissions/referrers/:id - Modifier un apporteur
router.put('/referrers/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const updateData = {
      nom: data.nom,
      prenom: data.prenom,
      contact: data.contact,
      email: data.email,
      photoUrl: data.photoUrl,
      adresse: data.adresse,
      tauxCommission: data.tauxCommission !== undefined ? parseFloat(data.tauxCommission) : undefined,
      typeCommission: data.typeCommission,
      isActive: data.isActive
    };

    // Supprimer les undefined
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) delete updateData[key];
    });

    const referrer = await prisma.referrer.update({
      where: { id: parseInt(id) },
      data: updateData
    });

    res.json({ 
      message: 'Apporteur modifié avec succès',
      referrer 
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la modification' });
  }
});

// DELETE /api/commissions/referrers/:id - Supprimer un apporteur
router.delete('/referrers/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.referrer.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Apporteur supprimé avec succès' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la suppression' });
  }
});

// ============================================
// ROUTES COMMISSIONS
// ============================================

// GET /api/commissions - Liste des commissions
router.get('/', verifyToken, async (req, res) => {
  try {
    const { referrerId, statut } = req.query;
    
    const where = {};
    if (referrerId) where.referrerId = parseInt(referrerId);
    if (statut) where.statut = statut;

    const commissions = await prisma.commission.findMany({
      where,
      include: {
        referrer: {
          select: { id: true, nom: true, prenom: true, photoUrl: true }
        },
        client: {
          select: { id: true, nom: true, prenom: true, type: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(commissions);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des commissions' });
  }
});

// POST /api/commissions - Créer une commission
router.post('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const { referrerId, clientId, montant, description } = req.body;
    
    const commission = await prisma.commission.create({
      data: {
        referrerId: parseInt(referrerId),
        clientId: parseInt(clientId),
        montant: parseFloat(montant),
        description,
        statut: 'EN_ATTENTE'
      },
      include: {
        referrer: { select: { nom: true, prenom: true } },
        client: { select: { nom: true, prenom: true } }
      }
    });

    res.status(201).json({ 
      message: 'Commission créée avec succès',
      commission 
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la création' });
  }
});

// PUT /api/commissions/:id/payer - Marquer une commission comme payée
router.put('/:id/payer', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const commission = await prisma.commission.update({
      where: { id: parseInt(id) },
      data: { 
        statut: 'PAYEE',
        datePaiement: new Date()
      }
    });

    res.json({ 
      message: 'Commission marquée comme payée',
      commission 
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors du paiement' });
  }
});

// DELETE /api/commissions/:id - Supprimer une commission
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.commission.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Commission supprimée avec succès' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la suppression' });
  }
});

// ============================================
// GÉNÉRATION PDF FICHE APPORTEUR
// ============================================

// GET /api/commissions/referrers/:id/pdf - Données pour fiche PDF
router.get('/referrers/:id/pdf', verifyToken, async (req, res) => {
  try {
    const rid = parseInt(req.params.id);

    // SQL brut — évite tout problème de mapping ORM
    const [referrers, clients, commissions] = await Promise.all([
      prisma.$queryRaw`
        SELECT id, nom, prenom, contact, email, "photoUrl", adresse,
               "tauxCommission", "typeCommission", "isActive", "createdAt"
        FROM public.referrers WHERE id = ${rid} LIMIT 1
      `,
      prisma.$queryRaw`
        SELECT c.id, c.nom, c.prenom, c.telephone, c.email, c.actif,
               l.id as "leaseId", l."numeroBail", l."montantInitial", l.statut as "leaseStatut"
        FROM public.clients c
        LEFT JOIN public.leases l ON l."clientId" = c.id
        WHERE c."temoinId" = ${rid}
        ORDER BY c.id
      `,
      prisma.$queryRaw`
        SELECT co.id, co.montant, co."datePaiement", co.statut, co.description, co."createdAt",
               cl.nom as "clientNom", cl.prenom as "clientPrenom"
        FROM public.commissions co
        LEFT JOIN public.clients cl ON cl.id = co."clientId"
        WHERE co."referrerId" = ${rid}
        ORDER BY co."createdAt" DESC
      `
    ]);

    if (!referrers || referrers.length === 0) {
      return res.status(404).json({ message: 'Apporteur non trouvé' });
    }

    const referrer = referrers[0];

    // Dédupliquer clients (un client peut avoir plusieurs baux)
    const clientsMap = {};
    clients.forEach(row => {
      if (!clientsMap[row.id]) {
        clientsMap[row.id] = { id: row.id, nom: row.nom, prenom: row.prenom, telephone: row.telephone, email: row.email, actif: row.actif, leases: [] };
      }
      if (row.leaseId) {
        clientsMap[row.id].leases.push({ id: row.leaseId, numeroBail: row.numeroBail, montantInitial: Number(row.montantInitial), statut: row.leaseStatut });
      }
    });
    const clientsList = Object.values(clientsMap);

    const commissionsList = commissions.map(c => ({
      id: c.id, montant: Number(c.montant), datePaiement: c.datePaiement,
      statut: c.statut, description: c.description, createdAt: c.createdAt,
      client: { nom: c.clientNom, prenom: c.clientPrenom }
    }));

    const totalCommissions = commissionsList.reduce((s, c) => s + c.montant, 0);
    const commissionsPayees = commissionsList.filter(c => c.statut === 'PAYEE').reduce((s, c) => s + c.montant, 0);
    const commissionsAttente = commissionsList.filter(c => c.statut === 'EN_ATTENTE').reduce((s, c) => s + c.montant, 0);

    res.json({
      data: {
        referrer,
        clients: clientsList,
        commissions: commissionsList,
        stats: {
          nbClients: clientsList.length,
          totalCommissions,
          commissionsPayees,
          commissionsAttente,
          nbCommissions: commissionsList.length
        }
      }
    });
  } catch (error) {
    console.error('[referrers/:id/pdf]', error.message, error.code);
    res.status(500).json({ message: 'Erreur lors de la génération PDF', detail: error.message });
  }
});

export default router;
