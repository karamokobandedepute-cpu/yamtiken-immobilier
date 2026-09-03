// Middleware pour ajouter automatiquement les timestamps et détecter les doublons

export const addTimestamps = (req, res, next) => {
  const now = new Date().toISOString();
  
  if (req.method === 'POST') {
    // Création - ajouter created_at et updated_at
    req.body.created_at = now;
    req.body.updated_at = now;
    req.body.date_creation = now;
    req.body.derniere_modification = now;
  } else if (req.method === 'PUT' || req.method === 'PATCH') {
    // Mise à jour - modifier seulement updated_at
    req.body.updated_at = now;
    req.body.derniere_modification = now;
    
    // Ne pas permettre la modification de created_at
    delete req.body.created_at;
    delete req.body.date_creation;
  }
  
  next();
};

// Middleware pour vérifier les doublons
export const checkDuplicates = (model, fields = []) => {
  return async (req, res, next) => {
    try {
      // Construire la requête de recherche
      const conditions = {};
      
      fields.forEach(field => {
        if (req.body[field]) {
          conditions[field] = req.body[field];
        }
      });

      // Si aucun champ à vérifier, passer
      if (Object.keys(conditions).length === 0) {
        return next();
      }

      // Rechercher les doublons (en excluant l'enregistrement actuel si c'est une mise à jour)
      const whereClause = {
        OR: Object.entries(conditions).map(([key, value]) => ({
          [key]: value
        }))
      };

      // Exclure l'ID actuel si c'est une mise à jour
      if (req.params.id) {
        whereClause.NOT = { id: req.params.id };
      }

      const duplicates = await model.findMany({
        where: whereClause,
        select: {
          id: true,
          created_at: true,
          updated_at: true,
          ...Object.keys(conditions).reduce((acc, field) => {
            acc[field] = true;
            return acc;
          }, {})
        }
      });

      if (duplicates.length > 0) {
        // Ajouter les doublons à la requête pour que le contrôleur puisse décider
        req.duplicates = duplicates;
        req.hasDuplicates = true;
        
        // Option: retourner une erreur ou un avertissement
        if (req.query.strict === 'true') {
          return res.status(409).json({
            message: 'Doublon(s) détecté(s)',
            duplicates: duplicates.map(d => ({
              ...d,
              age: getTimeDifference(d.created_at)
            }))
          });
        }
      }

      next();
    } catch (error) {
      console.error('Erreur vérification doublons:', error);
      next(); // Continuer même en cas d'erreur
    }
  };
};

// Fonction utilitaire pour calculer la différence de temps
const getTimeDifference = (date) => {
  const diff = Math.abs(new Date() - new Date(date));
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} jour${days > 1 ? 's' : ''}`;
  if (hours > 0) return `${hours} heure${hours > 1 ? 's' : ''}`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  return `${seconds} seconde${seconds > 1 ? 's' : ''}`;
};

// Middleware pour ajouter un identifiant unique basé sur le timestamp
export const addUniqueIdentifier = (fieldName = 'reference') => {
  return (req, res, next) => {
    if (req.method === 'POST' && !req.body[fieldName]) {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 9).toUpperCase();
      req.body[fieldName] = `${timestamp}-${random}`;
    }
    next();
  };
};

// Middleware pour logger les modifications avec timestamp
export const logModifications = (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Logger la modification avec timestamp
    if (req.method !== 'GET' && res.statusCode < 400) {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`, {
        user: req.user?.email || 'anonymous',
        body: req.body,
        duplicates: req.hasDuplicates ? req.duplicates.length : 0
      });
    }
    
    originalSend.call(this, data);
  };
  
  next();
};
