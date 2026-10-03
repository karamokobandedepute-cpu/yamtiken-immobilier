import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import prisma from '../lib/prisma.js';
import { verifyToken } from '../middlewares/auth.middleware.js';
import { validateBody } from '../middlewares/validate.js';
import { loginSchema, passwordSchema } from '../validations/schemas.js';
import logger from '../lib/logger.js';
import { auditAction } from '../middlewares/audit.js';
import { generateAndSendOtp, verifyOtpCode } from '../services/otp.service.js';

const router = express.Router();

const RESET_SECRET  = (process.env.JWT_SECRET || 'fallback') + '_reset';
const RESET_EXPIRES = '30m';
const APP_URL       = process.env.CLIENT_URL || 'https://yamtiken2026.online';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.ALERT_EMAIL || process.env.SUPER_ADMIN_EMAIL,
    pass: process.env.GMAIL_APP_PASSWORD || ''
  }
});

router.post('/login', validateBody(loginSchema), async (req, res) => {
  try {
    const { email: rawEmail, password: rawPassword } = req.body;
    
    const email = rawEmail?.trim();
    const password = rawPassword?.trim();

    logger.info('[LOGIN] Tentative de connexion', { email });

    if (!email || !password) {
      return res.status(400).json({ message: 'Email et mot de passe requis' });
    }

    let user = null;
    let token = null;

    try {
      user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() }
      });

      if (!user) {
        logger.warn('[LOGIN] Utilisateur non trouvé', { email });
        return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
      }

      if (!user.password) {
        return res.status(401).json({ message: "Compte non configuré. Contactez l'administrateur." });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        logger.warn('[LOGIN] Mot de passe invalide', { email });
        return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
      }

      if (!user.actif) {
        return res.status(401).json({ message: "Compte désactivé. Contactez l'administrateur." });
      }

      if (user.verified === false) {
        logger.info('[LOGIN] Compte non vérifié. Envoi OTP.', { email });
        try {
          await generateAndSendOtp(user);
        } catch(e) {} 
        return res.status(403).json({
          message: "Votre compte n'a pas encore été vérifié. Un code de sécurité vient de vous être envoyé par email.",
          error: 'UNVERIFIED',
          userId: user.id,
          email: user.email
        });
      }

      logger.info('[LOGIN] Authentification réussie', { email });

      token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role, nom: user.nom, prenom: user.prenom },
        process.env.JWT_SECRET,
        { expiresIn: '100y' }
      );

    } catch (localError) {
      console.error('[LOGIN] Erreur authentification:', localError);
      return res.status(500).json({ message: "Erreur serveur lors de l'authentification" });
    }

    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { dernierConnexion: new Date() }
      });
    } catch (e) {
      console.warn('[LOGIN] Impossible de mettre à jour dernierConnexion:', e.message);
    }

    logger.info('[LOGIN] Session créée', { role: user.role });

    const refreshToken = jwt.sign(
      { userId: user.id, email: user.email, type: 'refresh' },
      process.env.JWT_SECRET,
      { expiresIn: '100y' }
    );

    res.json({
      message: 'Connexion réussie',
      token,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role,
        actif: user.actif,
        verified: user.verified,
        telephone: user.telephone,
        dernierConnexion: user.dernierConnexion,
        photoUrl: user.photoUrl
      }
    });
  } catch (error) {
    logger.error('Erreur login', { error: error.message });
    res.status(500).json({ message: 'Erreur lors de la connexion' });
  }
});

router.post('/verify-otp', async (req, res) => {
  try {
    const { userId, code } = req.body;
    if (!userId || !code) return res.status(400).json({ message: 'Données incomplètes' });
    
    await verifyOtpCode(userId, code);
    
    const user = await prisma.user.findUnique({ where: { id: userId } });
    
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, nom: user.nom, prenom: user.prenom },
      process.env.JWT_SECRET,
      { expiresIn: '100y' }
    );
    const refreshToken = jwt.sign(
      { userId: user.id, email: user.email, type: 'refresh' },
      process.env.JWT_SECRET,
      { expiresIn: '100y' }
    );

    await prisma.user.update({
      where: { id: user.id },
      data: { dernierConnexion: new Date() }
    });

    res.json({
      message: 'Vérification réussie',
      token,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role,
        actif: user.actif,
        verified: user.verified,
        telephone: user.telephone,
        dernierConnexion: user.dernierConnexion,
        photoUrl: user.photoUrl
      }
    });

  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/resend-otp', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: 'UserId requis' });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });
    
    if (user.verified) return res.status(400).json({ message: 'Compte déjà vérifié' });

    await generateAndSendOtp(user);
    res.json({ message: 'Code OTP renvoyé avec succès.' });
  } catch (error) {
    res.status(500).json({ message: "Erreur lors de l'envoi du code." });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ message: 'Refresh token requis' });

    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    if (decoded.type !== 'refresh') return res.status(401).json({ message: 'Token invalide' });

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || !user.actif) return res.status(401).json({ message: 'Compte invalide' });

    const newToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, nom: user.nom, prenom: user.prenom },
      process.env.JWT_SECRET,
      { expiresIn: '100y' }
    );
    const newRefreshToken = jwt.sign(
      { userId: user.id, email: user.email, type: 'refresh' },
      process.env.JWT_SECRET,
      { expiresIn: '100y' }
    );

    res.json({ token: newToken, refreshToken: newRefreshToken });
  } catch (error) {
    res.status(401).json({ message: 'Refresh token expiré ou invalide' });
  }
});

router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, email: true, nom: true, prenom: true, telephone: true,
        role: true, actif: true, verified: true, dernierConnexion: true, createdAt: true,
        photoUrl: true
      }
    });
    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération du profil' });
  }
});

router.post('/change-password', verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Requis' });

    const pwResult = passwordSchema.safeParse(newPassword);
    if (!pwResult.success) return res.status(400).json({ message: pwResult.error.errors.map(e => e.message).join(', ') });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.password) return res.status(404).json({ message: 'Utilisateur introuvable' });

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) return res.status(401).json({ message: 'Mot de passe actuel incorrect' });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: userId }, data: { password: hashedPassword } });

    await auditAction({
      userId: userId, action: 'UPDATE', tableName: 'user', recordId: userId,
      oldData: null, newData: { passwordChanged: true }, req
    });

    res.json({ message: 'Mot de passe modifié avec succès' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur' });
  }
});

export default router;
