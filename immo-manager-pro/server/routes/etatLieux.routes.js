import express from 'express';
import { PrismaClient } from '@prisma/client';
import { verifyToken } from '../middlewares/auth.middleware.js';

const prisma = new PrismaClient();
const router = express.Router();

// 1. Lister les etats des lieux
router.get('/', verifyToken, async (req, res) => {
  try {
    const etats = await prisma.etatLieux.findMany({
      include: { lease: { include: { client: true, bien: true } } },
      orderBy: { date: 'desc' }
    });
    res.json(etats);
  } catch (error) {
    res.status(500).json({ message: 'Erreur', error: error.message });
  }
});

// 2. Créer un etat des lieux
router.post('/', verifyToken, async (req, res) => {
  try {
    const { leaseId, type, description, photos } = req.body;
    const etat = await prisma.etatLieux.create({
      data: {
        leaseId: parseInt(leaseId),
        type,
        description,
        photos: photos || []
      }
    });
    res.status(201).json(etat);
  } catch (error) {
    res.status(500).json({ message: 'Erreur', error: error.message });
  }
});

export default router;
