import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import prisma from '../lib/prisma.js';

// Dossier uploads
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

// Sauvegarde d'un fichier uploadé (buffer mémoire) sur disque
const saveFile = (file, subfolder = 'photos') => {
  if (!file) return null;
  const dir = path.join(UPLOAD_DIR, subfolder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const ext = path.extname(file.originalname) || '.jpg';
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  fs.writeFileSync(path.join(dir, filename), file.buffer);
  return `/uploads/${subfolder}/${filename}`;
};

// ============================================
// CACHE SIMPLE EN MÉMOIRE
// ============================================
const cache = new Map();
const CACHE_TTL = 10000; // 10 secondes

export const clearClientsCache = () => cache.clear();

const getCache = (key) => {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() - item.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return item.data;
};

const setCache = (key, data) => {
  cache.set(key, { data, timestamp: Date.now() });
};

// GET /api/clients
export const getAllClients = async (req, res) => {
  try {
    const { type, search, page = 1, limit = 20, deletedAt } = req.query;
    
    // Clé de cache basée sur les paramètres
    const cacheKey = `clients_${type || 'all'}_${search || 'none'}_${page}_${limit}_${deletedAt || 'active'}`;
    const cached = getCache(cacheKey);
    if (cached) {
      console.log('[ClientController] Cache hit');
      return res.json(cached);
    }
    
    let sql = `
      SELECT 
        c.id, c.type, c.nom, c.prenom, c.nationalite, 
        c."dateNaissance", c.telephone, c.telephone2, c.email, 
        c.adresse, c.profession, c."numeroPiece", c."photoUrl", 
        c."pieceUrl", c.is_demo, c.actif, 
        c."createdAt", c."updatedAt",
        COALESCE(lease_counts."nbBaux", 0) as "nbBaux",
        COALESCE(lease_agg."montantInitialTotal", 0) as "leaseMontantInitial",
        COALESCE(pay_agg."totalPaye", 0) as "totalPaye",
        GREATEST(0, COALESCE(lease_agg."montantInitialTotal", 0) - COALESCE(pay_agg."totalPaye", 0)) as "soldeDu"
      FROM public.clients c
      LEFT JOIN (
        SELECT "clientId", COUNT(*)::INTEGER as "nbBaux"
        FROM public.leases
        GROUP BY "clientId"
      ) lease_counts ON c.id = lease_counts."clientId"
      LEFT JOIN (
        SELECT "clientId", SUM("montantInitial") as "montantInitialTotal"
        FROM public.leases
        WHERE statut = 'ACTIF'::"StatutLease"
        GROUP BY "clientId"
      ) lease_agg ON c.id = lease_agg."clientId"
      LEFT JOIN (
        SELECT l."clientId", SUM(p."montantVerse") as "totalPaye"
        FROM public.payments p
        JOIN public.leases l ON p."leaseId" = l.id
        GROUP BY l."clientId"
      ) pay_agg ON c.id = pay_agg."clientId"
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (deletedAt === 'not.null') {
      sql += ` AND c."deletedAt" IS NOT NULL`;
    } else {
      sql += ` AND c."deletedAt" IS NULL`;
    }
    
    if (type) {
      sql += ` AND c.type = $${paramIndex}::"TypeClient"`;
      params.push(type);
      paramIndex++;
    }
    
    if (search) {
      sql += ` AND (c.nom ILIKE $${paramIndex} OR c.prenom ILIKE $${paramIndex} OR c.email ILIKE $${paramIndex} OR c.telephone ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    // Compter le total avec une requête COUNT dédiée propre et performante
    let countSql = `SELECT COUNT(*)::INTEGER as total FROM public.clients c WHERE 1=1`;
    const countParams = [];
    let countIndex = 1;
    if (deletedAt === 'not.null') {
      countSql += ` AND c."deletedAt" IS NOT NULL`;
    } else {
      countSql += ` AND c."deletedAt" IS NULL`;
    }
    if (type) {
      countSql += ` AND c.type = $${countIndex}::"TypeClient"`;
      countParams.push(type);
      countIndex++;
    }
    if (search) {
      countSql += ` AND (c.nom ILIKE $${countIndex} OR c.prenom ILIKE $${countIndex} OR c.email ILIKE $${countIndex} OR c.telephone ILIKE $${countIndex})`;
      countParams.push(`%${search}%`);
      countIndex++;
    }
    const countResult = await prisma.$queryRawUnsafe(countSql, ...countParams);
    const total = parseInt(countResult[0]?.total || 0);
    
    // Ajouter pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    sql += ` ORDER BY c."createdAt" DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), offset);
    
    const rawClients = await prisma.$queryRawUnsafe(sql, ...params);

    const clients = rawClients.map(c => ({
      ...c,
      balance: {
        solde: Number(c.soldeDu || 0),
        totalPaye: Number(c.totalPaye || 0),
        montantInitial: Number(c.leaseMontantInitial || 0)
      }
    }));
    
    const result = {
      data: clients,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    };
    
    // Mettre en cache le résultat
    setCache(cacheKey, result);
    
    res.json(result);
  } catch (error) {
    console.error('Erreur getAllClients:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des clients', error: error.message });
  }
};

// GET /api/clients/:id
export const getClientById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const clientResult = await prisma.$queryRaw`
      SELECT * FROM public.clients WHERE id = ${parseInt(id)} LIMIT 1
    `;
    
    if (!clientResult || clientResult.length === 0) {
      return res.status(404).json({ message: 'Client non trouvé' });
    }
    
    const client = clientResult[0];
    
    // Récupérer les baux du client
    const baux = await prisma.$queryRaw`
      SELECT l.*, u."numeroPorte", b.nom as building_nom
      FROM public.leases l
      JOIN public.unites u ON l."uniteId" = u.id
      JOIN public.buildings b ON l."buildingId" = b.id
      WHERE l."clientId" = ${parseInt(id)}
    `;
    
    res.json({
      ...client,
      baux
    });
  } catch (error) {
    console.error('Erreur getClientById:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération du client', error: error.message });
  }
};

