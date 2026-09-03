import express from 'express';
import { verifyToken, isAdmin } from '../middlewares/auth.middleware.js';
import { generateRapportExcel } from '../services/excelExport.js';

const router = express.Router();

// GET /api/export/excel - Télécharger le rapport Excel complet
router.get('/excel', verifyToken, isAdmin, async (req, res) => {
  try {
    const filters = {
      dateDebut: req.query.dateDebut,
      dateFin: req.query.dateFin
    };

    const workbook = await generateRapportExcel(filters);

    const fileName = `IMMO_RAPPORT_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Erreur export Excel:', error);
    res.status(500).json({ message: 'Erreur lors de la génération du rapport Excel', error: error.message });
  }
});

export default router;
