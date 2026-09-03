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

// Connexion locale — bcrypt + JWT (sans confirmation email)
router.post('/login', validateBody(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;

    logger.info('[LOGIN] Tentative de connexion', { email });

    if (!email || !password) {
      return res.status(400).json({ message: 'Email et mot de passe requis' });
    }

    let user = null;
    let token = null;

    // Authentification locale uniquement (Prisma + bcrypt)
    try {
      user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() }
      });

      if (!user) {
        logger.warn('[LOGIN] Utilisateur non trouvé', { email });
        return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
      }

      if (!user.password) {
        return res.status(401).json({ message: 'Compte non configuré. Contactez l\'administrateur.' });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        logger.warn('[LOGIN] Mot de passe invalide', { email });
        return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
      }

      logger.info('[LOGIN] Authentification réussie', { email });

      token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role, nom: user.nom, prenom: user.prenom },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

    } catch (localError) {
      console.error('[LOGIN] Erreur authentification:', localError);
      return res.status(500).json({ message: 'Erreur serveur lors de l\'authentification' });
    }

    if (!user || !user.actif) {
      return res.status(401).json({ 
        message: 'Compte désactivé. Contactez l\'administrateur.' 
      });
    }

    // Mettre à jour la dernière connexion
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { dernierConnexion: new Date() }
      });
    } catch (e) {
      console.warn('[LOGIN] Impossible de mettre à jour dernierConnexion:', e.message);
    }

    logger.info('[LOGIN] Session créée', { role: user.role });

    // Générer le token JWT si pas déjà fait
    if (!token) {
      token = jwt.sign(
        { 
          userId: user.id, 
          email: user.email, 
          role: user.role,
          nom: user.nom,
          prenom: user.prenom
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
    }

    // Générer le refresh token (durée longue)
    const refreshToken = jwt.sign(
      { userId: user.id, email: user.email, type: 'refresh' },
      process.env.JWT_SECRET,
      { expiresIn: '90d' }
    );

    logger.info('Connexion réussie', { email: user.email, role: user.role });

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
        telephone: user.telephone,
        dernierConnexion: user.dernierConnexion
      }
    });
  } catch (error) {
    logger.error('Erreur login', { error: error.message });
    res.status(500).json({ message: 'Erreur lors de la connexion' });
  }
});

// POST /api/auth/refresh - Renouveler le token d'accès
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token requis' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ message: 'Token invalide' });
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || !user.actif) {
      return res.status(401).json({ message: 'Compte invalide ou désactivé' });
    }

    const newToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, nom: user.nom, prenom: user.prenom },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    const newRefreshToken = jwt.sign(
      { userId: user.id, email: user.email, type: 'refresh' },
      process.env.JWT_SECRET,
      { expiresIn: '90d' }
    );

    res.json({ token: newToken, refreshToken: newRefreshToken });
  } catch (error) {
    logger.warn('Refresh token invalide', { error: error.message });
    res.status(401).json({ message: 'Refresh token expiré ou invalide' });
  }
});

// Mot de passe oublié — génère un token JWT + envoie email
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email requis' });

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    if (user && user.actif) {
      const resetToken = jwt.sign(
        { userId: user.id, email: user.email, type: 'password_reset' },
        RESET_SECRET,
        { expiresIn: RESET_EXPIRES }
      );

      const resetLink = `${APP_URL}/reset-password?token=${resetToken}`;

      await transporter.sendMail({
        from: `"YAMTIKEN BEHEMOTH" <${process.env.ALERT_EMAIL}>`,
        to: user.email,
        subject: '🔑 Réinitialisation de votre mot de passe — YAMTIKEN',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:32px;background:#f9f9f9;border-radius:12px;">
            <div style="text-align:center;margin-bottom:24px;">
              <h1 style="color:#0D3B1F;margin:0;">YAMTIKEN BEHEMOTH</h1>
              <p style="color:#C8960C;font-weight:bold;margin:4px 0;">Gestion Immobilière</p>
            </div>
            <h2 style="color:#0D3B1F;">Réinitialisation du mot de passe</h2>
            <p>Bonjour <strong>${user.prenom} ${user.nom}</strong>,</p>
            <p>Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous :</p>
            <div style="text-align:center;margin:32px 0;">
              <a href="${resetLink}" style="background:#1A6B35;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;">
                🔑 Réinitialiser mon mot de passe
              </a>
            </div>
            <p style="color:#6B7280;font-size:13px;">Ce lien expire dans <strong>30 minutes</strong>.</p>
            <p style="color:#6B7280;font-size:13px;">Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
            <hr style="border:1px solid #e5e7eb;margin:24px 0;">
            <p style="color:#9CA3AF;font-size:11px;text-align:center;">YAMTIKEN BEHEMOTH © ${new Date().getFullYear()} — Créé par Christian Anisonok</p>
          </div>
        `
      });

      logger.info('[FORGOT-PASSWORD] Email envoyé', { email: user.email });
    }

    res.json({ message: 'Si un compte existe avec cet email, un lien de récupération a été envoyé.' });
  } catch (error) {
    console.error('Erreur forgot-password:', error.message);
    res.json({ message: 'Si un compte existe avec cet email, un lien de récupération a été envoyé.' });
  }
});

// Réinitialiser le mot de passe avec le token JWT local
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token et nouveau mot de passe requis' });
    }

    const pwResult = passwordSchema.safeParse(newPassword);
    if (!pwResult.success) {
      return res.status(400).json({
        message: pwResult.error.errors.map(e => e.message).join(', ')
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, RESET_SECRET);
    } catch {
      return res.status(400).json({ message: 'Lien de récupération expiré ou invalide' });
    }

    if (decoded.type !== 'password_reset') {
      return res.status(400).json({ message: 'Token invalide' });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: decoded.userId },
      data:  { password: hash }
    });

    logger.info('[RESET-PASSWORD] Mot de passe réinitialisé', { email: decoded.email });
    res.json({ message: 'Mot de passe réinitialisé avec succès. Vous pouvez vous connecter.' });
  } catch (error) {
    console.error('Erreur reset-password:', error.message);
    res.status(500).json({ message: 'Erreur lors de la réinitialisation' });
  }
});

// Profil utilisateur connecté
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
        telephone: true,
        role: true,
        actif: true,
        dernierConnexion: true,
        createdAt: true
      }
    });

    res.json({ user });
  } catch (error) {
    console.error('Erreur profil:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération du profil' });
  }
});

// Changer le mot de passe
router.post('/change-password', verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        message: 'Mot de passe actuel et nouveau mot de passe requis' 
      });
    }

    // Valider la politique de mot de passe forte
    const pwResult = passwordSchema.safeParse(newPassword);
    if (!pwResult.success) {
      return res.status(400).json({ 
        message: pwResult.error.errors.map(e => e.message).join(', ') 
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || !user.password) {
      return res.status(404).json({ message: 'Utilisateur introuvable' });
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ 
        message: 'Mot de passe actuel incorrect' 
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    await auditAction({
      userId: userId,
      action: 'UPDATE',
      tableName: 'user',
      recordId: userId,
      oldData: null,
      newData: { passwordChanged: true },
      req
    });

    res.json({ message: 'Mot de passe modifié avec succès' });
  } catch (error) {
    logger.error('Erreur changement mot de passe', { error: error.message });
    res.status(500).json({ message: 'Erreur lors du changement de mot de passe' });
  }
});

export default router;