// POST /api/clients
export const createClient = async (req, res) => {
  try {
    const { type, nom, prenom, nationalite, dateNaissance, telephone, telephone2, email, adresse, profession, numeroPiece, buildingId, uniteId } = req.body;
    
    // Traitement des fichiers uploadés
    const photoFile = req.files?.photo?.[0] || req.files?.['photo']?.[0];
    const pieceFile = req.files?.piece?.[0] || req.files?.['pieceIdentite']?.[0];
    const photoUrl = saveFile(photoFile, 'photos');
    const pieceUrl = saveFile(pieceFile, 'documents');

    console.log('[createClient] Data:', { type, nom, prenom, nationalite, telephone, buildingId, uniteId, photoUrl });
    
    // Nettoyer dateNaissance
    let parsedDate = null;
    if (dateNaissance && dateNaissance !== '' && dateNaissance !== 'Invalid Date') {
      try {
        const d = new Date(dateNaissance);
        if (!isNaN(d.getTime())) parsedDate = d;
      } catch (e) { /* ignore */ }
    }
    
    const result = await prisma.$queryRawUnsafe(
      `INSERT INTO public.clients (type, nom, prenom, nationalite, "dateNaissance", telephone, telephone2, email, adresse, profession, "numeroPiece", "photoUrl", "pieceUrl", is_demo, actif, "createdAt", "updatedAt")
       VALUES ($1::"TypeClient", $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, false, true, NOW(), NOW())
       RETURNING *`,
      type || 'CLIENT',
      nom || 'Non renseigne',
      prenom || 'Non renseigne',
      nationalite || null,
      parsedDate,
      telephone || null,
      telephone2 || null,
      email || null,
      adresse || null,
      profession || null,
      numeroPiece || null,
      photoUrl,
      pieceUrl
    );
    
    const newClient = result[0];
    
    // Si buildingId et uniteId sont fournis, créer automatiquement un bail
    if (buildingId && uniteId) {
      try {
        // Récupérer l'unité pour le loyer
        const uniteResult = await prisma.$queryRaw`
          SELECT "loyerBase" FROM public.unites WHERE id = ${parseInt(uniteId)} LIMIT 1
        `;
        
        if (uniteResult && uniteResult.length > 0) {
          const loyerBase = uniteResult[0].loyerBase || 0;
          const caution = loyerBase * 2;
          const montantInitial = (loyerBase * 12) + caution;
          
          // Générer un numéro de bail unique
          const existingLeases = await prisma.$queryRaw`SELECT COUNT(*) as count FROM leases`;
          const leaseCount = parseInt(existingLeases[0]?.count || 0);
          const currentYear = new Date().getFullYear();
          const numBail = `BAIL-${currentYear}-${String(leaseCount + 1).padStart(4, '0')}`;
          // Dates du bail (début aujourd'hui, fin dans 1 an)
          const dateDebut = new Date();
          const dateFin = new Date();
          dateFin.setFullYear(dateFin.getFullYear() + 1);
          
          // Créer le bail
          await prisma.$executeRaw`
            INSERT INTO public.leases (
              "numeroBail", "clientId", "buildingId", "uniteId",
              "dateDebut", "dateFin", "montantLoyer", "montantCaution",
              "montantInitial", statut, "createdAt", "updatedAt"
            )
            VALUES (
              ${numBail}, ${newClient.id}, ${parseInt(buildingId)}, ${parseInt(uniteId)},
              ${dateDebut}, ${dateFin}, ${loyerBase}, ${caution},
              ${montantInitial}, 'ACTIF'::"StatutLease", NOW(), NOW()
            )
          `;
          
          // Mettre à jour le statut de l'unité à OCCUPE
          await prisma.$executeRaw`
            UPDATE public.unites SET statut = 'OCCUPE'::"StatutUnite" WHERE id = ${parseInt(uniteId)}
          `;
          
          console.log(`✅ Bail ${numBail} créé automatiquement pour le client ${newClient.id}`);
        }
      } catch (leaseError) {
        console.error('⚠️ Erreur lors de la création du bail:', leaseError);
        // Ne pas bloquer la création du client si le bail échoue
      }
    }
    
    res.status(201).json(newClient);
  } catch (error) {
    console.error('❌ [createClient] Erreur:', error);
    console.error('❌ [createClient] Stack:', error.stack);
    
    // Messages d'erreur clairs en français
    let message = 'Erreur lors de la création du client';
    if (error.code === '23502') {
      message = 'Champ obligatoire manquant. Veuillez remplir au moins le nom et le prénom.';
    } else if (error.code === '23505') {
      message = 'Un client avec ces informations existe déjà.';
    } else if (error.code === '23503') {
      message = 'Référence invalide (patrimoine ou unité introuvable).';
    }
    
    res.status(500).json({ 
      message, 
      error: error.message,
      code: error.code 
    });
  }
};

