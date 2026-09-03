import express from 'express';
import { verifyToken, checkRole, canManageClients } from '../middlewares/auth.middleware.js';
import * as userController from '../controllers/user.controller.js';

const router = express.Router();

// Toutes les routes nécessitent authentification
router.use(verifyToken);

// GET /api/users - Liste des utilisateurs (admin seulement)
router.get('/', checkRole('ADMIN'), userController.getAllUsers);

// GET /api/users/:id - Détail d'un utilisateur
router.get('/:id', userController.getUserById);

// POST /api/users - Créer un utilisateur (admin seulement)
router.post('/', checkRole('ADMIN'), userController.createUser);

// PUT /api/users/:id - Modifier un utilisateur
router.put('/:id', checkRole('ADMIN'), userController.updateUser);

// DELETE /api/users/:id - Supprimer un utilisateur (admin seulement)
router.delete('/:id', checkRole('ADMIN'), userController.deleteUser);

// PUT /api/users/:id/toggle - Activer/Désactiver un utilisateur
router.put('/:id/toggle', checkRole('ADMIN'), userController.toggleUserStatus);

// GET /api/users/profile/me - Profil de l'utilisateur connecté
router.get('/profile/me', userController.getMyProfile);

// PUT /api/users/profile/me - Modifier son profil
router.put('/profile/me', userController.updateMyProfile);

export default router;
