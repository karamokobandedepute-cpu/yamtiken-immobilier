import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { verifyToken } from '../middlewares/auth.middleware.js';
import prisma from '../lib/prisma.js';
import logger from '../lib/logger.js';

const router = express.Router();

// Configuration Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(process.cwd(), 'uploads', 'profiles');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error("Seules les images sont autorisées"));
    }
  }
});

// Uploader une photo de profil (Utilisateur)
router.post('/user', verifyToken, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Aucun fichier uploadé' });
    }

    const photoUrl = `/uploads/profiles/${req.file.filename}`;
    
    // Mettre à jour l'utilisateur connecté
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { photoUrl }
    });

    res.json({ message: 'Photo de profil mise à jour', photoUrl, user: updatedUser });
  } catch (error) {
    logger.error('Erreur upload photo utilisateur', { error: error.message });
    res.status(500).json({ message: error.message || "Erreur lors de l'upload" });
  }
});

// Uploader une photo de profil (Client/Souscripteur)
router.post('/client/:id', verifyToken, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Aucun fichier uploadé' });
    }

    const clientId = parseInt(req.params.id);
    const photoUrl = `/uploads/profiles/${req.file.filename}`;
    
    const updatedClient = await prisma.client.update({
      where: { id: clientId },
      data: { photoUrl }
    });

    res.json({ message: 'Photo du client mise à jour', photoUrl, client: updatedClient });
  } catch (error) {
    logger.error('Erreur upload photo client', { error: error.message });
    res.status(500).json({ message: error.message || "Erreur lors de l'upload" });
  }
});

export default router;
