import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import logger, { httpLogger } from './lib/logger.js';

// Patch global BigInt pour la sérialisation JSON (PostgreSQL COUNT/SUM renvoient BigInt)
BigInt.prototype.toJSON = function () {
  return Number(this);
};

// Routes
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import clientRoutes from './routes/client.routes.js';
import bienRoutes from './routes/bien.routes.js';
import contratRoutes from './routes/contrat.routes.js';
// import paiementRoutes from './routes/paiement.routes.js'; // Supprimé - doublon avec payment.routes
import visiteRoutes from './routes/visite.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import documentRoutes from './routes/document.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import buildingRoutes from './routes/building.routes.js';
import referrerRoutes from './routes/referrer.routes.js';
import leaseRoutes from './routes/lease.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import alerteRoutes from './routes/alerte.routes.js';
import recouvrementRoutes from './routes/recouvrement.routes.js';
import commissionRoutes from './routes/commission.routes.js';
import adminRoutes from './routes/admin.routes.js';
import exportRoutes from './routes/export.routes.js';
import auditRoutes from './routes/audit.routes.js';
import caisseRoutes from './routes/caisse.routes.js';
import cronService from './services/cron.service.js';
import { initSocket } from './lib/socket.js';
import prisma from './lib/prisma.js';
import { apiLimiter, loginLimiter, strictLimiter } from './middlewares/rateLimiter.js';
// import { auditMiddleware } from './middlewares/audit.middleware.js'; // Middleware audit global

dotenv.config();

// Vérification des variables critiques au démarrage — refuse de lancer sans JWT_SECRET
if (!process.env.JWT_SECRET) {
  console.error('❌ FATAL: JWT_SECRET manquant dans .env — arrêt du serveur.');
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

const VPS_FRONTEND_ORIGIN = 'http://54.36.209.70:4000'
const VPS_API_ORIGIN = 'http://54.36.209.70:5000'

// Middlewares de sécurité
const isDev = process.env.NODE_ENV !== 'production'
app.use(helmet({
  contentSecurityPolicy: isDev ? false : {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https://*.supabase.co", VPS_API_ORIGIN],
      connectSrc: [
        "'self'",
        "https://*.supabase.co",
        "ws://localhost:*",
        "wss://localhost:*",
        "http://localhost:*",
        "http://127.0.0.1:*",
        VPS_FRONTEND_ORIGIN,
        VPS_API_ORIGIN,
        "https://yamtiken2026.online",
        "https://www.yamtiken2026.online",
        "wss://yamtiken2026.online",
        process.env.CLIENT_URL || "http://localhost:5173"
      ],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));
const PROD_ALLOWED_ORIGINS = [
  process.env.CLIENT_URL || 'https://yamtiken2026.online',
  'https://yamtiken2026.online',
  'https://www.yamtiken2026.online',
  VPS_FRONTEND_ORIGIN,
  'app://localhost',  // electron-serve (Electron packaged)
  'http://localhost:5173', // Electron dev
  'http://localhost:4173', // Vite preview
]

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? (origin, callback) => {
        // null origin = file:// ou requête non-browser (ex: Postman, Electron sans electron-serve)
        if (!origin || PROD_ALLOWED_ORIGINS.includes(origin)) {
          callback(null, true)
        } else {
          callback(new Error(`CORS bloqué: origine non autorisée → ${origin}`))
        }
      }
    : true, // Dev : accepte toutes les origines
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400
}));

// Rate limiting global
app.use('/api/', apiLimiter);
app.use('/api/auth/login', loginLimiter);

// Rate limiting strict sur routes sensibles
app.use('/api/admin', strictLimiter);
app.use('/api/payments', strictLimiter);
app.use('/api/leases', strictLimiter);

// Compression HTTP (réduit 60-80% la taille des réponses)
app.use(compression());

// Middlewares de parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logger HTTP structuré (Winston)
app.use(httpLogger);