// PUT /api/clients/:id
export const updateClient = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, nom, prenom, nationalite, dateNaissance, telephone, telephone2, email, adresse, profession, numeroPiece, actif, buildingId, uniteId } = req.body;

    // Traitement des fichiers uploadés (seulement si de nouveaux fichiers sont envoyés)
    const photoFile = req.files?.photo?.[0] || req.files?.['photo']?.[0];
    const pieceFile = req.files?.piece?.[0] || req.files?.['pieceIdentite']?.[0];
    const newPhotoUrl = saveFile(photoFile, 'photos');
    const newPieceUrl = saveFile(pieceFile, 'documents');

    // Nettoyer dateNaissance
    let parsedDate = null;
    if (dateNaissance && dateNaissance !== '' && dateNaissance !== 'Invalid Date') {
      try {
        const d = new Date(dateNaissance);
        if (!isNaN(d.getTime())) parsedDate = d;
      } catch (e) { /* ignore */ }
    }

    // Construction dynamique du UPDATE pour ne changer photo/piece que si nouveau fichier
    let sql = `UPDATE public.clients 
       SET type = $1::"TypeClient", nom = $2, prenom = $3, nationalite = $4, 
           "dateNaissance" = $5, telephone = $6, telephone2 = $7, 
           email = $8, adresse = $9, profession = $10, 
           "numeroPiece" = $11, actif = $12`;
    const params = [
      type || 'CLIENT', nom, prenom, nationalite || null,
      parsedDate, telephone || null, telephone2 || null,
      email || null, adresse || null, profession || null,
      numeroPiece || null, actif !== undefined ? actif : true
    ];
    let idx = 13;
    if (newPhotoUrl) { sql += `, "photoUrl" = $${idx++}`; params.push(newPhotoUrl); }
    if (newPieceUrl) { sql += `, "pieceUrl" = $${idx++}`; params.push(newPieceUrl); }
    sql += `, "updatedAt" = NOW() WHERE id = $${idx} RETURNING *`;
    params.push(parseInt(id));

    const result = await prisma.$queryRawUnsafe(sql, ...params);
    
    if (!result || result.length === 0) {
      return res.status(404).json({ message: 'Client non trouvé' });
    }
    
    // Si buildingId et uniteId sont fournis, mettre à jour ou créer le bail
    if (buildingId && uniteId) {
      try {
        // Vérifier si un bail actif existe déjà
        const existingLease = await prisma.$queryRaw`
          SELECT id, "uniteId" FROM public.leases 
          WHERE "clientId" = ${parseInt(id)} AND statut = 'ACTIF'::"StatutLease"
          LIMIT 1
        `;
        
        if (existingLease && existingLease.length > 0) {
          const oldUniteId = existingLease[0].uniteId;
          
          // Mettre à jour le bail existant
          await prisma.$executeRaw`
            UPDATE public.leases 
            SET "buildingId" = ${parseInt(buildingId)}, "uniteId" = ${parseInt(uniteId)}, "updatedAt" = NOW()
            WHERE id = ${existingLease[0].id}
          `;
          
          // Libérer l'ancienne unité si différente
          if (oldUniteId !== parseInt(uniteId)) {
            await prisma.$executeRaw`
              UPDATE public.unites SET statut = 'VACANT'::"StatutUnite" WHERE id = ${oldUniteId}
            `;
            
            // Occuper la nouvelle unité
            await prisma.$executeRaw`
              UPDATE public.unites SET statut = 'OCCUPE'::"StatutUnite" WHERE id = ${parseInt(uniteId)}
            `;
          }
          
          console.log(`✅ Bail mis à jour pour le client ${id}`);
        } else {
          // Créer un nouveau bail (même logique que createClient)
          const uniteResult = await prisma.$queryRaw`
            SELECT "loyerBase" FROM public.unites WHERE id = ${parseInt(uniteId)} LIMIT 1
          `;
          
          if (uniteResult && uniteResult.length > 0) {
            const loyerBase = uniteResult[0].loyerBase || 0;
            const caution = loyerBase * 2;
            const montantInitial = (loyerBase * 12) + caution;
            
            const existingLeases = await prisma.$queryRaw`SELECT COUNT(*) as count FROM leases`;
            const leaseCount = parseInt(existingLeases[0]?.count || 0);
            const numBail = `BAIL-2024-${String(leaseCount + 1).padStart(4, '0')}`;
            
            const dateDebut = new Date();
            const dateFin = new Date();
            dateFin.setFullYear(dateFin.getFullYear() + 1);
            
            await prisma.$executeRaw`
              INSERT INTO public.leases (
                "numeroBail", "clientId", "buildingId", "uniteId",
                "dateDebut", "dateFin", "montantLoyer", "montantCaution",
                "montantInitial", statut, "createdAt", "updatedAt"
              )
              VALUES (
                ${numBail}, ${parseInt(id)}, ${parseInt(buildingId)}, ${parseInt(uniteId)},
                ${dateDebut}, ${dateFin}, ${loyerBase}, ${caution},
                ${montantInitial}, 'ACTIF'::"StatutLease", NOW(), NOW()
              )
            `;
            
            await prisma.$executeRaw`
              UPDATE public.unites SET statut = 'OCCUPE'::"StatutUnite" WHERE id = ${parseInt(uniteId)}
            `;
            
            console.log(`✅ Nouveau bail ${numBail} créé pour le client ${id}`);
          }
        }
      } catch (leaseError) {
        console.error('⚠️ Erreur lors de la gestion du bail:', leaseError);
      }
    }
    
    res.json(result[0]);
  } catch (error) {
    console.error('Erreur updateClient:', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du client', error: error.message });
  }
};

