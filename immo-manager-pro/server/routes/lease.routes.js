import express from 'express';
import prisma from '../lib/prisma.js';
import { verifyToken, canManageContrats } from '../middlewares/auth.middleware.js';
import { validateBody } from '../middlewares/validate.js';
import { createLeaseSchema, updateLeaseSchema } from '../validations/schemas.js';
import { audit } from '../middlewares/audit.js';
import { invalidateDashboard, getOrCompute, CACHE_KEYS } from '../lib/cache.js';

const router = express.Router();


// Fonction pour générer un numéro de bail unique garanti sans collision
const generateNumeroBail = async () => {
  const year = new Date().getFullYear();
  const prefix = `BAIL-${year}-`;
  
  const leasesThisYear = await prisma.lease.findMany({
    where: {
      numeroBail: {
        startsWith: prefix
      }
    },
    select: { numeroBail: true }
  });

  let maxSeq = 0;
  for (const l of leasesThisYear) {
    if (l.numeroBail) {
      const parts = l.numeroBail.split('-');
      const num = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  }

  let nextSeq = maxSeq + 1;
  let candidate = `${prefix}${String(nextSeq).padStart(5, '0')}`;

  while (await prisma.lease.findUnique({ where: { numeroBail: candidate } })) {
    nextSeq++;
    candidate = `${prefix}${String(nextSeq).padStart(5, '0')}`;
  }

  return candidate;
};

// GET /api/leases/stats/overview - ⚠️ DOIT être avant /:id sinon jamais atteint
router.get('/stats/overview', verifyToken, async (req, res) => {
  try {
    const data = await getOrCompute(CACHE_KEYS.LEASES_STATS, async () => {
      const [total, parStatut, totalMontants] = await Promise.all([
        prisma.lease.count(),
        prisma.lease.groupBy({ by: ['statut'], _count: { statut: true } }),
        prisma.lease.aggregate({
          _sum: { montantInitial: true, caution: true }
        })
      ]);
      return { total, parStatut, montants: totalMontants._sum };
    }, 120); // Cache 2 minutes
    res.json(data);
  } catch (error) {
    console.error('[GET /leases/stats]', error);
    res.status(500).json({ message: 'Erreur lors des statistiques' });
  }
});

// GET /api/leases - Liste des baux (optimisée : pas de payments massifs en liste)
router.get('/', verifyToken, async (req, res) => {
  try {
    const { statut, search, clientId, limit = 300, deletedAt } = req.query;
    const take = Math.min(parseInt(limit) || 300, 500);

    // Cache uniquement pour la requête sans filtre ni recherche (cas le plus fréquent)
    const cacheKey = !search && !statut && !clientId && !deletedAt
      ? `${CACHE_KEYS.LEASES_LIST}:default:${take}`
      : null;

    const fetchLeases = async () => {
      const where = {};
      if (deletedAt === 'not.null') {
        where.deletedAt = { not: null };
      } else {
        where.deletedAt = null;
      }
      if (statut) where.statut = statut;
      if (clientId) where.clientId = parseInt(clientId);
      if (search) {
        where.OR = [
          { numeroBail: { contains: search, mode: 'insensitive' } },
          { client: { nom:    { contains: search, mode: 'insensitive' } } },
          { client: { prenom: { contains: search, mode: 'insensitive' } } }
        ];
      }

      const leases = await prisma.lease.findMany({
        where,
        include: {
          client:   { select: { id: true, nom: true, prenom: true, telephone: true, type: true } },
          unite:    { select: { id: true, numeroPorte: true, typeUnite: true } },
          building: { select: { id: true, nom: true } },
          _count:   { select: { payments: true } },
          payments: { select: { montantVerse: true } }
        },
        orderBy: { createdAt: 'desc' },
        take
      });

      return leases.map(lease => {
        const totalPaye = lease.payments.reduce((s, p) => s + (p.montantVerse || 0), 0);
        const resteDu   = Math.max(0, (lease.montantInitial || 0) - totalPaye);
        const progression = lease.montantInitial > 0
          ? ((totalPaye / lease.montantInitial) * 100).toFixed(1) : 0;
        const { payments, ...leaseData } = lease;
        return { ...leaseData, calculs: { totalPaye, resteDu, progression, nbPaiements: lease._count.payments } };
      });
    };

    const result = cacheKey
      ? await getOrCompute(cacheKey, fetchLeases, 60) // Cache 60s pour la liste principale
      : await fetchLeases();

    res.json(result);
  } catch (error) {
    console.error('[GET /leases]', error.message);
    res.status(500).json({ message: 'Erreur lors de la récupération des baux' });
  }
});

// GET /api/leases/:id - Détail d'un bail
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const lease = await prisma.lease.findUnique({
      where: { id: parseInt(id) },
      include: {
        client: true,
        payments: {
          include: {
            agent: {
              select: { prenom: true, nom: true }
            }
          },
          orderBy: { datePaiement: 'desc' }
        },
        factures: {
          orderBy: { dateGeneration: 'desc' }
        }
      }
    });

    if (!lease) {
      return res.status(404).json({ message: 'Bail non trouvé' });
    }

    // Calculer les totaux
    const totalPaye = lease.payments.reduce((sum, p) => sum + p.montantVerse, 0);
    const resteDu = lease.montantInitial - totalPaye;
    const progression = lease.montantInitial > 0 
      ? ((totalPaye / lease.montantInitial) * 100).toFixed(1) 
      : 0;

    res.json({
      ...lease,
      calculs: {
        totalPaye,
        resteDu,
        progression
      }
    });
  } catch (error) {
    console.error('[GET /leases/:id]', error);
    res.status(500).json({ message: 'Erreur lors de la récupération du bail' });
  }
});

