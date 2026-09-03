import express from 'express';
import prisma from '../lib/prisma.js';
import { verifyToken, canManageVisites, isAdmin } from '../middlewares/auth.middleware.js';

const router = express.Router()

const VISITE_FIELDS = ['dateVisite','nomVisiteur','prenomVisiteur','contact','email','bienVisiteId','motif','responsable','compteRendu','relanceSouhait','dateRelance','statutRelance','isDemo','creeParId']
const sanitizeVisite = (body) => {
  const d = {}
  for (const k of VISITE_FIELDS) {
    if (body[k] !== undefined && body[k] !== '') d[k] = body[k]
  }
  if (d.dateVisite) d.dateVisite = new Date(d.dateVisite)
  if (d.dateRelance) d.dateRelance = new Date(d.dateRelance)
  if (d.bienVisiteId) d.bienVisiteId = parseInt(d.bienVisiteId)
  if (d.creeParId) d.creeParId = parseInt(d.creeParId)
  if (d.relanceSouhait !== undefined) d.relanceSouhait = d.relanceSouhait === true || d.relanceSouhait === 'true'
  if (d.isDemo !== undefined) d.isDemo = d.isDemo === true || d.isDemo === 'true'
  return d
};


// ============================================
// ROUTES VISITES
// ============================================

// GET /api/visites - Liste des visites avec filtres
router.get('/', verifyToken, async (req, res) => {
  try {
    const { dateDebut, dateFin, motif, statutRelance, search, deletedAt } = req.query;
    
    const where = {};
    if (deletedAt === 'not.null') {
      where.deletedAt = { not: null };
    } else {
      where.deletedAt = null;
    }
    
    if (dateDebut && dateFin) {
      where.dateVisite = {
        gte: new Date(dateDebut),
        lte: new Date(dateFin)
      };
    }
    
    if (motif) where.motif = motif;
    if (statutRelance) where.statutRelance = statutRelance;
    
    if (search) {
      where.OR = [
        { nomVisiteur: { contains: search, mode: 'insensitive' } },
        { prenomVisiteur: { contains: search, mode: 'insensitive' } },
        { contact: { contains: search, mode: 'insensitive' } }
      ];
    }

    const { limit = 200 } = req.query;
    const take = Math.min(parseInt(limit) || 200, 500);

    const visites = await prisma.visite.findMany({
      where,
      orderBy: { dateVisite: 'desc' },
      take,
      include: { bienVisite: { select: { id: true, reference: true, titre: true } } }
    });

    res.json(visites);
  } catch (error) {
    res.json([]);
  }
});

// GET /api/visites/relances - Liste des relances à effectuer
router.get('/relances/en-attente', verifyToken, async (req, res) => {
  try {
    const relances = await prisma.visite.findMany({
      where: {
        relanceSouhait: true,
        statutRelance: 'EN_ATTENTE',
        dateRelance: { not: null }
      },
      orderBy: { dateRelance: 'asc' }
    });

    res.json(relances);
  } catch (error) {
    res.json([]);
  }
});

// GET /api/visites/:id - Détail d'une visite
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const visite = await prisma.visite.findUnique({
      where: { id: parseInt(id) }
    });

    if (!visite) {
      return res.status(404).json({ message: 'Visite non trouvée' });
    }

    res.json(visite);
  } catch (error) {
    res.json([]);
  }
});

// POST /api/visites - Créer une visite
router.post('/', verifyToken, canManageVisites, async (req, res) => {
  try {
    const data = sanitizeVisite(req.body)
    if (!data.nomVisiteur || !data.prenomVisiteur || !data.contact || !data.bienVisiteId) {
      return res.status(400).json({ message: 'nomVisiteur, prenomVisiteur, contact et bienVisiteId sont obligatoires' })
    }
    const visite = await prisma.visite.create({ data });
    res.status(201).json({ message: 'Visite enregistrée avec succès', id: visite.id, visite });
  } catch (error) {
    console.error('[POST /visites]', error.message);
    res.status(400).json({ message: 'Erreur lors de la création de la visite', detail: error.message });
  }
});

// PUT /api/visites/:id - Modifier une visite
router.put('/:id', verifyToken, canManageVisites, async (req, res) => {
  try {
    const { id } = req.params;
    const data = sanitizeVisite(req.body)
    const visite = await prisma.visite.update({ where: { id: parseInt(id) }, data });
    res.json({ message: 'Visite modifiée avec succès', visite });
  } catch (error) {
    console.error('[PUT /visites/:id]', error.message);
    res.status(400).json({ message: 'Erreur lors de la modification', detail: error.message });
  }
});

// PUT /api/visites/:id/relance/traiter - Marquer une relance comme traitée
router.put('/:id/relance/traiter', verifyToken, canManageVisites, async (req, res) => {
  try {
    const { id } = req.params;

    const visite = await prisma.visite.update({
      where: { id: parseInt(id) },
      data: { 
        statutRelance: 'EFFECTUEE',
        updatedAt: new Date()
      }
    });

    res.json({ 
      message: 'Relance marquée comme traitée',
      visite 
    });
  } catch (error) {
    res.json([]);
  }
});

// PATCH /api/visites/:id (Restauration ou archivage)
router.patch('/:id', verifyToken, canManageVisites, async (req, res) => {
  try {
    const { id } = req.params;
    const { deletedAt } = req.body;
    const visite = await prisma.visite.update({
      where: { id: parseInt(id) },
      data: { deletedAt: deletedAt === null ? null : new Date() }
    });
    res.json({ message: deletedAt === null ? 'Visite restaurée avec succès' : 'Visite placée dans la corbeille', visite });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour de la visite' });
  }
});

// DELETE /api/visites/:id
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { force } = req.query;
    if (force === 'true') {
      await prisma.visite.delete({ where: { id: parseInt(id) } });
    } else {
      await prisma.visite.update({ where: { id: parseInt(id) }, data: { deletedAt: new Date() } });
    }
    res.json({ message: force === 'true' ? 'Visite supprimée définitivement' : 'Visite placée dans la corbeille' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la suppression' });
  }
});

export default router;

