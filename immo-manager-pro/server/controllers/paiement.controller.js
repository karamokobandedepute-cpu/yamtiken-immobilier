import prisma from '../lib/prisma.js';



// GET /api/paiements
export const getAllPaiements = async (req, res) => {
  try {
    const { statut, page = 1, limit = 20 } = req.query;
    const where = {};
    
    if (statut) where.statut = statut;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [paiements, total] = await Promise.all([
      prisma.paiement.findMany({
        where,
        include: {
          contrat: {
            select: {
              id: true,
              reference: true,
              bien: { select: { id: true, reference: true, titre: true } }
            }
          },
          locataire: { select: { id: true, nom: true, prenom: true } },
          creePar: { select: { id: true, nom: true, prenom: true } }
        },
        orderBy: { datePaiement: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.paiement.count({ where })
    ]);

    res.json({
      data: paiements,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des paiements', error: error.message });
  }
};

// GET /api/paiements/stats
export const getPaiementsStats = async (req, res) => {
  try {
    const today = new Date();
    const debutMois = new Date(today.getFullYear(), today.getMonth(), 1);
    const finMois = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const [total, parStatut, montantTotal, montantMois] = await Promise.all([
      prisma.paiement.count(),
      prisma.paiement.groupBy({ by: ['statut'], _count: { statut: true } }),
      prisma.paiement.aggregate({ 
        where: { statut: 'PAYE' },
        _sum: { montant: true } 
      }),
      prisma.paiement.aggregate({
        where: { 
          statut: 'PAYE',
          datePaiement: { gte: debutMois, lte: finMois }
        },
        _sum: { montant: true }
      })
    ]);

    res.json({ 
      total, 
      parStatut, 
      montantTotal: montantTotal._sum.montant || 0,
      montantMois: montantMois._sum.montant || 0
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors des statistiques', error: error.message });
  }
};

// GET /api/paiements/:id
export const getPaiementById = async (req, res) => {
  try {
    const { id } = req.params;
    const paiement = await prisma.paiement.findUnique({
      where: { id: parseInt(id) },
      include: {
        contrat: {
          include: {
            bien: { select: { id: true, reference: true, titre: true, adresse: true } }
          }
        },
        locataire: true,
        creePar: { select: { id: true, nom: true, prenom: true } }
      }
    });

    if (!paiement) {
      return res.status(404).json({ message: 'Paiement non trouvé' });
    }

    res.json(paiement);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération du paiement', error: error.message });
  }
};

// POST /api/paiements
export const createPaiement = async (req, res) => {
  try {
    const data = req.body;
    data.creeParId = req.user.id;

    // Générer référence
    const count = await prisma.paiement.count();
    data.reference = `PAY-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

    const paiement = await prisma.paiement.create({
      data,
      include: {
        contrat: {
          select: {
            id: true,
            reference: true,
            bien: { select: { id: true, reference: true, titre: true } }
          }
        },
        locataire: { select: { id: true, nom: true, prenom: true } }
      }
    });

    res.status(201).json({ message: 'Paiement créé avec succès', paiement });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la création du paiement', error: error.message });
  }
};

// PUT /api/paiements/:id
export const updatePaiement = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const paiement = await prisma.paiement.update({
      where: { id: parseInt(id) },
      data,
      include: {
        contrat: {
          select: {
            id: true,
            reference: true,
            bien: { select: { id: true, reference: true, titre: true } }
          }
        },
        locataire: { select: { id: true, nom: true, prenom: true } }
      }
    });

    res.json({ message: 'Paiement mis à jour avec succès', paiement });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour du paiement', error: error.message });
  }
};

// DELETE /api/paiements/:id
export const deletePaiement = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.paiement.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Paiement supprimé avec succès' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la suppression du paiement', error: error.message });
  }
};

// PUT /api/paiements/:id/validate
export const validatePaiement = async (req, res) => {
  try {
    const { id } = req.params;

    const paiement = await prisma.paiement.update({
      where: { id: parseInt(id) },
      data: { statut: 'PAYE' },
      include: {
        contrat: { select: { id: true, reference: true } },
        locataire: { select: { id: true, nom: true, prenom: true } }
      }
    });

    res.json({ message: 'Paiement validé avec succès', paiement });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la validation', error: error.message });
  }
};

// GET /api/paiements/:id/receipt
export const generateReceiptPDF = async (req, res) => {
  try {
    const { id } = req.params;
    
    const paiement = await prisma.paiement.findUnique({
      where: { id: parseInt(id) },
      include: {
        contrat: { include: { bien: true } },
        locataire: true,
        creePar: { select: { nom: true, prenom: true } }
      }
    });

    if (!paiement) {
      return res.status(404).json({ message: 'Paiement non trouvé' });
    }

    res.json({
      message: 'Données du reçu récupérées',
      data: paiement,
      pdfTemplate: 'receipt'
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la génération du reçu', error: error.message });
  }
};

// GET /api/paiements/contrat/:contratId
export const getPaiementsByContrat = async (req, res) => {
  try {
    const { contratId } = req.params;
    const paiements = await prisma.paiement.findMany({
      where: { contratId: parseInt(contratId) },
      include: {
        locataire: { select: { id: true, nom: true, prenom: true } },
        creePar: { select: { id: true, nom: true, prenom: true } }
      },
      orderBy: { datePaiement: 'desc' }
    });
    res.json(paiements);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des paiements', error: error.message });
  }
};

// GET /api/paiements/en-retard
export const getPaiementsEnRetard = async (req, res) => {
  try {
    const today = new Date();
    
    const paiements = await prisma.paiement.findMany({
      where: {
        statut: 'EN_RETARD'
      },
      include: {
        contrat: {
          select: {
            id: true,
            reference: true,
            bien: { select: { id: true, reference: true, titre: true } }
          }
        },
        locataire: { select: { id: true, nom: true, prenom: true, telephone: true } }
      },
      orderBy: { periodeDebut: 'asc' }
    });

    res.json(paiements);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des paiements en retard', error: error.message });
  }
};

// GET /api/paiements/a-venir
export const getPaiementsAVenir = async (req, res) => {
  try {
    const today = new Date();
    const dans7Jours = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    // Récupérer les contrats actifs avec paiements prévus
    const contrats = await prisma.contrat.findMany({
      where: {
        statut: 'ACTIF',
        type: 'LOCATION'
      },
      include: {
        bien: { select: { id: true, reference: true, titre: true } },
        locataire: { select: { id: true, nom: true, prenom: true, telephone: true } }
      }
    });

    res.json(contrats.map(c => ({
      contrat: c,
      prochainPaiement: c.frequencePaiement === 'MENSUEL' ? 
        new Date(today.getFullYear(), today.getMonth() + 1, 1) : null
    })));
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des paiements à venir', error: error.message });
  }
};
