import express from 'express';
import { verifyToken, checkRole, canManageContrats, isAdmin } from '../middlewares/auth.middleware.js';
import * as contratController from '../controllers/contrat.controller.js';

const router = express.Router();

// Toutes les routes nécessitent authentification
router.use(verifyToken);

// GET /api/contrats - Liste des contrats
router.get('/', canManageContrats, contratController.getAllContrats);

// GET /api/contrats/stats - Statistiques des contrats
router.get('/stats/overview', canManageContrats, contratController.getContratsStats);

// GET /api/contrats/:id - Détail d'un contrat
router.get('/:id', canManageContrats, contratController.getContratById);

// POST /api/contrats - Créer un contrat (admin et secretaire)
router.post('/', checkRole(['ADMIN', 'SECRETAIRE']), contratController.createContrat);

// PUT /api/contrats/:id - Modifier un contrat
router.put('/:id', checkRole(['ADMIN', 'SECRETAIRE']), contratController.updateContrat);

// DELETE /api/contrats/:id - Supprimer un contrat (admin seulement)
router.delete('/:id', isAdmin, contratController.deleteContrat);

// PUT /api/contrats/:id/terminate - Résilier un contrat
router.put('/:id/terminate', checkRole(['ADMIN', 'SECRETAIRE']), contratController.terminateContrat);

// GET /api/contrats/:id/pdf - Générer PDF du contrat
router.get('/:id/pdf', canManageContrats, contratController.generateContratPDF);

// GET /api/contrats/bien/:bienId - Contrats d'un bien
router.get('/bien/:bienId', canManageContrats, contratController.getContratsByBien);

// GET /api/contrats/client/:clientId - Contrats d'un client
router.get('/client/:clientId', canManageContrats, contratController.getContratsByClient);

// GET /api/contrats/a-termer - Contrats arrivant à échéance
router.get('/alertes/a-termer', checkRole(['ADMIN', 'SECRETAIRE']), contratController.getContratsATermer);

export default router;
