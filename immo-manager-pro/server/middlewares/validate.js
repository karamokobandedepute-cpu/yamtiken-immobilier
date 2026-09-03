import { z } from 'zod';

// Middleware réutilisable de validation Zod
// Usage: router.post('/payments', validateBody(paymentSchema), handler)
export const validateBody = (schema) => {
  return (req, res, next) => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated; // Remplacer par les données validées (strip les champs inconnus)
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
          code: e.code
        }));
        return res.status(400).json({
          message: 'Données invalides',
          errors
        });
      }
      return res.status(400).json({ message: 'Erreur de validation' });
    }
  };
};

// Validation des query params (pagination, filtres)
export const validateQuery = (schema) => {
  return (req, res, next) => {
    try {
      const validated = schema.parse(req.query);
      req.query = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
          code: e.code
        }));
        return res.status(400).json({
          message: 'Paramètres invalides',
          errors
        });
      }
      return res.status(400).json({ message: 'Erreur de validation' });
    }
  };
};
