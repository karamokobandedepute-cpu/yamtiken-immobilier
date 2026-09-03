import prisma from '../lib/prisma.js';



// GET /api/visites
export const getAllVisites = async (req, res) => {
  try {
    const { statut, page = 1, limit = 20 } = req.query;
    const where = {};
    
    if (statut) where.statut = statut;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [visites, total] = await Promise.all([
      prisma.visite.findMany({
        where,
        include: {
          bien: { select: { id: true, reference: true, titre: true, adresse: true } },
          client: { select: { id: true, nom: true, prenom: true, telephone: true } },
          creePar: { select: { id: true, nom: true, prenom: true } }
        },
        orderBy: { dateVisite: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.visite.count({ where })
    ]);

    res.json({
      data: visites,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des visites', error: error.message });
  }
};

// GET /api/visites/calendrier
export const getVisitesForCalendar = async (req, res) => {
  try {
    const { start, end } = req.query;
    
    const where = {};
    if (start && end) {
      where.dateVisite = {
        gte: new Date(start),
        lte: new Date(end)
      };
    }

    const visites = await prisma.visite.findMany({
      where,
      include: {
        bien: { select: { id: true, reference: true, titre: true } },
        client: { select: { id: true, nom: true, prenom: true, telephone: true } }
      },
      orderBy: { dateVisite: 'asc' }
    });

    res.json(visites);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des visites', error: error.message });
  }
};

// GET /api/visites/:id
export const getVisiteById = async (req, res) => {
  try {
    const { id } = req.params;
    const visite = await prisma.visite.findUnique({
      where: { id: parseInt(id) },
      include: {
        bien: true,
        client: true,
        creePar: { select: { id: true, nom: true, prenom: true } }
      }
    });

    if (!visite) {
      return res.status(404).json({ message: 'Visite non trouvée' });
    }

    res.json(visite);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération de la visite', error: error.message });
  }
};

// POST /api/visites
export const createVisite = async (req, res) => {
  try {
    const data = req.body;
    data.creeParId = req.user.id;

    // Convertir la date
    if (data.dateVisite) {
      data.dateVisite = new Date(data.dateVisite);
    }

    const visite = await prisma.visite.create({
      data,
      include: {
        bien: { select: { id: true, reference: true, titre: true, adresse: true } },
        client: { select: { id: true, nom: true, prenom: true, telephone: true } },
        creePar: { select: { id: true, nom: true, prenom: true } }
      }
    });

    res.status(201).json({ message: 'Visite créée avec succès', visite });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la création de la visite', error: error.message });
  }
};

// PUT /api/visites/:id
export const updateVisite = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    if (data.dateVisite) {
      data.dateVisite = new Date(data.dateVisite);
    }

    const visite = await prisma.visite.update({
      where: { id: parseInt(id) },
      data,
      include: {
        bien: { select: { id: true, reference: true, titre: true } },
        client: { select: { id: true, nom: true, prenom: true } }
      }
    });

    res.json({ message: 'Visite mise à jour avec succès', visite });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour de la visite', error: error.message });
  }
};

// DELETE /api/visites/:id
export const deleteVisite = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.visite.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Visite supprimée avec succès' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la suppression de la visite', error: error.message });
  }
};

// PUT /api/visites/:id/result
export const addVisiteResult = async (req, res) => {
  try {
    const { id } = req.params;
    const { resultat, commentaire, statut } = req.body;

    const visite = await prisma.visite.update({
      where: { id: parseInt(id) },
      data: { resultat, commentaire, statut: statut || 'TERMINEE' },
      include: {
        bien: { select: { id: true, reference: true, titre: true } },
        client: { select: { id: true, nom: true, prenom: true } }
      }
    });

    res.json({ message: 'Résultat de visite enregistré avec succès', visite });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de l\'enregistrement du résultat', error: error.message });
  }
};

// PUT /api/visites/:id/cancel
export const cancelVisite = async (req, res) => {
  try {
    const { id } = req.params;
    const { raison } = req.body;

    const visite = await prisma.visite.update({
      where: { id: parseInt(id) },
      data: { 
        statut: 'ANNULEE',
        commentaire: raison || 'Visite annulée'
      },
      include: {
        bien: { select: { id: true, reference: true, titre: true } },
        client: { select: { id: true, nom: true, prenom: true } }
      }
    });

    res.json({ message: 'Visite annulée avec succès', visite });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de l\'annulation', error: error.message });
  }
};

// GET /api/visites/bien/:bienId
export const getVisitesByBien = async (req, res) => {
  try {
    const { bienId } = req.params;
    const visites = await prisma.visite.findMany({
      where: { bienId: parseInt(bienId) },
      include: {
        client: { select: { id: true, nom: true, prenom: true, telephone: true } },
        creePar: { select: { id: true, nom: true, prenom: true } }
      },
      orderBy: { dateVisite: 'desc' }
    });
    res.json(visites);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des visites', error: error.message });
  }
};

// GET /api/visites/client/:clientId
export const getVisitesByClient = async (req, res) => {
  try {
    const { clientId } = req.params;
    const visites = await prisma.visite.findMany({
      where: { clientId: parseInt(clientId) },
      include: {
        bien: { select: { id: true, reference: true, titre: true, adresse: true } },
        creePar: { select: { id: true, nom: true, prenom: true } }
      },
      orderBy: { dateVisite: 'desc' }
    });
    res.json(visites);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des visites', error: error.message });
  }
};

// GET /api/visites/aujourdhui
export const getVisitesToday = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const visites = await prisma.visite.findMany({
      where: {
        dateVisite: {
          gte: today,
          lt: tomorrow
        },
        statut: { not: 'ANNULEE' }
      },
      include: {
        bien: { select: { id: true, reference: true, titre: true, adresse: true } },
        client: { select: { id: true, nom: true, prenom: true, telephone: true } }
      },
      orderBy: { heureVisite: 'asc' }
    });

    res.json(visites);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des visites', error: error.message });
  }
};

// GET /api/visites/semaine
export const getVisitesThisWeek = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const visites = await prisma.visite.findMany({
      where: {
        dateVisite: {
          gte: today,
          lt: nextWeek
        },
        statut: { not: 'ANNULEE' }
      },
      include: {
        bien: { select: { id: true, reference: true, titre: true, adresse: true } },
        client: { select: { id: true, nom: true, prenom: true, telephone: true } }
      },
      orderBy: { dateVisite: 'asc' }
    });

    res.json(visites);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des visites', error: error.message });
  }
};
