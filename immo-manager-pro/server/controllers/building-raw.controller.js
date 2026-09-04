import prisma from '../lib/prisma.js';

// GET /api/buildings - Version SQL raw pour contourner les problèmes de synchronisation Prisma
export const getAllBuildings = async (req, res) => {
  try {
    const { type, commune, search, page = 1, limit = 20, deletedAt } = req.query;
    
    // Construction de la requête SQL de base
    let sql = `
      SELECT 
        b.id, b.nom, b.type, b.adresse, b.commune, b.ville, 
        b."nombreEtages", b."valeurEstimee", b."droitsTerre", 
        b."chargesAnnexes", b.notes, b.is_demo, b."createdAt", b."updatedAt"
      FROM public.buildings b
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (deletedAt === 'not.null') {
      sql += ` AND b."deletedAt" IS NOT NULL`;
    } else {
      sql += ` AND b."deletedAt" IS NULL`;
    }
    
    if (type) {
      sql += ` AND b.type = $${paramIndex}::"TypeBuilding"`;
      params.push(type);
      paramIndex++;
    }
    
    if (commune) {
      sql += ` AND b.commune ILIKE $${paramIndex}`;
      params.push(`%${commune}%`);
      paramIndex++;
    }
    
    if (search) {
      sql += ` AND (b.nom ILIKE $${paramIndex} OR b.adresse ILIKE $${paramIndex} OR b.commune ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    // Compter le total avec une requête COUNT dédiée propre et performante
    let countSql = `SELECT COUNT(*)::INTEGER as total FROM public.buildings b WHERE 1=1`;
    const countParams = [];
    let countIndex = 1;
    if (deletedAt === 'not.null') {
      countSql += ` AND b."deletedAt" IS NOT NULL`;
    } else {
      countSql += ` AND b."deletedAt" IS NULL`;
    }
    if (type) {
      countSql += ` AND b.type = $${countIndex}::"TypeBuilding"`;
      countParams.push(type);
      countIndex++;
    }
    if (commune) {
      countSql += ` AND b.commune ILIKE $${countIndex}`;
      countParams.push(`%${commune}%`);
      countIndex++;
    }
    if (search) {
      countSql += ` AND (b.nom ILIKE $${countIndex} OR b.adresse ILIKE $${countIndex} OR b.commune ILIKE $${countIndex})`;
      countParams.push(`%${search}%`);
      countIndex++;
    }
    const countResult = await prisma.$queryRawUnsafe(countSql, ...countParams);
    const total = parseInt(countResult[0]?.total || 0);
    
    // Ajouter pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    sql += ` ORDER BY b."createdAt" DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), offset);
    
    // Exécuter la requête
    const buildings = await prisma.$queryRawUnsafe(sql, ...params);
    
    // Récupérer les unités pour chaque bâtiment
    const buildingsWithStats = await Promise.all(
      buildings.map(async (building) => {
        const unites = await prisma.$queryRaw`
          SELECT id, "numeroPorte", "typeUnite", statut, "loyerBase"
          FROM public.unites
          WHERE "buildingId" = ${building.id}
        `;
        
        const totalUnites = unites.length;
        const unitesOccupees = unites.filter(u => u.statut === 'OCCUPE').length;
        const unitesReservees = unites.filter(u => u.statut === 'RESERVE').length;
        const tauxOccupation = totalUnites > 0 ? ((unitesOccupees / totalUnites) * 100).toFixed(1) : 0;
        const loyerTotal = unites.reduce((sum, u) => sum + (parseFloat(u.loyerBase) || 0), 0);
        
        return {
          ...building,
          unites,
          stats: {
            totalUnites,
            unitesOccupees,
            unitesReservees,
            unitesVacantes: totalUnites - unitesOccupees - unitesReservees,
            tauxOccupation,
            loyerTotal
          }
        };
      })
    );
    
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
    console.error('Erreur getAllBuildings:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des immeubles', error: error.message });
  }
};

