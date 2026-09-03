import prisma from '../lib/prisma.js';



// GET /api/notifications
export const getMyNotifications = async (req, res) => {
  try {
    const { lue, page = 1, limit = 20 } = req.query;
    const where = { userId: req.user.id };
    
    if (lue !== undefined) {
      where.lue = lue === 'true';
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.notification.count({ where })
    ]);

    res.json({
      data: notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des notifications', error: error.message });
  }
};

// GET /api/notifications/non-lues
export const getUnreadCount = async (req, res) => {
  try {
    const count = await prisma.notification.count({
      where: { 
        userId: req.user.id,
        lue: false
      }
    });

    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors du comptage', error: error.message });
  }
};

// PUT /api/notifications/:id/lire
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que la notification appartient à l'utilisateur
    const notification = await prisma.notification.findFirst({
      where: { 
        id: parseInt(id),
        userId: req.user.id
      }
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification non trouvée' });
    }

    const updated = await prisma.notification.update({
      where: { id: parseInt(id) },
      data: { lue: true }
    });

    res.json({ message: 'Notification marquée comme lue', notification: updated });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour', error: error.message });
  }
};

// PUT /api/notifications/lire-tout
export const markAllAsRead = async (req, res) => {
  try {
    const result = await prisma.notification.updateMany({
      where: { 
        userId: req.user.id,
        lue: false
      },
      data: { lue: true }
    });

    res.json({ 
      message: `${result.count} notification(s) marquée(s) comme lue(s)` 
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour', error: error.message });
  }
};

// DELETE /api/notifications/:id
export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que la notification appartient à l'utilisateur
    const notification = await prisma.notification.findFirst({
      where: { 
        id: parseInt(id),
        userId: req.user.id
      }
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification non trouvée' });
    }

    await prisma.notification.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Notification supprimée avec succès' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la suppression', error: error.message });
  }
};

// GET /api/notifications/admin/all (admin seulement)
export const getAllNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        include: {
          user: { select: { id: true, nom: true, prenom: true, email: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.notification.count()
    ]);

    res.json({
      data: notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération', error: error.message });
  }
};

// POST /api/notifications/admin/broadcast (admin seulement)
export const broadcastNotification = async (req, res) => {
  try {
    const { titre, message, type = 'INFO', userIds } = req.body;

    let targetUsers;
    
    if (userIds && Array.isArray(userIds) && userIds.length > 0) {
      // Envoyer à des utilisateurs spécifiques
      targetUsers = userIds;
    } else {
      // Envoyer à tous les utilisateurs actifs
      const users = await prisma.user.findMany({
        where: { actif: true },
        select: { id: true }
      });
      targetUsers = users.map(u => u.id);
    }

    // Créer les notifications
    const notifications = await prisma.notification.createMany({
      data: targetUsers.map(userId => ({
        userId,
        titre,
        message,
        type
      }))
    });

    res.status(201).json({ 
      message: `${notifications.count} notification(s) envoyée(s)`,
      count: notifications.count
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de l\'envoi', error: error.message });
  }
};
