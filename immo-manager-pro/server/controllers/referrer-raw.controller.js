import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

export const getAllReferrers = async (req, res) => {
  try {
    const referrers = await prisma.$queryRaw`
      SELECT r.*, 
        (SELECT COUNT(*) FROM commissions c WHERE c."referrerId" = r.id) as total_commissions,
        (SELECT SUM(montant) FROM commissions c WHERE c."referrerId" = r.id AND c.statut = 'PAYEE') as total_paye
      FROM public.referrers r
      WHERE r.is_active = true
      ORDER BY r."createdAt" DESC
    `;
    
    res.json({ data: referrers });
  } catch (error) {
    console.error('Erreur getAllReferrers:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des apporteurs', error: error.message });
  }
};

export const getReferrerById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const referrer = await prisma.$queryRaw`
      SELECT * FROM public.referrers WHERE id = ${parseInt(id)} LIMIT 1
    `;
    
    if (!referrer || referrer.length === 0) {
      return res.status(404).json({ message: 'Apporteur non trouvé' });
    }
    
    const commissions = await prisma.$queryRaw`
      SELECT c.*, cl.nom as client_nom, cl.prenom as client_prenom
      FROM public.commissions c
      JOIN public.clients cl ON c."clientId" = cl.id
      WHERE c."referrerId" = ${parseInt(id)}
      ORDER BY c."createdAt" DESC
    `;
    
    res.json({ ...referrer[0], commissions });
  } catch (error) {
    console.error('Erreur getReferrerById:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération de l\'apporteur', error: error.message });
  }
};

export const createReferrer = async (req, res) => {
  try {
    const { nom, prenom, contact, email, tauxCommission, typeCommission } = req.body;
    
    const result = await prisma.$queryRaw`
      INSERT INTO public.referrers (nom, prenom, contact, email, "tauxCommission", "typeCommission", is_active, is_demo, "createdAt", "updatedAt")
      VALUES (${nom}, ${prenom}, ${contact}, ${email || null}, ${tauxCommission || 5}, ${typeCommission || 'POURCENTAGE'}::"TypeCommission", true, false, NOW(), NOW())
      RETURNING *
    `;
    
    res.status(201).json(result[0]);
  } catch (error) {
    console.error('Erreur createReferrer:', error);
    res.status(500).json({ message: 'Erreur lors de la création de l\'apporteur', error: error.message });
  }
};

export const updateReferrer = async (req, res) => {
  try {
    const { id } = req.params;
    const { nom, prenom, contact, email, tauxCommission, typeCommission, is_active } = req.body;
    
    const result = await prisma.$queryRaw`
      UPDATE public.referrers 
      SET nom = ${nom}, prenom = ${prenom}, contact = ${contact}, email = ${email}, 
          "tauxCommission" = ${tauxCommission}, "typeCommission" = ${typeCommission}::"TypeCommission", 
          is_active = ${is_active !== undefined ? is_active : true}, "updatedAt" = NOW()
      WHERE id = ${parseInt(id)}
      RETURNING *
    `;
    
    res.json(result[0]);
  } catch (error) {
    console.error('Erreur updateReferrer:', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour', error: error.message });
  }
};

export const deleteReferrer = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.$executeRaw`DELETE FROM public.referrers WHERE id = ${parseInt(id)}`;
    res.json({ message: 'Apporteur supprimé' });
  } catch (error) {
    console.error('Erreur deleteReferrer:', error);
    res.status(500).json({ message: 'Erreur lors de la suppression', error: error.message });
  }
};

export default {
  getAllReferrers,
  getReferrerById,
  createReferrer,
  updateReferrer,
  deleteReferrer
};