// GET /api/buildings/:id
export const getBuildingById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const buildingResult = await prisma.$queryRaw`
      SELECT * FROM public.buildings WHERE id = ${parseInt(id)} LIMIT 1
    `;
    
    if (!buildingResult || buildingResult.length === 0) {
      return res.status(404).json({ message: 'Immeuble non trouvé' });
    }
    
    const building = buildingResult[0];
    
    // Récupérer les unités
    const unites = await prisma.$queryRaw`
      SELECT * FROM public.unites WHERE "buildingId" = ${parseInt(id)} ORDER BY etage, "numeroPorte"
    `;
    
    // Récupérer les baux associés
    const leases = await prisma.$queryRaw`
      SELECT l.*, c.nom as client_nom, c.prenom as client_prenom
      FROM public.leases l
      JOIN public.clients c ON l."clientId" = c.id
      WHERE l."buildingId" = ${parseInt(id)}
    `;
    
    res.json({
      ...building,
      unites,
      leases
    });
  } catch (error) {
    console.error('Erreur getBuildingById:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération de l\'immeuble', error: error.message });
  }
};

// POST /api/buildings
export const createBuilding = async (req, res) => {
  try {
    const { nom, type, adresse, commune, ville, nombreEtages, valeurEstimee, droitsTerre, chargesAnnexes, notes } = req.body;
    
    const result = await prisma.$queryRaw`
      INSERT INTO public.buildings (nom, type, adresse, commune, ville, "nombreEtages", "valeurEstimee", "droitsTerre", "chargesAnnexes", notes, is_demo, "createdAt", "updatedAt")
      VALUES (${nom}, ${type}::"TypeBuilding", ${adresse}, ${commune}, ${ville || 'Abidjan'}, ${nombreEtages || 1}, ${valeurEstimee || null}, ${droitsTerre || null}, ${chargesAnnexes || null}, ${notes || null}, false, NOW(), NOW())
      RETURNING *
    `;
    
    res.status(201).json(result[0]);
  } catch (error) {
    console.error('Erreur createBuilding:', error);
    res.status(500).json({ message: 'Erreur lors de la création de l\'immeuble', error: error.message });
  }
};

