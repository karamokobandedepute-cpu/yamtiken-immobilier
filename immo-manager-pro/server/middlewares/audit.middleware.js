import prisma from '../lib/prisma.js';
import logger from '../lib/logger.js';

/**
 * 🔒 MIDDLEWARE AUDIT - Traçabilité Totale Backend
 * Capture automatiquement toutes les actions HTTP
 */

// Actions sensibles qui nécessitent une log immédiate
const SENSITIVE_ACTIONS = [
  'DELETE',
  'UPDATE_PASSWORD',
  'GRANT_ADMIN',
  'EXPORT_ALL',
  'BULK_DELETE'
];

// Routes à exclure du logging (health checks, etc)
const EXCLUDED_ROUTES = [
  '/api/health',
  '/api/audit/log', // Ne pas logger les logs eux-mêmes
  '/uploads/',
  '/favicon.ico'
];

/**
 * Middleware principal d'audit
 */
export const auditMiddleware = async (req, res, next) => {
  // Ignorer les routes exclues
  if (EXCLUDED_ROUTES.some(route => req.path.includes(route))) {
    return next();
  }

  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  
  // Capturer les données avant modification (pour PUT/DELETE)
  let originalData = null;
  
  if (req.method === 'PUT' || req.method === 'PATCH') {
    // Essayer de récupérer l'entité originale
    try {
      originalData = await captureOriginalData(req);
    } catch (e) {
      // Ignorer si impossible
    }
  }

  // Intercepter la réponse
  const originalJson = res.json;
  const originalSend = res.send;
  
  res.json = function(data) {
    res.json = originalJson;
    logAuditEvent(req, res, data, originalData, requestId, startTime);
    return res.json(data);
  };
  
  res.send = function(data) {
    res.send = originalSend;
    logAuditEvent(req, res, data, originalData, requestId, startTime);
    return res.send(data);
  };

  next();
};

/**
 * 🔐 Log d'audit pour accès refusé
 */
export const auditAccessDenied = (req, resource, reason) => {
  const logEntry = {
    timestamp: new Date(),
    userId: req.user?.id || 'anonymous',
    userEmail: req.user?.email || req.ip,
    userRole: req.user?.role || 'none',
    action: 'ACCESS_DENIED',
    severity: 'CRITICAL',
    entityType: resource,
    entityId: null,
    payload: {
      reason,
      attemptedRoute: req.originalUrl,
      method: req.method,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    },
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.headers['user-agent'],
    sessionId: req.session?.id || req.cookies?.sessionId,
    pageUrl: req.originalUrl,
    requestId: crypto.randomUUID()
  };

  // Sauvegarder en DB (async)
  saveAuditLog(logEntry).catch(console.error);

  // Log immédiat pour alerte
  logger.warn('🚨 ACCÈS INTERDIT TENTÉ', {
    user: logEntry.userEmail,
    resource,
    reason,
    ip: logEntry.ipAddress,
    timestamp: logEntry.timestamp
  });

  return logEntry;
};

/**
 * 📝 Log d'événement d'audit (appelé après la réponse)
 */
const logAuditEvent = async (req, res, responseData, originalData, requestId, startTime) => {
  const duration = Date.now() - startTime;
  const statusCode = res.statusCode;
  
  // Déterminer la sévérité
  let severity = 'INFO';
  if (statusCode >= 500) severity = 'CRITICAL';
  else if (statusCode >= 400) severity = 'WARNING';
  else if (SENSITIVE_ACTIONS.some(action => req.originalUrl.toUpperCase().includes(action))) {
    severity = 'WARNING';
  }

  // Déterminer l'action
  const action = determineAction(req);
  
  // Construire le payload
  const payload = buildPayload(req, responseData, originalData, statusCode);

  const logEntry = {
    timestamp: new Date(),
    userId: req.user?.id,
    userEmail: req.user?.email || 'system',
    userRole: req.user?.role || 'system',
    action,
    severity,
    entityType: determineEntityType(req),
    entityId: extractEntityId(req, responseData),
    payload,
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.headers['user-agent'],
    sessionId: req.session?.id || req.cookies?.sessionId,
    pageUrl: req.originalUrl,
    requestId,
    duration,
    statusCode
  };

  // Sauvegarder
  saveAuditLog(logEntry).catch(err => {
    logger.error('Failed to save audit log:', err);
  });

  // Log immédiat pour actions critiques
  if (severity === 'CRITICAL' || action === 'DELETE' || action === 'ACCESS_DENIED') {
    logger.warn(`🔒 AUDIT: ${action} par ${logEntry.userEmail}`, {
      entity: logEntry.entityType,
      id: logEntry.entityId,
      ip: logEntry.ipAddress
    });
  }
};

/**
 * 💾 Sauvegarder le log en base de données
 */
const saveAuditLog = async (logEntry) => {
  try {
    // Utiliser Prisma pour sauvegarder
    await prisma.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        timestamp: logEntry.timestamp,
        userId: logEntry.userId,
        userEmail: logEntry.userEmail,
        userRole: logEntry.userRole,
        action: logEntry.action,
        severity: logEntry.severity,
        entityType: logEntry.entityType,
        entityId: logEntry.entityId ? String(logEntry.entityId) : null,
        payload: logEntry.payload,
        ipAddress: logEntry.ipAddress,
        userAgent: logEntry.userAgent,
        sessionId: logEntry.sessionId,
        pageUrl: logEntry.pageUrl,
        requestId: logEntry.requestId,
        duration: logEntry.duration,
        statusCode: logEntry.statusCode
      }
    });
  } catch (error) {
    // Fallback: logger dans les logs système
    logger.error('Audit log DB save failed:', error);
    logger.info('AUDIT_LOG_FALLBACK:', JSON.stringify(logEntry));
  }
};

