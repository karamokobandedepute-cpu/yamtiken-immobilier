import rateLimit from 'express-rate-limit';

// ============================================
// Rate Limiter - IMMO MANAGER PRO
// ============================================

// Limiteur pour la route de login (20 tentatives/minute)
export const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  message: {
    message: 'Trop de tentatives de connexion. Réessayez dans 1 minute.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  validate: { xForwardedForHeader: false }
});

// Limiteur global pour toutes les routes API (500/minute) - exclure health
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 500,
  skip: (req) => req.path === '/health' || req.path === '/api/health',
  message: {
    message: 'Trop de requêtes. Réessayez dans 1 minute.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false }
});

// Limiteur strict pour les opérations sensibles (200/minute en lecture, 30/minute en écriture)
export const strictLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  skip: (req) => req.method === 'GET',
  message: {
    message: 'Opération trop fréquente. Réessayez dans 1 minute.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false }
});

// Limiteur pour les lectures seules (500/minute)
export const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 500,
  message: {
    message: 'Trop de requêtes. Réessayez dans 1 minute.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false }
});
