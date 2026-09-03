import prisma from '../lib/prisma.js';



// GET /api/buildings
export const getAllBuildings = async (req, res) => {
  try {
    const { type, commune, search, page = 1, limit = 20 } = req.query;
    const where = {};
    
    if (type) where.type = type;
    if (commune) where.commune = { contains: commune, mode: 'insensitive' };
    if (search) {
      where.OR = [
        { nom: { contains: search, mode: 'insensitive' } },
        { adresse: { contains: search, mode: 'insensitive' } },
        { commune: { contains: search, mode: 'insensitive' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [buildings, total] = await Promise.all([
      prisma.building.findMany({
        where,
        include: {
          unites: {
            select: {
              id: true,
              numeroPorte: true,
              typeUnite: true,
              statut: true,
              loyerBase: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.building.count({ where })
    ]);

    // Calculer les stats pour chaque immeuble
    const buildingsWithStats = buildings.map(building => {
      const totalUnites = building.unites.length;
      const unitesOccupees = building.unites.filter(u => u.statut === 'OCCUPE').length;
      const unitesReservees = building.unites.filter(u => u.statut === 'RESERVE').length;
      const tauxOccupation = totalUnites > 0 ? ((unitesOccupees / totalUnites) * 100).toFixed(1) : 0;
      const loyerTotal = building.unites.reduce((sum, u) => sum + (u.loyerBase || 0), 0);

      return {
        ...building,
        stats: {
          totalUnites,
          unitesOccupees,
          unitesReservees,
          unitesVacantes: totalUnites - unitesOccupees - unitesReservees,
          tauxOccupation,
          loyerTotal
        }
      };
    });

    res.json({
      data: buildingsWithStats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des immeubles', error: error.message });
  }
};

// GET /api/buildings/stats
export const getBuildingsStats = async (req, res) => {
  try {
    const [total, parType, totalUnites, unitesParStatut] = await Promise.all([
      prisma.building.count(),
      prisma.building.groupBy({ by: ['type'], _count: { type: true } }),
      prisma.unite.count(),
      prisma.unite.groupBy({ by: ['statut'], _count: { statut: true } })
    ]);

    const valeurTotale = await prisma.building.aggregate({
      _sum: { valeurEstimee: true }
    });

    res.json({
      total,
      parType,
      totalUnites,
      unitesParStatut,
      valeurTotale: valeurTotale._sum.valeurEstimee || 0
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors des statistiques', error: error.message });
  }
};

// GET /api/buildings/:id
export const getBuildingById = async (req, res) => {
  try {
    const { id } = req.params;
    const building = await prisma.building.findUnique({
      where: { id: parseInt(id) },
      include: {
        unites: {
          orderBy: [{ etage: 'asc' }, { numeroPorte: 'asc' }]
        }
      }
    });

    if (!building) {
      return res.status(404).json({ message: 'Immeuble non trouvé' });
    }

    // Calculer les stats
    const totalUnites = building.unites.length;
    const unitesOccupees = building.unites.filter(u => u.statut === 'OCCUPE').length;
    const unitesReservees = building.unites.filter(u => u.statut === 'RESERVE').length;
    const tauxOccupation = totalUnites > 0 ? ((unitesOccupees / totalUnites) * 100).toFixed(1) : 0;
    const loyerTotal = building.unites.reduce((sum, u) => sum + (u.loyerBase || 0), 0);

    res.json({
      ...building,
      stats: {
        totalUnites,
        unitesOccupees,
        unitesReservees,
        unitesVacantes: totalUnites - unitesOccupees - unitesReservees,
        tauxOccupation,
        loyerTotal
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération de l\'immeuble', error: error.message });
  }
};

const BUILDING_FIELDS = ['nom','type','adresse','commune','ville','nombreEtages','valeurEstimee','droitsTerre','chargesAnnexes','dateAcquisition','notes','isDemo']

const sanitizeBuilding = (body) => {
  const d = {}
  for (const k of BUILDING_FIELDS) {
    if (body[k] !== undefined && body[k] !== '') d[k] = body[k]
  }
  if (d.dateAcquisition) d.dateAcquisition = new Date(d.dateAcquisition)
  if (d.nombreEtages !== undefined) d.nombreEtages = parseInt(d.nombreEtages)
  if (d.valeurEstimee !== undefined) d.valeurEstimee = parseFloat(d.valeurEstimee)
  if (d.chargesAnnexes !== undefined) d.chargesAnnexes = parseFloat(d.chargesAnnexes)
  if (d.isDemo !== undefined) d.isDemo = d.isDemo === true || d.isDemo === 'true'
  return d
}

// POST /api/buildings
export const createBuilding = async (req, res) => {
  try {
    const data = sanitizeBuilding(req.body)

    if (!data.nom || !data.type || !data.adresse || !data.commune) {
      return res.status(400).json({ message: 'Nom, type, adresse et commune sont obligatoires' })
    }

    const building = await prisma.building.create({
      data,
      include: { unites: true }
    });

    res.status(201).json({ message: 'Immeuble créé avec succès', id: building.id, building });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la création de l\'immeuble', error: error.message });
  }
};

// PUT /api/buildings/:id
export const updateBuilding = async (req, res) => {
  try {
    const { id } = req.params;
    const data = sanitizeBuilding(req.body)

    const building = await prisma.building.update({
      where: { id: parseInt(id) },
      data,
      include: { unites: true }
    });

    res.json({ message: 'Immeuble mis à jour avec succès', building });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour de l\'immeuble', error: error.message });
  }
};

// DELETE /api/buildings/:id
export const deleteBuilding = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.building.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Immeuble supprimé avec succès' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la suppression de l\'immeuble', error: error.message });
  }
};

// GET /api/buildings/:id/pdf
export const generateBuildingPDF = async (req, res) => {
  try {
    const { id } = req.params;
    
    const building = await prisma.building.findUnique({
      where: { id: parseInt(id) },
      include: {
        unites: {
          orderBy: [{ etage: 'asc' }, { numeroPorte: 'asc' }]
        }
      }
    });

    if (!building) {
      return res.status(404).json({ message: 'Immeuble non trouvé' });
    }

    res.json({
      message: 'Données de la fiche récupérées',
      data: building,
      pdfTemplate: 'building'
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la génération PDF', error: error.message });
  }
};

// ============================================
// CONTRÔLEURS POUR LES UNITÉS
// ============================================

// GET /api/buildings/:id/unites
export const getUnitesByBuilding = async (req, res) => {
  try {
    const { id } = req.params;
    const unites = await prisma.unite.findMany({
      where: { buildingId: parseInt(id) },
      orderBy: [{ etage: 'asc' }, { numeroPorte: 'asc' }]
    });
    console.log(`[getUnitesByBuilding] Building ${id}: ${unites.length} unités trouvées`);
    res.json({ data: unites, count: unites.length });
  } catch (error) {
    console.error('[getUnitesByBuilding] Erreur:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des unités', error: error.message });
  }
};

// POST /api/buildings/:id/unites
export const createUnite = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    
    console.log(`[createUnite] Création unité pour building ${id}:`, data);
    
    const unite = await prisma.unite.create({
      data: {
        ...data,
        buildingId: parseInt(id)
      }
    });

    console.log(`[createUnite] Unité créée avec succès:`, unite);
    res.status(201).json({ message: 'Unité créée avec succès', data: unite });
  } catch (error) {
    console.error('[createUnite] Erreur:', error);
    res.status(500).json({ message: 'Erreur lors de la création de l\'unité', error: error.message });
  }
};

// PUT /api/buildings/:buildingId/unites/:uniteId
export const updateUnite = async (req, res) => {
  try {
    const { uniteId } = req.params;
    const data = req.body;

    const unite = await prisma.unite.update({
      where: { id: parseInt(uniteId) },
      data
    });

    res.json({ message: 'Unité mise à jour avec succès', unite });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour de l\'unité', error: error.message });
  }
};

// DELETE /api/buildings/:buildingId/unites/:uniteId
export const deleteUnite = async (req, res) => {
  try {
    const { uniteId } = req.params;
    await prisma.unite.delete({ where: { id: parseInt(uniteId) } });
    res.json({ message: 'Unité supprimée avec succès' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la suppression de l\'unité', error: error.message });
  }
};

// PUT /api/buildings/:buildingId/unites/:uniteId/statut
export const updateUniteStatut = async (req, res) => {
  try {
    const { uniteId } = req.params;
    const { statut } = req.body;

    const unite = await prisma.unite.update({
      where: { id: parseInt(uniteId) },
      data: { statut }
    });

    res.json({ message: 'Statut mis à jour avec succès', unite });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour du statut', error: error.message });
  }
};
