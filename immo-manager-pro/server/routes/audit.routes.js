import express from 'express';
import prisma from '../lib/prisma.js';
import { verifyToken, isAdmin } from '../middlewares/auth.middleware.js';
import logger from '../lib/logger.js';

const router = express.Router();

/**
 * 🔒 ROUTES AUDIT - API de Traçabilité
 * 
 * POST /api/audit/log - Recevoir les logs du client
 * GET /api/audit/logs - Récupérer les logs (admin uniquement)
 * GET /api/audit/stats - Statistiques d'audit
 * GET /api/audit/verify - Vérifier l'intégrité des logs
 */

/**
 * 📥 POST /api/audit/log - Recevoir un log du client
 */
router.post('/log', verifyToken, async (req, res) => {
  // Répondre immédiatement 200 — le log ne doit JAMAIS bloquer l'app
  res.status(200).json({ success: true })

  // Sauvegarder en arrière-plan (fire & forget)
  try {
    const logData = req.body
    if (!logData.action) return

    await prisma.auditLog.create({
      data: {
        userId: req.user.id, // toujours l'utilisateur authentifié (FK valide)
        action: String(logData.action).substring(0, 50),
        tableName: String(logData.tableName || logData.entityType || 'app').substring(0, 50),
        recordId: parseInt(logData.recordId || logData.entityId || 0) || 0,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }
    })
  } catch (err) {
    // Silencieux — ne jamais crasher sur un log d'audit
    logger.warn('Audit log non sauvegardé:', { err: err.message })
  }
});

/**
 * 📊 GET /api/audit/logs - Récupérer les logs (admin uniquement)
 */
router.get('/logs', verifyToken, isAdmin, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      severity,
      action,
      userId,
      entityType,
      startDate,
      endDate,
      search
    } = req.query;

    // Construire les filtres
    const where = {};
    
    if (severity) where.severity = severity;
    if (action) where.action = action;
    if (userId) where.userId = parseInt(userId);
    if (entityType) where.entityType = entityType;
    
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }
    
    if (search) {
      where.OR = [
        { userEmail: { contains: search, mode: 'insensitive' } },
        { action: { contains: search, mode: 'insensitive' } },
        { entityType: { contains: search, mode: 'insensitive' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Récupérer les logs avec pagination
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.auditLog.count({ where })
    ]);

    res.json({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      },
      filters: { severity, action, userId, entityType, startDate, endDate }
    });

  } catch (error) {
    console.error('Erreur récupération logs:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des logs' });
  }
});

/**
 * 📈 GET /api/audit/stats - Statistiques d'audit
 */
router.get('/stats', verifyToken, isAdmin, async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Statistiques par action
    const actionStats = await prisma.auditLog.groupBy({
      by: ['action'],
      where: {
        timestamp: { gte: startDate }
      },
      _count: { action: true }
    });

    // Statistiques par sévérité
    const severityStats = await prisma.auditLog.groupBy({
      by: ['severity'],
      where: {
        timestamp: { gte: startDate }
      },
      _count: { severity: true }
    });

    // Statistiques par utilisateur (top 10)
    const userStats = await prisma.auditLog.groupBy({
      by: ['userEmail'],
      where: {
        timestamp: { gte: startDate }
      },
      _count: { userEmail: true },
      orderBy: { _count: { userEmail: 'desc' } },
      take: 10
    });

    // Logs critiques récents
    const recentCritical = await prisma.auditLog.findMany({
      where: {
        severity: 'CRITICAL',
        timestamp: { gte: startDate }
      },
      orderBy: { timestamp: 'desc' },
      take: 10,
      select: {
        id: true,
        timestamp: true,
        action: true,
        userEmail: true,
        payload: true
      }
    });

    // Total de logs
    const totalLogs = await prisma.auditLog.count({
      where: { timestamp: { gte: startDate } }
    });

    res.json({
      period: `${days} jours`,
      totalLogs,
      actionStats: actionStats.map(s => ({ action: s.action, count: s._count.action })),
      severityStats: severityStats.map(s => ({ severity: s.severity, count: s._count.severity })),
      userStats: userStats.map(s => ({ user: s.userEmail, count: s._count.userEmail })),
      recentCritical
    });

  } catch (error) {
    console.error('Erreur stats audit:', error);
    res.status(500).json({ message: 'Erreur lors du calcul des statistiques' });
  }
});

/**
 * 🔍 GET /api/audit/verify - Vérifier l'intégrité des logs
 */
router.get('/verify', verifyToken, isAdmin, async (req, res) => {
  try {
    const { limit = 100 } = req.query;

    // Récupérer les logs avec hash
    const logs = await prisma.auditLog.findMany({
      where: {
        hash: { not: null }
      },
      orderBy: { timestamp: 'asc' },
      take: parseInt(limit),
      select: {
        id: true,
        timestamp: true,
        userId: true,
        action: true,
        payload: true,
        hash: true,
        previousHash: true
      }
    });

    if (logs.length === 0) {
      return res.json({
        verified: true,
        message: 'Aucun log avec hash à vérifier',
        totalChecked: 0,
        corrupted: []
      });
    }

    // Vérifier la chaîne
    const corrupted = [];
    let lastHash = '0';

    for (const log of logs) {
      const expectedHash = computeSimpleHash({
        timestamp: new Date(log.timestamp).getTime(),
        userId: log.userId,
        action: log.action,
        payload: log.payload
      }, lastHash);

      if (log.hash !== expectedHash) {
        corrupted.push({
          logId: log.id,
          expectedHash,
          actualHash: log.hash,
          timestamp: log.timestamp
        });
      }

      lastHash = log.hash;
    }

    res.json({
      verified: corrupted.length === 0,
      message: corrupted.length === 0 
        ? '✅ Tous les logs sont intègres' 
        : `❌ ${corrupted.length} log(s) corrompu(s) détecté(s)`,
      totalChecked: logs.length,
      corrupted,
      corruptionDetected: corrupted.length > 0
    });

  } catch (error) {
    console.error('Erreur vérification audit:', error);
    res.status(500).json({ message: 'Erreur lors de la vérification' });
  }
});

/**
 * 🗑️ DELETE /api/audit/logs - Purger les vieux logs (SUPER_ADMIN uniquement)
 */
router.delete('/logs', verifyToken, async (req, res) => {
  try {
    // Vérifier que c'est un SUPER_ADMIN
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ 
        message: 'Seul un SUPER_ADMIN peut purger les logs' 
      });
    }

    const { days = 90 } = req.body;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));

    // Supprimer les vieux logs (sauf les critiques)
    const result = await prisma.auditLog.deleteMany({
      where: {
        timestamp: { lt: cutoffDate },
        severity: { not: 'CRITICAL' } // Ne jamais supprimer les logs critiques
      }
    });

    // Logger l'action de purge
    logger.warn('🗑️ PURGE DES LOGS AUDIT', {
      deletedCount: result.count,
      olderThan: `${days} jours`,
      purgedBy: req.user.email
    });

    res.json({
      message: `${result.count} logs purgés avec succès`,
      purgedCount: result.count,
      olderThan: `${days} jours`
    });

  } catch (error) {
    console.error('Erreur purge logs:', error);
    res.status(500).json({ message: 'Erreur lors de la purge' });
  }
});

// Fonction de hash simple (doit correspondre à celle du client)
const computeSimpleHash = (logEntry, previousHash = '0') => {
  const data = `${logEntry.timestamp}-${logEntry.userId}-${logEntry.action}-${JSON.stringify(logEntry.payload)}-${previousHash}`;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
};

export default router;
