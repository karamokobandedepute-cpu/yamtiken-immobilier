import prisma from '../lib/prisma.js';
import fs from 'fs';
import path from 'path';



// GET /api/documents
export const getAllDocuments = async (req, res) => {
  try {
    const { categorie, page = 1, limit = 20 } = req.query;
    const where = {};
    
    if (categorie) where.categorie = categorie;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        include: {
          client: { select: { id: true, nom: true, prenom: true } },
          bien: { select: { id: true, reference: true, titre: true } },
          contrat: { select: { id: true, reference: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.document.count({ where })
    ]);

    res.json({
      data: documents,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des documents', error: error.message });
  }
};

// GET /api/documents/:id
export const getDocumentById = async (req, res) => {
  try {
    const { id } = req.params;
    const document = await prisma.document.findUnique({
      where: { id: parseInt(id) },
      include: {
        client: { select: { id: true, nom: true, prenom: true } },
        bien: { select: { id: true, reference: true, titre: true } },
        contrat: { select: { id: true, reference: true } }
      }
    });

    if (!document) {
      return res.status(404).json({ message: 'Document non trouvé' });
    }

    res.json(document);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération du document', error: error.message });
  }
};

// POST /api/documents/upload
export const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Aucun fichier uploadé' });
    }

    const { clientId, bienId, contratId, categorie, description } = req.body;

    const document = await prisma.document.create({
      data: {
        nom: req.file.originalname,
        type: path.extname(req.file.originalname).toUpperCase().replace('.', ''),
        chemin: req.file.path,
        taille: req.file.size,
        description,
        categorie: categorie || 'AUTRE',
        clientId: clientId ? parseInt(clientId) : null,
        bienId: bienId ? parseInt(bienId) : null,
        contratId: contratId ? parseInt(contratId) : null
      },
      include: {
        client: { select: { id: true, nom: true, prenom: true } },
        bien: { select: { id: true, reference: true, titre: true } },
        contrat: { select: { id: true, reference: true } }
      }
    });

    res.status(201).json({ 
      message: 'Document uploadé avec succès', 
      document 
    });
  } catch (error) {
    // Supprimer le fichier en cas d'erreur
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ message: 'Erreur lors de l\'upload du document', error: error.message });
  }
};

// DELETE /api/documents/:id
export const deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;
    
    const document = await prisma.document.findUnique({
      where: { id: parseInt(id) }
    });

    if (!document) {
      return res.status(404).json({ message: 'Document non trouvé' });
    }

    // Supprimer le fichier physique
    if (fs.existsSync(document.chemin)) {
      fs.unlinkSync(document.chemin);
    }

    await prisma.document.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Document supprimé avec succès' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la suppression du document', error: error.message });
  }
};

// GET /api/documents/client/:clientId
export const getDocumentsByClient = async (req, res) => {
  try {
    const { clientId } = req.params;
    const documents = await prisma.document.findMany({
      where: { clientId: parseInt(clientId) },
      orderBy: { createdAt: 'desc' }
    });
    res.json(documents);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des documents', error: error.message });
  }
};

// GET /api/documents/bien/:bienId
export const getDocumentsByBien = async (req, res) => {
  try {
    const { bienId } = req.params;
    const documents = await prisma.document.findMany({
      where: { bienId: parseInt(bienId) },
      orderBy: { createdAt: 'desc' }
    });
    res.json(documents);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des documents', error: error.message });
  }
};

// GET /api/documents/contrat/:contratId
export const getDocumentsByContrat = async (req, res) => {
  try {
    const { contratId } = req.params;
    const documents = await prisma.document.findMany({
      where: { contratId: parseInt(contratId) },
      orderBy: { createdAt: 'desc' }
    });
    res.json(documents);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des documents', error: error.message });
  }
};

// GET /api/documents/:id/download
export const downloadDocument = async (req, res) => {
  try {
    const { id } = req.params;
    
    const document = await prisma.document.findUnique({
      where: { id: parseInt(id) }
    });

    if (!document) {
      return res.status(404).json({ message: 'Document non trouvé' });
    }

    if (!fs.existsSync(document.chemin)) {
      return res.status(404).json({ message: 'Fichier non trouvé sur le serveur' });
    }

    res.download(document.chemin, document.nom);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors du téléchargement', error: error.message });
  }
};
