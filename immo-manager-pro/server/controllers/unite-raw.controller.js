import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

// GET /api/buildings/:id/unites
export const getUnitesByBuilding = async (req, res) => {
  try {
    const { id } = req.params;
    const unites = await prisma.$queryRaw`
      SELECT id, "numeroPorte", "typeUnite", etage, "loyerBase", statut, "buildingId", "createdAt", "updatedAt"
      FROM public.unites
      WHERE "buildingId" = ${parseInt(id)}
      ORDER BY etage ASC, "numeroPorte" ASC
    `;
    console.log(`[getUnitesByBuilding] Building ${id}: ${unites.length} unites`);
    res.json({ data: unites, count: unites.length });
  } catch (error) {
    console.error('[getUnitesByBuilding] Erreur:', error);
    res.status(500).json({ message: 'Erreur lors de la recuperation des unites', error: error.message });
  }
};

// POST /api/buildings/:id/unites
export const createUnite = async (req, res) => {
  try {
    const { id } = req.params;
    const { numeroPorte, typeUnite, etage, loyerBase, statut } = req.body;

    console.log(`[createUnite] Building ${id}:`, req.body);

    const result = await prisma.$queryRaw`
      INSERT INTO public.unites ("numeroPorte", "typeUnite", etage, "loyerBase", statut, "buildingId", "createdAt", "updatedAt")
      VALUES (${numeroPorte}, ${typeUnite || 'STUDIO'}::"TypeUnite", ${parseInt(etage) || 0}, ${parseFloat(loyerBase) || 0}, ${statut || 'VACANT'}::"StatutUnite", ${parseInt(id)}, NOW(), NOW())
      RETURNING *
    `;

    console.log(`[createUnite] OK:`, result[0]);
    res.status(201).json({ message: 'Unite creee avec succes', data: result[0] });
  } catch (error) {
    console.error('[createUnite] Erreur:', error);
    res.status(500).json({ message: 'Erreur lors de la creation', error: error.message });
  }
};

// PUT /api/buildings/:buildingId/unites/:uniteId
export const updateUnite = async (req, res) => {
  try {
    const { uniteId } = req.params;
    const { numeroPorte, typeUnite, etage, loyerBase, statut } = req.body;

    const result = await prisma.$queryRaw`
      UPDATE public.unites
      SET "numeroPorte" = ${numeroPorte}, "typeUnite" = ${typeUnite}::"TypeUnite",
          etage = ${parseInt(etage) || 0}, "loyerBase" = ${parseFloat(loyerBase) || 0},
          statut = ${statut || 'VACANT'}::"StatutUnite", "updatedAt" = NOW()
      WHERE id = ${parseInt(uniteId)}
      RETURNING *
    `;

    if (!result || result.length === 0) {
      return res.status(404).json({ message: 'Unite non trouvee' });
    }

    res.json({ message: 'Unite mise a jour avec succes', unite: result[0] });
  } catch (error) {
    console.error('[updateUnite] Erreur:', error);
    res.status(500).json({ message: 'Erreur lors de la mise a jour', error: error.message });
  }
};

// DELETE /api/buildings/:buildingId/unites/:uniteId
export const deleteUnite = async (req, res) => {
  try {
    const { uniteId } = req.params;
    await prisma.$executeRaw`DELETE FROM public.unites WHERE id = ${parseInt(uniteId)}`;
    res.json({ message: 'Unite supprimee avec succes' });
  } catch (error) {
    console.error('[deleteUnite] Erreur:', error);
    res.status(500).json({ message: 'Erreur lors de la suppression', error: error.message });
  }
};

// PUT /api/buildings/:buildingId/unites/:uniteId/statut
export const updateUniteStatut = async (req, res) => {
  try {
    const { uniteId } = req.params;
    const { statut } = req.body;

    const result = await prisma.$queryRaw`
      UPDATE public.unites
      SET statut = ${statut}::"StatutUnite", "updatedAt" = NOW()
      WHERE id = ${parseInt(uniteId)}
      RETURNING *
    `;

    if (!result || result.length === 0) {
      return res.status(404).json({ message: 'Unite non trouvee' });
    }

    res.json({ message: 'Statut mis a jour avec succes', unite: result[0] });
  } catch (error) {
    console.error('[updateUniteStatut] Erreur:', error);
    res.status(500).json({ message: 'Erreur lors de la mise a jour du statut', error: error.message });
  }
};
