import express from 'express';
import prisma from '../lib/prisma.js';
import { verifyToken, canManageBiens } from '../middlewares/auth.middleware.js';

const router = express.Router();


// Lister tous les biens
router.get('/', verifyToken, async (req, res) => {
  try {
    const { statut, type, ville, search, limit = 300 } = req.query;
    const take = Math.min(parseInt(limit) || 300, 500);

    const where = {};
    if (statut) where.statut = statut;
    if (type) where.type = type;
    if (ville) where.ville = { contains: ville, mode: 'insensitive' };
    if (search) {
      where.OR = [
        { titre:     { contains: search, mode: 'insensitive' } },
        { reference: { contains: search, mode: 'insensitive' } },
        { adresse:   { contains: search, mode: 'insensitive' } }
      ];
    }

    const biens = await prisma.bien.findMany({
      where,
      include: {
        proprietaire: { select: { nom: true, prenom: true, telephone: true } },
        _count: { select: { visites: true } }
      },
      orderBy: { createdAt: 'desc' },
      take
    });

    res.json(biens);
  } catch (error) {
    console.error('[GET /biens]', error.message);
    res.status(500).json({ message: 'Erreur lors de la récupération des biens' });
  }
});

// Détail d'un bien
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const bien = await prisma.bien.findUnique({
      where: { id: parseInt(id) },
      include: {
        proprietaire: true,
        visites: {
          orderBy: { dateVisite: 'desc' },
          take: 10
        }
      }
    });

    if (!bien) {
      return res.status(404).json({ message: 'Bien non trouvé' });
    }

    res.json(bien);
  } catch (error) {
    console.error('Erreur détail bien:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération du bien' });
  }
});

// Créer un bien
router.post('/', verifyToken, canManageBiens, async (req, res) => {
  try {
    const {
      reference,
      titre,
      description,
      type,
      adresse,
      ville,
      quartier,
      surface,
      nbPieces,
      nbChambres,
      nbSallesBain,
      etage,
      prixLocation,
      prixVente,
      charges,
      caution,
      equipements,
      proprietaireId
    } = req.body;

    if (!reference || !titre || !type || !adresse || !ville || !proprietaireId) {
      return res.status(400).json({ 
        message: 'Référence, titre, type, adresse, ville et propriétaire sont obligatoires' 
      });
    }

    // Vérifier si la référence existe déjà
    const existingBien = await prisma.bien.findUnique({
      where: { reference }
    });

    if (existingBien) {
      return res.status(400).json({ message: 'Cette référence existe déjà' });
    }

    const bien = await prisma.bien.create({
      data: {
        reference,
        titre,
        description,
        type,
        adresse,
        ville,
        quartier,
        surface: surface ? parseFloat(surface) : null,
        nbPieces: nbPieces ? parseInt(nbPieces) : null,
        nbChambres: nbChambres ? parseInt(nbChambres) : null,
        nbSallesBain: nbSallesBain ? parseInt(nbSallesBain) : null,
        etage: etage ? parseInt(etage) : null,
        prixLocation: prixLocation ? parseFloat(prixLocation) : null,
        prixVente: prixVente ? parseFloat(prixVente) : null,
        charges: charges ? parseFloat(charges) : null,
        caution: caution ? parseFloat(caution) : null,
        equipements: equipements || [],
        proprietaireId: parseInt(proprietaireId)
      },
      include: {
        proprietaire: { select: { nom: true, prenom: true } }
      }
    });

    res.status(201).json({ 
      message: 'Bien créé avec succès',
      bien 
    });
  } catch (error) {
    console.error('Erreur créer bien:', error);
    res.status(500).json({ message: 'Erreur lors de la création du bien' });
  }
});

// Modifier un bien
router.put('/:id', verifyToken, canManageBiens, async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const bien = await prisma.bien.update({
      where: { id: parseInt(id) },
      data: {
        ...data,
        surface: data.surface ? parseFloat(data.surface) : undefined,
        nbPieces: data.nbPieces ? parseInt(data.nbPieces) : undefined,
        nbChambres: data.nbChambres ? parseInt(data.nbChambres) : undefined,
        nbSallesBain: data.nbSallesBain ? parseInt(data.nbSallesBain) : undefined,
        etage: data.etage ? parseInt(data.etage) : undefined,
        prixLocation: data.prixLocation ? parseFloat(data.prixLocation) : undefined,
        prixVente: data.prixVente ? parseFloat(data.prixVente) : undefined,
        charges: data.charges ? parseFloat(data.charges) : undefined,
        caution: data.caution ? parseFloat(data.caution) : undefined,
        proprietaireId: data.proprietaireId ? parseInt(data.proprietaireId) : undefined
      },
      include: {
        proprietaire: { select: { nom: true, prenom: true } }
      }
    });

    res.json({ 
      message: 'Bien modifié avec succès',
      bien 
    });
  } catch (error) {
    console.error('Erreur modifier bien:', error);
    res.status(500).json({ message: 'Erreur lors de la modification du bien' });
  }
});

// Supprimer un bien
router.delete('/:id', verifyToken, canManageBiens, async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.bien.delete({
      where: { id: parseInt(id) }
    });

    res.json({ message: 'Bien supprimé avec succès' });
  } catch (error) {
    console.error('Erreur supprimer bien:', error);
    res.status(500).json({ message: 'Erreur lors de la suppression du bien' });
  }
});

export default router;
