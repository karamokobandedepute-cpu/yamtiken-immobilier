import prisma from '../lib/prisma.js';
import logger from '../lib/logger.js';

// ============================================
// MIDDLEWARE AUDIT - Traçabilité complète
// ============================================
// Enregistre les actions CREATE/UPDATE/DELETE
// Usage: audit('lease', 'CREATE') dans les routes

export const audit = (tableName, action) => async (req, res, next) => {
  // Stocker la fonction d'audit sur req pour utilisation dans la route
  req.audit = async ({ recordId, oldData = null, newData = null }) => {
    try {
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action,
          tableName,
          recordId,
          oldData: oldData ? JSON.parse(JSON.stringify(oldData)) : null,
          newData: newData ? JSON.parse(JSON.stringify(newData)) : null,
          ipAddress: req.ip || req.connection?.remoteAddress || null,
          userAgent: req.get('user-agent')?.substring(0, 255) || null
        }
      });
    } catch (error) {
      // Ne jamais bloquer la requête à cause de l'audit
      logger.error('[AUDIT] Erreur enregistrement', {
        tableName,
        action,
        recordId,
        error: error.message
      });
    }
  };
  next();
};

// Helper pour auditer directement (sans middleware)
export const auditAction = async ({ userId, action, tableName, recordId, oldData, newData, req }) => {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        tableName,
        recordId,
        oldData: oldData ? JSON.parse(JSON.stringify(oldData)) : null,
        newData: newData ? JSON.parse(JSON.stringify(newData)) : null,
        ipAddress: req?.ip || null,
        userAgent: req?.get?.('user-agent')?.substring(0, 255) || null
      }
    });
  } catch (error) {
    logger.error('[AUDIT] Erreur directe', { tableName, action, error: error.message });
  }
};

export default audit;
