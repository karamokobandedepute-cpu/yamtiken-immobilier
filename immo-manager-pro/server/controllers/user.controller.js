import prisma from '../lib/prisma.js';
import bcrypt from 'bcrypt';



// GET /api/users
export const getAllUsers = async (req, res) => {
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
    res.status(500).json({ message: 'Erreur lors de la récupération des utilisateurs', error: error.message });
  }
};

// GET /api/users/:id
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) },
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
        telephone: true,
        role: true,
        actif: true,
        dernierConnexion: true,
        createdAt: true,
        notifications: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération de l\'utilisateur', error: error.message });
  }
};

// POST /api/users
export const createUser = async (req, res) => {
  try {
    const { email, password, nom, prenom, telephone, role } = req.body;

    // Vérifier si email existe déjà
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
        telephone,
        role: role || 'SECRETAIRE'
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

    res.status(201).json({ message: 'Utilisateur créé avec succès', user });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la création de l\'utilisateur', error: error.message });
  }
};

// PUT /api/users/:id
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, nom, prenom, telephone, role, actif } = req.body;

    const user = await prisma.user.update({
      where: { id: parseInt(id) },
      data: { email, nom, prenom, telephone, role, actif },
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
        telephone: true,
        role: true,
        actif: true,
        updatedAt: true
      }
    });

    res.json({ message: 'Utilisateur mis à jour avec succès', user });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour de l\'utilisateur', error: error.message });
  }
};

// DELETE /api/users/:id
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Empêcher la suppression de son propre compte
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ message: 'Vous ne pouvez pas supprimer votre propre compte' });
    }

    await prisma.user.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Utilisateur supprimé avec succès' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la suppression de l\'utilisateur', error: error.message });
  }
};

// PUT /api/users/:id/toggle
export const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await prisma.user.findUnique({ where: { id: parseInt(id) } });
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    const updated = await prisma.user.update({
      where: { id: parseInt(id) },
      data: { actif: !user.actif },
      select: {
        id: true,
        nom: true,
        prenom: true,
        actif: true
      }
    });

    res.json({ 
      message: `Utilisateur ${updated.actif ? 'activé' : 'désactivé'} avec succès`, 
      user: updated 
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors du changement de statut', error: error.message });
  }
};

// GET /api/users/profile/me
export const getMyProfile = async (req, res) => {
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
        dernierConnexion: true,
        createdAt: true
      }
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération du profil', error: error.message });
  }
};

// PUT /api/users/profile/me
export const updateMyProfile = async (req, res) => {
  try {
    const { nom, prenom, telephone } = req.body;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { nom, prenom, telephone },
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
        telephone: true,
        role: true,
        updatedAt: true
      }
    });

    res.json({ message: 'Profil mis à jour avec succès', user });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour du profil', error: error.message });
  }
};
