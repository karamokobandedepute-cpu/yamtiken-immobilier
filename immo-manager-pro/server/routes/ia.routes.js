import express from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = express.Router();

// Mock OCR
router.post('/ocr-cni', async (req, res) => {
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

  const scoreRisque = (Math.random() * 100).toFixed(2);
  const niveauRisque = scoreRisque < 30 ? "FAIBLE" : (scoreRisque < 70 ? "MOYEN" : "ELEVÉ");

  await prisma.client.update({
    where: { id: client.id },
    data: { scoreRisque: parseFloat(scoreRisque), niveauRisque }
  });

  res.json({ scoreRisque, niveauRisque, recommandations: "Surveiller les paiements." });
});

// ROUTE TEMPORAIRE POUR NETTOYER LA BASE DE DONNÉES EN PRODUCTION
router.get('/fix-db', async (req, res) => {
  try {
    const models = ['payment', 'lease', 'unite', 'building', 'client', 'facture', 'paiement', 'visite', 'commission', 'bien', 'referrer', 'user', 'alerte', 'notification', 'document', 'relance', 'auditLog', 'depense', 'contrat'];
    let total = 0;
    const results = {};
    for (const m of models) {
      if (prisma[m]) {
        try {
          // Delete all records where isDemo is true
          const result = await prisma[m].deleteMany({ where: { isDemo: true } });
          if (result.count > 0) {
            results[m] = result.count;
            total += result.count;
          }
        } catch(e) {
          // Ignore errors for models that might not have isDemo
        }
      }
    }
    res.json({
      success: true,
      message: `Nettoyage terminé avec succès. ${total} éléments supprimés.`,
      details: results
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
