import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';

// Email du super admin universel (depuis .env)
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'munokolive@gmail.com';

// Vérifier le token JWT
export const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Token manquant ou invalide' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Essayer de récupérer l'utilisateur depuis la DB
    let user = null;
    try {
      user = await prisma.user.findUnique({
        where: { id: decoded.userId }
      });
    } catch (dbError) {
      // DB inaccessible - utiliser les données du JWT
      console.warn('DB inaccessible pour verifyToken, utilisation des données JWT');
    }

    if (!user) {
      // Construire l'utilisateur à partir du JWT décodé
      user = {
        id: decoded.userId,
        email: decoded.email,
        nom: decoded.nom,
        prenom: decoded.prenom,
        role: decoded.role,
        actif: true
      };
    }

    if (!user.actif) {
      return res.status(401).json({ message: 'Compte désactivé' });
    }

    // Super admin : toujours SUPER_ADMIN si email correspond
    if (user.email === SUPER_ADMIN_EMAIL && user.role !== 'SUPER_ADMIN') {
      user.role = 'SUPER_ADMIN';
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expiré' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Token invalide' });
    }
    return res.status(401).json({ message: 'Erreur d\'authentification' });
  }
};

// Vérifier les rôles (RBAC) — SUPER_ADMIN bypass tout
export const checkRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Non authentifié' });
    }

    // SUPER_ADMIN a accès à tout, pas besoin de vérifier
    if (req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    const userRole = req.user.role;
    
    if (typeof roles === 'string') {
      roles = [roles];
    }

    if (!roles.includes(userRole)) {
      return res.status(403).json({ 
        message: 'Accès refusé - Permissions insuffisantes',
        requiredRoles: roles,
        userRole: userRole
      });
    }

    next();
  };
};

// Middleware spécifiques par rôle (SUPER_ADMIN bypass automatiquement)
export const isSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Non authentifié' });
  }
  if (req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ message: 'Accès réservé aux Super Admin uniquement' });
  }
  next();
};

export const isAdmin = checkRole(['ADMIN', 'SUPER_ADMIN']);
export const isSecretaire = checkRole(['ADMIN', 'SUPER_ADMIN', 'SECRETAIRE']);
export const isRecouvrement = checkRole(['ADMIN', 'SUPER_ADMIN', 'AGENT_RECOUVREMENT']);
export const isDirection = checkRole(['ADMIN', 'SUPER_ADMIN', 'DIRECTION']);

// Middleware combinés
export const canManageClients = checkRole(['ADMIN', 'SUPER_ADMIN', 'SECRETAIRE']);
export const canManageVisites = checkRole(['ADMIN', 'SUPER_ADMIN', 'SECRETAIRE']);
export const canManagePaiements = checkRole(['ADMIN', 'SUPER_ADMIN', 'AGENT_RECOUVREMENT']);
export const canManageBiens = checkRole(['ADMIN', 'SUPER_ADMIN', 'SECRETAIRE']);
export const canManageContrats = checkRole(['ADMIN', 'SUPER_ADMIN', 'SECRETAIRE', 'AGENT_RECOUVREMENT']);
export const readOnlyDirection = checkRole(['ADMIN', 'SUPER_ADMIN', 'DIRECTION']);

// Logger les accès (optionnel)
export const accessLogger = (req, res, next) => {
  const timestamp = new Date().toISOString();
  const user = req.user ? `${req.user.prenom} ${req.user.nom} (${req.user.role})` : 'Anonymous';
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl} - ${user}`);
  next();
};