/**
 * 🔍 Déterminer l'action à partir de la requête
 */
const determineAction = (req) => {
  const { method, originalUrl } = req;
  
  // Actions spéciales
  if (originalUrl.includes('login')) return 'LOGIN';
  if (originalUrl.includes('logout')) return 'LOGOUT';
  if (originalUrl.includes('export')) return 'EXPORT';
  if (originalUrl.includes('import')) return 'IMPORT';
  
  // CRUD standard
  switch (method) {
    case 'POST': return 'CREATE';
    case 'PUT':
    case 'PATCH': return 'UPDATE';
    case 'DELETE': return 'DELETE';
    case 'GET':
      // Différencier LIST vs VIEW
      if (originalUrl.match(/\/(\d+)$/)) return 'VIEW';
      if (originalUrl.match(/\/[a-f0-9-]{36}$/i)) return 'VIEW'; // UUID
      return 'LIST';
    default: return 'UNKNOWN';
  }
};

/**
 * 📦 Déterminer le type d'entité
 */
const determineEntityType = (req) => {
  const path = req.originalUrl.toLowerCase();
  
  if (path.includes('/client')) return 'CLIENT';
  if (path.includes('/bien')) return 'BIEN';
  if (path.includes('/contrat')) return 'CONTRAT';
  if (path.includes('/payment')) return 'PAIEMENT';
  if (path.includes('/user')) return 'USER';
  if (path.includes('/building')) return 'IMMEUBLE';
  if (path.includes('/lease')) return 'BAIL';
  if (path.includes('/commission')) return 'COMMISSION';
  if (path.includes('/alerte')) return 'ALERTE';
  if (path.includes('/auth')) return 'AUTH';
  
  return 'SYSTEM';
};

/**
 * 🎯 Extraire l'ID de l'entité
 */
const extractEntityId = (req, responseData) => {
  // Depuis l'URL
  const urlMatch = req.originalUrl.match(/\/(\d+|[a-f0-9-]{36})$/i);
  if (urlMatch) return urlMatch[1];
  
  // Depuis la réponse
  if (responseData) {
    if (responseData.id) return responseData.id;
    if (responseData._id) return responseData._id;
    if (responseData.data?.id) return responseData.data.id;
    if (responseData.client?.id) return responseData.client.id;
  }
  
  return null;
};

/**
 * 📝 Construire le payload du log
 */
const buildPayload = (req, responseData, originalData, statusCode) => {
  const payload = {
    method: req.method,
    route: req.originalUrl,
    requestBody: sanitizeBody(req.body),
    statusCode,
    timestamp: new Date().toISOString()
  };

  // Ajouter les données avant/après pour UPDATE
  if (originalData && (req.method === 'PUT' || req.method === 'PATCH')) {
    payload.before = sanitizeBody(originalData);
    payload.after = sanitizeBody(responseData);
    payload.changes = computeChanges(originalData, responseData);
  }

  // Ajouter les données créées/supprimées
  if (req.method === 'POST' && responseData) {
    payload.created = sanitizeBody(responseData.data || responseData);
  }

  if (req.method === 'DELETE') {
    payload.deleted = sanitizeBody(originalData);
  }

  return payload;
};

/**
 * 🔒 Nettoyer le body (retirer données sensibles)
 */
const sanitizeBody = (body) => {
  if (!body || typeof body !== 'object') return body;
  
  const sensitiveFields = ['password', 'motdepasse', 'token', 'secret', 'creditcard', 'newpassword', 'currentpassword'];
  const sanitized = {};
  
  Object.keys(body).forEach(key => {
    if (sensitiveFields.includes(key.toLowerCase())) {
      sanitized[key] = '***REDACTED***';
    } else {
      sanitized[key] = body[key];
    }
  });
  
  return sanitized;
};

/**
 * 📊 Calculer les changements
 */
const computeChanges = (before, after) => {
  const changes = [];
  const beforeData = before?.data || before;
  const afterData = after?.data || after;
  
  if (!beforeData || !afterData) return changes;
  
  const allKeys = new Set([...Object.keys(beforeData), ...Object.keys(afterData)]);
  
  allKeys.forEach(key => {
    if (JSON.stringify(beforeData[key]) !== JSON.stringify(afterData[key])) {
      changes.push(key);
    }
  });
  
  return changes;
};

/**
 * 📦 Capturer les données originales avant modification
 */
const captureOriginalData = async (req) => {
  // Cette fonction est un placeholder
  // Dans une implémentation complète, on irait chercher l'entité en DB
  // avant qu'elle ne soit modifiée
  return null;
};

/**
 * 🎯 Middleware spécifique pour routes sensibles
 */
export const requireAuditLog = (options = {}) => {
  return async (req, res, next) => {
    const { action, severity = 'WARNING', reason } = options;
    
    // Log immédiatement
    const logEntry = {
      timestamp: new Date(),
      userId: req.user?.id,
      userEmail: req.user?.email,
      userRole: req.user?.role,
      action: action || 'SENSITIVE_ACTION',
      severity,
      payload: {
        reason,
        params: req.params,
        query: req.query
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    };
    
    saveAuditLog(logEntry).catch(console.error);
    
    logger.warn(`🔒 Action sensible: ${action}`, {
      user: req.user?.email,
      ip: req.ip,
      reason
    });
    
    next();
  };
};

export default auditMiddleware;
