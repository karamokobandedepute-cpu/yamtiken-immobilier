import express from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = express.Router();

// Mock OCR
router.post('/ocr-cni', async (req, res) => {
  // Dans un cas réel : appel à Google Cloud Vision ou Gemini 1.5 Pro
  res.json({
    success: true,
    data: {
      nom: "KOUASSI",
      prenom: "Jean-Paul",
      numeroPiece: "CI0011928374",
      dateNaissance: "1985-04-12"
    },
    message: "Données extraites par l'IA avec succès."
  });
});

// Mock Scoring
router.get('/scoring/:clientId', async (req, res) => {
  const { clientId } = req.params;
  const client = await prisma.client.findUnique({ where: { id: Number(clientId) } });
  
  if (!client) return res.status(404).json({ error: "Client non trouvé" });

  // Algorithme de prédiction (Mock)
  const scoreRisque = (Math.random() * 100).toFixed(2);
  const niveauRisque = scoreRisque < 30 ? "FAIBLE" : (scoreRisque < 70 ? "MOYEN" : "ELEVÉ");

  await prisma.client.update({
    where: { id: client.id },
    data: { scoreRisque: parseFloat(scoreRisque), niveauRisque }
  });

  res.json({ scoreRisque, niveauRisque, recommandations: "Surveiller les paiements de ce mois-ci." });
});

export default router;