// PUT /api/buildings/:id
export const updateBuilding = async (req, res) => {
  try {
    const { id } = req.params;
    const { nom, type, adresse, commune, ville, nombreEtages, valeurEstimee, droitsTerre, chargesAnnexes, notes } = req.body;
    
    const result = await prisma.$queryRaw`
      UPDATE public.buildings 
      SET nom = ${nom}, type = ${type}::"TypeBuilding", adresse = ${adresse}, commune = ${commune}, 
          ville = ${ville}, "nombreEtages" = ${nombreEtages}, "valeurEstimee" = ${valeurEstimee}, 
          "droitsTerre" = ${droitsTerre}, "chargesAnnexes" = ${chargesAnnexes}, notes = ${notes}, "updatedAt" = NOW()
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;
    
    if (!result || result.length === 0) {
      return res.status(404).json({ message: 'Immeuble non trouvé' });
    }
    
    res.json(result[0]);
  } catch (error) {
    console.error('Erreur updateBuilding:', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour de l\'immeuble', error: error.message });
  }
};

// DELETE /api/buildings/:id (Supporte soft delete ou purge avec ?force=true)
export const deleteBuilding = async (req, res) => {
  try {
    const { id } = req.params;
    const { force } = req.query;
    
    let result;
    if (force === 'true') {
      await prisma.$executeRaw`DELETE FROM public.leases WHERE "buildingId" = ${parseInt(id)}`;
      result = await prisma.$queryRaw`
        DELETE FROM public.buildings WHERE id = ${parseInt(id)} RETURNING *
      `;
    } else {
      result = await prisma.$queryRaw`
        UPDATE public.buildings SET "deletedAt" = NOW() WHERE id = ${parseInt(id)} RETURNING *
      `;
    }
    
    if (!result || result.length === 0) {
      return res.status(404).json({ message: 'Immeuble non trouvé' });
    }
    
    res.json({ message: force === 'true' ? 'Immeuble supprimé définitivement' : 'Immeuble placé dans la corbeille' });
  } catch (error) {
    console.error('Erreur deleteBuilding:', error);
    res.status(500).json({ message: 'Erreur lors de la suppression de l\'immeuble', error: error.message });
  }
};

// PATCH /api/buildings/:id (Restauration ou mise à jour partielle)
export const patchBuilding = async (req, res) => {
  try {
    const { id } = req.params;
    const { deletedAt } = req.body;
    
    let result;
    if (deletedAt === null) {
      result = await prisma.$queryRaw`
        UPDATE public.buildings SET "deletedAt" = NULL WHERE id = ${parseInt(id)} RETURNING *
      `;
      return res.json({ message: 'Immeuble restauré avec succès', building: result[0] });
    } else if (deletedAt) {
      result = await prisma.$queryRaw`
        UPDATE public.buildings SET "deletedAt" = NOW() WHERE id = ${parseInt(id)} RETURNING *
      `;
      return res.json({ message: 'Immeuble placé dans la corbeille', building: result[0] });
    }
    
    res.json({ message: 'Aucune modification' });
  } catch (error) {
    console.error('Erreur patchBuilding:', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour de l\'immeuble', error: error.message });
  }
};

// GET /api/buildings/:id/pdf - Générer fiche PDF
export const generateBuildingPDF = async (req, res) => {
  try {
    const { id } = req.params;
    
    const buildingResult = await prisma.$queryRaw`
      SELECT * FROM public.buildings WHERE id = ${parseInt(id)} LIMIT 1
    `;
    
    if (!buildingResult || buildingResult.length === 0) {
      return res.status(404).json({ message: 'Immeuble non trouvé' });
    }
    
    const building = buildingResult[0];
    
    const unites = await prisma.$queryRaw`
      SELECT * FROM public.unites WHERE "buildingId" = ${parseInt(id)} ORDER BY "numeroPorte" ASC
    `;
    
    // Calculer les statistiques
    const stats = {
      totalUnites: unites.length,
      disponibles: unites.filter(u => u.statut === 'VACANT').length,
      louees: unites.filter(u => u.statut === 'OCCUPE').length,
      reservees: unites.filter(u => u.statut === 'RESERVE').length,
      enTravaux: 0
    };
    
    res.json({ building, stats, unites });
    
  } catch (error) {
    console.error('Erreur génération PDF immeuble:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la génération du PDF',
      error: error.message 
    });
  }
};

// GET /api/buildings/stats
export const getBuildingsStats = async (req, res) => {
  try {
    const stats = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as total_buildings,
        COUNT(CASE WHEN type = 'R2' THEN 1 END) as r2_count,
        COUNT(CASE WHEN type = 'R3' THEN 1 END) as r3_count,
        COUNT(CASE WHEN type = 'R4' THEN 1 END) as r4_count,
        COUNT(CASE WHEN type = 'VILLA' THEN 1 END) as villa_count,
        COUNT(CASE WHEN type = 'COUR_COMMUNE' THEN 1 END) as cour_count,
        SUM("valeurEstimee") as valeur_totale,
        SUM("chargesAnnexes") as charges_totales
      FROM public.buildings
    `;
    
    const unitesStats = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as total_unites,
        COUNT(CASE WHEN statut = 'VACANT' THEN 1 END) as vacantes,
        COUNT(CASE WHEN statut = 'OCCUPE' THEN 1 END) as occupees,
        COUNT(CASE WHEN statut = 'RESERVE' THEN 1 END) as reservees,
        SUM("loyerBase") as loyer_total
      FROM public.unites
    `;
    
    res.json({
      buildings: stats[0],
      unites: unitesStats[0]
    });
  } catch (error) {
    console.error('Erreur getBuildingsStats:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des statistiques', error: error.message });
  }
};

export default {
  getAllBuildings,
  getBuildingById,
  createBuilding,
  updateBuilding,
  deleteBuilding,
  patchBuilding,
  getBuildingsStats
};