// DELETE /api/clients/:id (Supporte soft delete par défaut ou hard delete avec ?force=true)
export const deleteClient = async (req, res) => {
  try {
    const { id } = req.params;
    const { force } = req.query;
    
    let result;
    if (force === 'true') {
      result = await prisma.$queryRaw`
        DELETE FROM public.clients WHERE id = ${parseInt(id)} RETURNING *
      `;
    } else {
      result = await prisma.$queryRaw`
        UPDATE public.clients SET "deletedAt" = NOW() WHERE id = ${parseInt(id)} RETURNING *
      `;
    }
    
    if (!result || result.length === 0) {
      return res.status(404).json({ message: 'Client non trouvé' });
    }
    
    clearClientsCache();
    res.json({ message: force === 'true' ? 'Client supprimé définitivement' : 'Client placé dans la corbeille' });
  } catch (error) {
    console.error('Erreur deleteClient:', error);
    res.status(500).json({ message: 'Erreur lors de la suppression du client', error: error.message });
  }
};

// PATCH /api/clients/:id (Restauration ou mise à jour partielle)
export const patchClient = async (req, res) => {
  try {
    const { id } = req.params;
    const { deletedAt } = req.body;
    
    let result;
    if (deletedAt === null) {
      result = await prisma.$queryRaw`
        UPDATE public.clients SET "deletedAt" = NULL WHERE id = ${parseInt(id)} RETURNING *
      `;
      clearClientsCache();
      return res.json({ message: 'Client restauré avec succès', client: result[0] });
    } else if (deletedAt) {
      result = await prisma.$queryRaw`
        UPDATE public.clients SET "deletedAt" = NOW() WHERE id = ${parseInt(id)} RETURNING *
      `;
      clearClientsCache();
      return res.json({ message: 'Client placé dans la corbeille', client: result[0] });
    }
    
    res.json({ message: 'Aucune modification' });
  } catch (error) {
    console.error('Erreur patchClient:', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du client', error: error.message });
  }
};

// GET /api/clients/:id/pdf - Générer fiche PDF
export const generateClientPDF = async (req, res) => {
  try {
    const { id } = req.params;
    
    const clientResult = await prisma.$queryRaw`
      SELECT * FROM public.clients WHERE id = ${parseInt(id)} LIMIT 1
    `;
    
    if (!clientResult || clientResult.length === 0) {
      return res.status(404).json({ message: 'Client non trouve' });
    }
    
    res.json({ client: clientResult[0] });
    
  } catch (error) {
    console.error('Erreur generation PDF client:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la generation du PDF',
      error: error.message 
    });
  }
};

// GET /api/clients/stats
export const getClientStats = async (req, res) => {
  try {
    const stats = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as total_clients,
        COUNT(CASE WHEN type = 'SOUSCRIPTEUR' THEN 1 END) as souscripteurs,
        COUNT(CASE WHEN type = 'CLIENT' THEN 1 END) as clients,
        COUNT(CASE WHEN actif = true THEN 1 END) as actifs,
        COUNT(CASE WHEN actif = false THEN 1 END) as inactifs
      FROM public.clients
    `;
    
    res.json(stats[0]);
  } catch (error) {
    console.error('Erreur getClientStats:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des statistiques', error: error.message });
  }
};

export default {
  getAllClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  patchClient,
  generateClientPDF,
  getClientStats
};
