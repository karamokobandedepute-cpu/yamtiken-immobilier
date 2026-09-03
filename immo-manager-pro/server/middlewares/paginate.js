/**
 * Middleware de pagination générique compatible Prisma
 * Usage: router.get('/', verifyToken, paginate, async (req, res) => { ... })
 * 
 * Ajoute req.pagination = { skip, take, page, limit, sort }
 * Le handler doit utiliser req.pagination pour la requête Prisma
 * et appeler res.paginate(data, total) pour la réponse
 */
export function paginate(req, res, next) {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const sort = req.query.sort === 'asc' ? 'asc' : 'desc';

  req.pagination = {
    skip: (page - 1) * limit,
    take: limit,
    page,
    limit,
    sort,
    search: req.query.search || null
  };

  // Ajouter la méthode res.paginate pour formater la réponse
  res.paginate = (data, total) => {
    const totalPages = Math.ceil(total / limit);
    res.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  };

  next();
}

/**
 * Helper pour construire l'objet orderBy Prisma
 * @param {string} field - Champ de tri (défaut: createdAt)
 * @param {string} order - asc ou desc
 */
export function orderBy(field = 'createdAt', order = 'desc') {
  return { [field]: order };
}

/**
 * Helper pour construire la recherche textuelle Prisma
 * @param {string[]} fields - Champs à rechercher
 * @param {string} search - Terme de recherche
 */
export function searchFilter(fields, search) {
  if (!search) return {};
  return {
    OR: fields.map(field => ({
      [field]: { contains: search, mode: 'insensitive' }
    }))
  };
}