// POST /api/leases - Créer un bail
router.post('/', verifyToken, canManageContrats, audit('lease', 'CREATE'), async (req, res) => {
  try {
    const data = req.body;
    console.log('[POST /leases] Données reçues:', JSON.stringify(data, null, 2));

    if (!data.clientId) {
      return res.status(400).json({ message: 'Veuillez sélectionner un client.' });
    }
    if (!data.buildingId) {
      return res.status(400).json({ message: 'Veuillez sélectionner un immeuble.' });
    }
    if (!data.uniteId) {
      return res.status(400).json({ message: 'Veuillez sélectionner une unité (porte).' });
    }
    const montantInit = parseFloat(data.montantInitial);
    if (isNaN(montantInit) || montantInit <= 0) {
      return res.status(400).json({ message: 'Le montant initial doit être supérieur à 0 FCFA.' });
    }
    if (!data.dateDebut) {
      return res.status(400).json({ message: 'La date de signature ou de début est requise.' });
    }

    // Valeurs validées
    const clientId     = parseInt(data.clientId);
    const buildingId   = parseInt(data.buildingId);
    const uniteId      = parseInt(data.uniteId);
    const montantLoyer = parseFloat(data.montantLoyer) || 0;
    const caution      = parseFloat(data.caution) || 0;
    const dateDebut    = new Date(data.dateDebut);
    const dateFin      = data.dateFin ? new Date(data.dateFin) : null;

    // Normalisation stricte du statut pour l'ENUM PostgreSQL StatutLease ('ACTIF', 'TERMINE', 'RESILIE')
    let statut = 'ACTIF';
    if (data.statut) {
      const upper = String(data.statut).toUpperCase();
      if (['ACTIF', 'TERMINE', 'RESILIE'].includes(upper)) {
        statut = upper;
      } else if (upper === 'EN_COURS') {
        statut = 'ACTIF';
      } else if (upper === 'EXPIRE') {
        statut = 'TERMINE';
      }
    }

    // Vérifier si l'unité est déjà occupée par un autre bail actif
    const existingActiveLease = await prisma.lease.findFirst({
      where: {
        uniteId,
        statut: 'ACTIF',
        deletedAt: null
      },
      include: {
        client: { select: { nom: true, prenom: true } }
      }
    });

    if (existingActiveLease) {
      const locataireNom = existingActiveLease.client ? `${existingActiveLease.client.prenom || ''} ${existingActiveLease.client.nom || ''}`.trim() : 'un autre client';
      return res.status(400).json({ 
        message: `Cette unité/porte est déjà occupée par un bail actif (${existingActiveLease.numeroBail} - ${locataireNom}). Veuillez libérer la porte ou en choisir une autre.` 
      });
    }

    // Générer numéro de bail unique garanti sans collision
    const numeroBail = await generateNumeroBail();
    console.log('[POST /leases] Numéro bail généré:', numeroBail);

    // INSERT via SQL brut avec gestion de montantLoyer et StatutLease
    const sql = 'INSERT INTO public.leases ("numeroBail","clientId","buildingId","uniteId","montantInitial","caution","montantLoyer","dateDebut","dateFin","statut","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::"StatutLease",NOW(),NOW()) RETURNING *';
    const result = await prisma.$queryRawUnsafe(
      sql,
      numeroBail, clientId, buildingId, uniteId,
      montantInit, caution, montantLoyer, dateDebut, dateFin, statut
    );

    const lease = result[0];
    console.log('[POST /leases] Bail créé avec succès, ID:', lease.id);

    // Mettre à jour le statut de l'unité en OCCUPE si le bail est actif
    if (statut === 'ACTIF' && uniteId) {
      await prisma.unite.update({
        where: { id: uniteId },
        data: { statut: 'OCCUPE' }
      }).catch(err => console.warn('[POST /leases] Notification statut unité:', err.message));
    }

    try { await req.audit({ recordId: lease.id, newData: lease }); } catch (_) {}
    invalidateDashboard();

    res.status(201).json({ message: 'Bail créé avec succès', lease });
  } catch (error) {
    console.error('[POST /leases] ERREUR:', error.message, error.code);
    if (error.code === 'P2002' || error.code === '23505') {
      return res.status(400).json({ message: 'Un bail avec ce numéro existe déjà. Veuillez réessayer.' });
    }
    if (error.code === '23503') {
      return res.status(400).json({ message: 'Client, immeuble ou unité introuvable. Vérifiez les sélections.' });
    }
    if (error.code === '23502') {
      return res.status(400).json({ message: 'Informations obligatoires manquantes (client, immeuble ou unité requis).' });
    }
    if (error.code === '22P02') {
      return res.status(400).json({ message: 'Format de statut ou de données invalide pour la base de données.' });
    }
    res.status(500).json({ message: 'Erreur lors de la création du bail', details: error.message });
  }
});


