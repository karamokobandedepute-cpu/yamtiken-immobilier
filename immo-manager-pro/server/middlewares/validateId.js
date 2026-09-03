// ============================================
// MIDDLEWARE : Validation des paramètres ID
// ============================================
// Vérifie que les paramètres :id sont des entiers valides
// Évite les erreurs Prisma sur parseInt("abc") = NaN

export const validateId = (paramName = 'id') => (req, res, next) => {
  const raw = req.params[paramName];
  const parsed = parseInt(raw, 10);
  
  if (isNaN(parsed) || parsed <= 0 || String(parsed) !== raw) {
    return res.status(400).json({ 
      message: `Paramètre '${paramName}' invalide. Un identifiant numérique positif est requis.` 
    });
  }
  
  req.params[paramName] = parsed;
  next();
};

// Validation multiple (pour routes avec plusieurs IDs)
export const validateIds = (...paramNames) => (req, res, next) => {
  for (const paramName of paramNames) {
    const raw = req.params[paramName];
    if (raw !== undefined) {
      const parsed = parseInt(raw, 10);
      if (isNaN(parsed) || parsed <= 0) {
        return res.status(400).json({ 
          message: `Paramètre '${paramName}' invalide. Un identifiant numérique positif est requis.` 
        });
      }
      req.params[paramName] = parsed;
    }
  }
  next();
};

export default validateId;
