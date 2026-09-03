import express from 'express';
import { verifyToken, checkRole, canManageClients, isAdmin } from '../middlewares/auth.middleware.js';
import multer from 'multer';
import path from 'path';
import * as documentController from '../controllers/document.controller.js';

const router = express.Router();

// Configuration Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/documents/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Type de fichier non autorisé'));
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Toutes les routes nécessitent authentification
router.use(verifyToken);

// GET /api/documents - Liste des documents
router.get('/', canManageClients, documentController.getAllDocuments);

// GET /api/documents/:id - Détail d'un document
router.get('/:id', canManageClients, documentController.getDocumentById);

// POST /api/documents/upload - Upload un document
router.post('/upload', canManageClients, upload.single('file'), documentController.uploadDocument);

// DELETE /api/documents/:id - Supprimer un document
router.delete('/:id', isAdmin, documentController.deleteDocument);

// GET /api/documents/client/:clientId - Documents d'un client
router.get('/client/:clientId', canManageClients, documentController.getDocumentsByClient);

// GET /api/documents/bien/:bienId - Documents d'un bien
router.get('/bien/:bienId', canManageClients, documentController.getDocumentsByBien);

// GET /api/documents/contrat/:contratId - Documents d'un contrat
router.get('/contrat/:contratId', canManageClients, documentController.getDocumentsByContrat);

// GET /api/documents/:id/download - Télécharger un document
router.get('/:id/download', canManageClients, documentController.downloadDocument);

export default router;
