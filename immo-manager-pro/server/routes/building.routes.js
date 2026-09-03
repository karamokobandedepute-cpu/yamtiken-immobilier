import express from 'express';
import { verifyToken, canManageBiens, isAdmin } from '../middlewares/auth.middleware.js';
import * as buildingController from '../controllers/building-raw.controller.js';
import * as uniteController from '../controllers/unite-raw.controller.js';

const router = express.Router();

// Toutes les routes nécessitent authentification
router.use(verifyToken);

// GET /api/buildings - Liste des immeubles
router.get('/', buildingController.getAllBuildings);

// GET /api/buildings/stats - Statistiques des immeubles
router.get('/stats/overview', buildingController.getBuildingsStats);

// GET /api/buildings/:id/pdf - Générer fiche PDF de l'immeuble
router.get('/:id/pdf', buildingController.generateBuildingPDF);

// GET /api/buildings/:id - Détail d'un immeuble avec ses unités
router.get('/:id', buildingController.getBuildingById);

// POST /api/buildings - Créer un immeuble
router.post('/', canManageBiens, buildingController.createBuilding);

// PUT /api/buildings/:id - Modifier un immeuble
router.put('/:id', canManageBiens, buildingController.updateBuilding);

// PATCH /api/buildings/:id - Restaurer ou archiver un immeuble
router.patch('/:id', canManageBiens, buildingController.patchBuilding);

// DELETE /api/buildings/:id - Supprimer un immeuble (admin seulement)
router.delete('/:id', isAdmin, buildingController.deleteBuilding);

// ============================================
// ROUTES POUR LES UNITÉS (utiliser l'ancien contrôleur)
// ============================================

// GET /api/buildings/:id/unites - Liste des unités d'un immeuble
router.get('/:id/unites', uniteController.getUnitesByBuilding);

// POST /api/buildings/:id/unites - Ajouter une unité
router.post('/:id/unites', canManageBiens, uniteController.createUnite);

// PUT /api/buildings/:buildingId/unites/:uniteId - Modifier une unité
router.put('/:buildingId/unites/:uniteId', canManageBiens, uniteController.updateUnite);

// DELETE /api/buildings/:buildingId/unites/:uniteId - Supprimer une unité
router.delete('/:buildingId/unites/:uniteId', canManageBiens, uniteController.deleteUnite);

// PUT /api/buildings/:buildingId/unites/:uniteId/statut - Changer statut unité
router.put('/:buildingId/unites/:uniteId/statut', canManageBiens, uniteController.updateUniteStatut);

export default router;
