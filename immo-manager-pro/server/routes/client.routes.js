import express from 'express';
import multer from 'multer';
import { verifyToken, canManageClients } from '../middlewares/auth.middleware.js';
import * as clientController from '../controllers/client-raw.controller.js';
import { getRapportCompletClient } from '../controllers/rapport-client.controller.js';

const router = express.Router();

// Multer pour parser multipart/form-data (photo + pièce d'identité)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB max
});

const clientUpload = upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'piece', maxCount: 1 }
]);

// Routes de base
router.get('/', verifyToken, clientController.getAllClients);
router.get('/stats', verifyToken, clientController.getClientStats);
router.get('/:id/rapport-complet', verifyToken, getRapportCompletClient);
router.get('/:id/pdf', verifyToken, clientController.generateClientPDF);
router.get('/:id', verifyToken, clientController.getClientById);
router.post('/', verifyToken, canManageClients, clientUpload, clientController.createClient);
router.put('/:id', verifyToken, canManageClients, clientUpload, clientController.updateClient);
router.patch('/:id', verifyToken, canManageClients, clientController.patchClient);
router.delete('/:id', verifyToken, canManageClients, clientController.deleteClient);

export default router;
