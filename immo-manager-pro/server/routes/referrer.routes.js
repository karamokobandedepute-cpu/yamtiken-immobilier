import express from 'express';
import { verifyToken, canManageClients } from '../middlewares/auth.middleware.js';
import prisma from '../lib/prisma.js';

const router = express.Router();


// GET /api/referrers - Liste des témoins/apporteurs
router.get('/', verifyToken, async (req, res) => {
  try {
    const referrers = await prisma.referrer.findMany({
      orderBy: { nom: 'asc' }
    });
    res.json(referrers);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des témoins', error: error.message });
  }
});

// POST /api/referrers - Créer un témoin
router.post('/', verifyToken, canManageClients, async (req, res) => {
  try {
    const referrer = await prisma.referrer.create({
      data: req.body
    });
    res.status(201).json({ message: 'Témoin créé avec succès', referrer });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la création du témoin', error: error.message });
  }
});

export default router;
