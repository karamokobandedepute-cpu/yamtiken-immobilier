import express from 'express';
import { verifyToken, checkRole, canManagePaiements, isAdmin } from '../middlewares/auth.middleware.js';
import * as paiementController from '../controllers/paiement.controller.js';

const router = express.Router();

// Toutes les routes nécessitent authentification
router.use(verifyToken);

// GET /api/paiements - Liste des paiements
router.get('/', canManagePaiements, paiementController.getAllPaiements);

// GET /api/paiements/stats - Statistiques des paiements
router.get('/stats/overview', canManagePaiements, paiementController.getPaiementsStats);

// GET /api/paiements/:id - Détail d'un paiement
router.get('/:id', canManagePaiements, paiementController.getPaiementById);

// POST /api/paiements - Créer un paiement (admin et agent recouvrement)
router.post('/', checkRole(['ADMIN', 'AGENT_RECOUVREMENT']), paiementController.createPaiement);

// PUT /api/paiements/:id - Modifier un paiement
router.put('/:id', checkRole(['ADMIN', 'AGENT_RECOUVREMENT']), paiementController.updatePaiement);

// DELETE /api/paiements/:id - Supprimer un paiement (admin seulement)
router.delete('/:id', isAdmin, paiementController.deletePaiement);

// PUT /api/paiements/:id/validate - Valider un paiement
router.put('/:id/validate', checkRole(['ADMIN', 'AGENT_RECOUVREMENT']), paiementController.validatePaiement);

// GET /api/paiements/:id/receipt - Générer reçu PDF
router.get('/:id/receipt', canManagePaiements, paiementController.generateReceiptPDF);

// GET /api/paiements/contrat/:contratId - Paiements d'un contrat
router.get('/contrat/:contratId', canManagePaiements, paiementController.getPaiementsByContrat);

// GET /api/paiements/en-retard - Paiements en retard
router.get('/alertes/en-retard', checkRole(['ADMIN', 'AGENT_RECOUVREMENT']), paiementController.getPaiementsEnRetard);

// GET /api/paiements/a-venir - Paiements à venir
router.get('/alertes/a-venir', checkRole(['ADMIN', 'AGENT_RECOUVREMENT']), paiementController.getPaiementsAVenir);

export default router;