// Servir les uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check avec vérification DB
app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ 
      status: 'ok',
      backend: 'connected',
      database: 'connected',
      message: 'YAMTIKEN CRM - Système opérationnel',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'error',
      backend: 'connected',
      database: 'disconnected',
      message: 'YAMTIKEN CRM - Base de données indisponible',
      error: error.message,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================
// ORDRE DES ROUTES CRITIQUE - NE PAS MODIFIER
// Les routes spécifiques DOIVENT être avant simpleRoutes (wildcard /api/*)
// ============================================

// 1. Routes publiques (pas d'auth)
app.use('/api/auth', authRoutes);

// 2. Routes spécifiques (AVANT simpleRoutes pour éviter interception)
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/biens', bienRoutes);
app.use('/api/contrats', contratRoutes);
app.use('/api/visites', visiteRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/buildings', buildingRoutes);
app.use('/api/referrers', referrerRoutes);
app.use('/api/leases', leaseRoutes);
app.use('/api/payments', paymentRoutes); // ✅ Réactivé pour la gestion des paiements
app.use('/api/alertes', alerteRoutes);
app.use('/api/recouvrement', recouvrementRoutes);
app.use('/api/commissions', commissionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/caisse', caisseRoutes);

// ============================================
// PRODUCTION : Servir le frontend React build
// ============================================
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));

  // Toutes les routes non-API renvoient index.html (React Router SPA)
  app.get('*', (req, res, next) => {
    if (req.originalUrl.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Gestion des erreurs 404 (API uniquement)
app.use((req, res) => {
  res.status(404).json({ 
    message: 'Route non trouvée',
    path: req.originalUrl 
  });
});

// Gestion globale des erreurs
app.use((err, req, res, next) => {
  // Logger l'erreur complète côté serveur (jamais envoyée au client)
  logger.error('Erreur non gérée', {
    message: err?.message,
    stack: err?.stack,
    method: req.method,
    url: req.originalUrl,
    user: req.user?.email || 'anonymous'
  });
  
  // Si erreur de CONNEXION DB uniquement (pas les erreurs de validation/contrainte)
  const DB_CONNECTION_CODES = ['P1001', 'P1002', 'P1003', 'P1008', 'P1009', 'P1010', 'P1017'];
  const isPrismaError = DB_CONNECTION_CODES.includes(err?.code) ||
                         err?.message?.includes('ENOTFOUND') ||
                         err?.message?.includes('ECONNREFUSED') ||
                         err?.message?.includes("Can't reach database server");
  
  if (isPrismaError && req.method === 'GET') {
    return res.status(200).json({ 
      data: [], 
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      stats: {},
      _warning: 'DB temporairement inaccessible'
    });
  }
  
  // JAMAIS envoyer le vrai message d'erreur au client
  res.status(err.status || 500).json({
    message: 'Erreur interne du serveur'
  });
});

// Handlers globaux pour empêcher les crashes
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason: reason?.message || reason });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { message: error?.message, stack: error?.stack });
});

const server = app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║        🏢 IMMO MANAGER PRO - YAMTIKEN BEHEMOTH         ║
║                                                        ║
║        API démarrée sur http://localhost:${PORT}        ║
╚════════════════════════════════════════════════════════╝
  `);
  
  // Démarrer le service CRON pour les alertes automatiques (6h alertes, 7h email, 8h retards)
  cronService.start();
});

// Initialisation des WebSockets
initSocket(server);


// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`\n🛑 Signal ${signal} reçu. Arrêt gracieux en cours...`);
  cronService.stop();
  server.close(async () => {
    try {
      await prisma.$disconnect();
      console.log('✅ Connexions DB fermées.');
    } catch (e) {
      console.error('Erreur fermeture DB:', e);
    }
    process.exit(0);
  });
  // Force exit après 10 secondes
  setTimeout(() => {
    console.error('⚠️  Arrêt forcé après timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
