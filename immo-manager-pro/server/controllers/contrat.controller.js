import prisma from '../lib/prisma.js';



// GET /api/contrats
export const getAllContrats = async (req, res) => {
  try {
    const { statut, type, page = 1, limit = 20 } = req.query;
    const where = {};
    
    if (statut) where.statut = statut;
    if (type) where.type = type;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [contrats, total] = await Promise.all([
      prisma.contrat.findMany({
        where,
        include: {
          bien: { select: { id: true, reference: true, titre: true, adresse: true } },
          locataire: { select: { id: true, nom: true, prenom: true, telephone: true } },
          proprietaire: { select: { id: true, nom: true, prenom: true, telephone: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.contrat.count({ where })
    ]);

    res.json({
      data: contrats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des contrats', error: error.message });
  }
};

// GET /api/contrats/stats
export const getContratsStats = async (req, res) => {
  try {
    const [total, parStatut, parType, aTermer] = await Promise.all([
      prisma.contrat.count(),
      prisma.contrat.groupBy({ by: ['statut'], _count: { statut: true } }),
      prisma.contrat.groupBy({ by: ['type'], _count: { type: true } }),
      prisma.contrat.count({
        where: {
          statut: { in: ['ACTIF', 'EN_COURS'] },
          dateFin: { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }
        }
      })
    ]);

    res.json({ total, parStatut, parType, aTermer });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors des statistiques', error: error.message });
  }
};

// GET /api/contrats/:id
export const getContratById = async (req, res) => {
  try {
    const { id } = req.params;
    const contrat = await prisma.contrat.findUnique({
      where: { id: parseInt(id) },
      include: {
        bien: true,
        locataire: true,
        proprietaire: true,
        paiements: { orderBy: { datePaiement: 'desc' } },
        documents: true
      }
    });

    if (!contrat) {
      return res.status(404).json({ message: 'Contrat non trouvé' });
    }

    res.json(contrat);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération du contrat', error: error.message });
  }
};

// POST /api/contrats
export const createContrat = async (req, res) => {
  try {
    const data = req.body;
    data.creeParId = req.user.id;

    // Générer référence
    const count = await prisma.contrat.count();
    data.reference = `CONT-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    // Mettre à jour statut du bien
    if (data.type === 'LOCATION') {
      await prisma.bien.update({
        where: { id: data.bienId },
        data: { statut: 'LOUE' }
      });
    } else {
      await prisma.bien.update({
        where: { id: data.bienId },
        data: { statut: 'VENDU' }
      });
    }

    const contrat = await prisma.contrat.create({
      data,
      include: {
        bien: { select: { id: true, reference: true, titre: true } },
        locataire: { select: { id: true, nom: true, prenom: true } },
        proprietaire: { select: { id: true, nom: true, prenom: true } }
      }
    });

    res.status(201).json({ message: 'Contrat créé avec succès', contrat });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la création du contrat', error: error.message });
  }
};

// PUT /api/contrats/:id
export const updateContrat = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const contrat = await prisma.contrat.update({
      where: { id: parseInt(id) },
      data,
      include: {
        bien: { select: { id: true, reference: true, titre: true } },
        locataire: { select: { id: true, nom: true, prenom: true } },
        proprietaire: { select: { id: true, nom: true, prenom: true } }
      }
    });

    res.json({ message: 'Contrat mis à jour avec succès', contrat });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour du contrat', error: error.message });
  }
};

// DELETE /api/contrats/:id
export const deleteContrat = async (req, res) => {
  try {
    const { id } = req.params;
    
    const contrat = await prisma.contrat.findUnique({ where: { id: parseInt(id) } });
    if (!contrat) {
      return res.status(404).json({ message: 'Contrat non trouvé' });
    }

    // Remettre le bien comme disponible
    await prisma.bien.update({
      where: { id: contrat.bienId },
      data: { statut: 'DISPONIBLE' }
    });

    await prisma.contrat.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Contrat supprimé avec succès' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la suppression du contrat', error: error.message });
  }
};

// PUT /api/contrats/:id/terminate
export const terminateContrat = async (req, res) => {
  try {
    const { id } = req.params;

    const contrat = await prisma.contrat.update({
      where: { id: parseInt(id) },
      data: { statut: 'RESILIE', dateFin: new Date() },
      include: { bien: true }
    });

    // Remettre le bien disponible
    await prisma.bien.update({
      where: { id: contrat.bien.id },
      data: { statut: 'DISPONIBLE' }
    });

    res.json({ message: 'Contrat résilié avec succès', contrat });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la résiliation', error: error.message });
  }
};

// GET /api/contrats/:id/pdf
export const generateContratPDF = async (req, res) => {
  try {
    const { id } = req.params;
    
    const contrat = await prisma.contrat.findUnique({
      where: { id: parseInt(id) },
      include: {
        bien: true,
        locataire: true,
        proprietaire: true
      }
    });

    if (!contrat) {
      return res.status(404).json({ message: 'Contrat non trouvé' });
    }

    // Retourner les données pour génération PDF côté client
    res.json({
      message: 'Données du contrat récupérées',
      data: contrat,
      pdfTemplate: 'contrat'
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la génération PDF', error: error.message });
  }
};

// GET /api/contrats/bien/:bienId
export const getContratsByBien = async (req, res) => {
  try {
    const { bienId } = req.params;
    const contrats = await prisma.contrat.findMany({
      where: { bienId: parseInt(bienId) },
      include: {
        locataire: { select: { id: true, nom: true, prenom: true } }
      },
      orderBy: { dateDebut: 'desc' }
    });
    res.json(contrats);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des contrats', error: error.message });
  }
};

// GET /api/contrats/client/:clientId
export const getContratsByClient = async (req, res) => {
  try {
    const { clientId } = req.params;
    const contrats = await prisma.contrat.findMany({
      where: {
        OR: [
          { locataireId: parseInt(clientId) },
          { proprietaireId: parseInt(clientId) }
        ]
      },
      include: {
        bien: { select: { id: true, reference: true, titre: true } },
        locataire: { select: { id: true, nom: true, prenom: true } },
        proprietaire: { select: { id: true, nom: true, prenom: true } }
      },
      orderBy: { dateDebut: 'desc' }
    });
    res.json(contrats);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des contrats', error: error.message });
  }
};

// GET /api/contrats/a-termer
export const getContratsATermer = async (req, res) => {
  try {
    const dans30Jours = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    
    const contrats = await prisma.contrat.findMany({
      where: {
        statut: 'ACTIF',
        dateFin: { lte: dans30Jours }
      },
      include: {
        bien: { select: { id: true, reference: true, titre: true } },
        locataire: { select: { id: true, nom: true, prenom: true, telephone: true } }
      },
      orderBy: { dateFin: 'asc' }
    });

    res.json(contrats);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des contrats à terminer', error: error.message });
  }
};
