import express from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = express.Router();

// Authentification Extranet (Locataire/Propriétaire)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const client = await prisma.client.findFirst({ where: { email } });
    if (!client || client.password !== password) {
      return res.status(401).json({ error: "Identifiants invalides" });
    }
    // Simulation JWT
    res.json({ token: "extranet-token-" + client.id, client });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Tickets de maintenance
router.get('/tickets', async (req, res) => {
  const tickets = await prisma.ticketMaintenance.findMany({
    include: { bien: true, client: true }
  });
  res.json(tickets);
});

export default router;