// PUT /api/leases/:id - Modifier un bail
router.put('/:id', verifyToken, canManageContrats, validateBody(updateLeaseSchema), audit('lease', 'UPDATE'), async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const oldLease = await prisma.lease.findUnique({ where: { id: parseInt(id) } });

    if (data.dateDebut) data.dateDebut = new Date(data.dateDebut);
    if (data.dateFin) data.dateFin = new Date(data.dateFin);

    const lease = await prisma.lease.update({
      where: { id: parseInt(id) },
      data,
      include: {
        client: true,
        payments: true
      }
    });

    await req.audit({ recordId: lease.id, oldData: oldLease, newData: lease });
    invalidateDashboard();

    res.json({ 
      message: 'Bail modifié avec succès',
      lease 
    });
  } catch (error) {
    console.error('[PUT /leases/:id]', error);
    res.status(500).json({ message: 'Erreur lors de la modification du bail' });
  }
});

// PUT /api/leases/:id/prise-possession - Valider la remise des clés
router.put('/:id/prise-possession', verifyToken, canManageContrats, audit('lease', 'UPDATE'), async (req, res) => {
  try {
    const { id } = req.params;
    const { dateEntree, dureeMois } = req.body;
    
    if (!dateEntree) return res.status(400).json({ message: 'La date d\'entrée est requise' });

    const entreeDate = new Date(dateEntree);
    
    // Calcul de la date de fin
    let dateFin = null;
    if (dureeMois) {
      dateFin = new Date(entreeDate);
      dateFin.setMonth(dateFin.getMonth() + parseInt(dureeMois));
    }

    const oldLease = await prisma.lease.findUnique({ where: { id: parseInt(id) } });

    const lease = await prisma.lease.update({
      where: { id: parseInt(id) },
      data: {
        dateEntree: entreeDate,
        dateFin: dateFin || oldLease.dateFin
      },
      include: { client: true }
    });

    await req.audit({ recordId: lease.id, oldData: oldLease, newData: lease });
    invalidateDashboard();

    res.json({
      message: 'Prise de possession validée, le recouvrement démarre.',
      lease
    });
  } catch (error) {
    console.error('[PUT /leases/:id/prise-possession]', error);
    res.status(500).json({ message: 'Erreur lors de la validation de la remise des clés' });
  }
});

// PUT /api/leases/:id/statut - Changer le statut d'un bail
router.put('/:id/statut', verifyToken, canManageContrats, async (req, res) => {
  try {
    const { id } = req.params;
    const { statut } = req.body;
    const VALID_STATUTS = ['ACTIF', 'TERMINE', 'RESILIE', 'actif', 'en_cours', 'expire', 'resilie'];
    if (!statut || !VALID_STATUTS.includes(statut)) {
      return res.status(400).json({ message: 'Statut invalide. Valeurs acceptées : ACTIF, TERMINE, RESILIE' });
    }

    const lease = await prisma.lease.update({
      where: { id: parseInt(id) },
      data: { statut },
      include: {
        client: true
      }
    });

    res.json({ 
      message: `Bail marqué comme ${statut.toLowerCase()}`,
      lease 
    });
  } catch (error) {
    console.error('[PUT /leases/:id/statut]', error);
    res.status(500).json({ message: 'Erreur lors du changement de statut' });
  }
});

// PATCH /api/leases/:id
router.patch('/:id', verifyToken, canManageContrats, async (req, res) => {
  try {
    const { id } = req.params;
    const { deletedAt } = req.body;
    const lease = await prisma.lease.update({
      where: { id: parseInt(id) },
      data: { deletedAt: deletedAt === null ? null : new Date() }
    });
    invalidateDashboard();
    res.json({ message: deletedAt === null ? 'Bail restauré avec succès' : 'Bail placé dans la corbeille', lease });
  } catch (error) {
    console.error('[PATCH /leases/:id]', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du bail' });
  }
});

// DELETE /api/leases/:id
router.delete('/:id', verifyToken, canManageContrats, audit('lease', 'DELETE'), async (req, res) => {
  try {
    const { id } = req.params;
    const { force } = req.query;
    const oldLease = await prisma.lease.findUnique({ where: { id: parseInt(id) } });

    if (force === 'true') {
      await prisma.lease.delete({ where: { id: parseInt(id) } });
    } else {
      await prisma.lease.update({ where: { id: parseInt(id) }, data: { deletedAt: new Date() } });
    }

    await req.audit({ recordId: parseInt(id), oldData: oldLease });
    invalidateDashboard();
    res.json({ message: force === 'true' ? 'Bail supprimé avec succès' : 'Bail placé dans la corbeille' });
  } catch (error) {
    console.error('[DELETE /leases/:id]', error);
    res.status(500).json({ message: 'Erreur lors de la suppression' });
  }
});

export default router;
