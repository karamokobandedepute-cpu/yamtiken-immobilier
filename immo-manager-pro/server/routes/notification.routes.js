import express from 'express';
import { verifyToken, checkRole } from '../middlewares/auth.middleware.js';
import * as notificationController from '../controllers/notification.controller.js';

const router = express.Router();

// Toutes les routes nécessitent authentification
router.use(verifyToken);

// GET /api/notifications - Notifications de l'utilisateur
router.get('/', notificationController.getMyNotifications);

// GET /api/notifications/non-lues - Nombre de notifications non lues
router.get('/count/non-lues', notificationController.getUnreadCount);

// PUT /api/notifications/:id/lire - Marquer comme lue
router.put('/:id/lire', notificationController.markAsRead);

// PUT /api/notifications/lire-tout - Marquer tout comme lu
router.put('/lire-tout', notificationController.markAllAsRead);

// DELETE /api/notifications/:id - Supprimer une notification
router.delete('/:id', notificationController.deleteNotification);

// GET /api/notifications/admin/all - Toutes les notifications (admin)
router.get('/admin/all', checkRole('ADMIN'), notificationController.getAllNotifications);

// POST /api/notifications/admin/broadcast - Envoyer à tous (admin)
router.post('/admin/broadcast', checkRole('ADMIN'), notificationController.broadcastNotification);

export default router;
